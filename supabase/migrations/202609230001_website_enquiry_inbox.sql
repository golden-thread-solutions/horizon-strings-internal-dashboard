-- Show private website enquiries to dashboard owners and convert each one at most once.
begin;

alter table public.hs_events
  add column if not exists operational jsonb not null default '{}'::jsonb;

alter table public.hs_pieces
  add column if not exists genre text not null default '' check (genre in ('','Classical','Traditional','Pop / vocal','Jazz','Film / game music','Contemporary – rock','Contemporary – pop','Musical theatre','Folk / acoustic','Sacred / religious','Other')),
  add column if not exists "weddingSuitable" text not null default 'Unreviewed' check ("weddingSuitable" in ('Unreviewed','Yes','No'));

do $$
declare constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.hs_details'::regclass
    and pg_get_constraintdef(oid) like '%state%Filled%value%';
  if constraint_name is not null then
    execute format('alter table public.hs_details drop constraint %I', constraint_name);
  end if;
end $$;

create or replace function public.hs_save_event(p_event jsonb) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare e public.hs_events; eid uuid; expected integer; result_revision integer; child jsonb;
begin
  if not public.hs_is_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
  if octet_length(p_event::text)>1000000 then raise exception 'Event is too large'; end if;
  e := jsonb_populate_record(null::public.hs_events,p_event);
  eid := e.id; expected := e.revision;
  if expected=0 then
    insert into public.hs_events(id,name,"eventDate","eventType",ensemble,"durationMinutes",area,address,source,notes,"createdDate",archived,"archiveReason",milestones,operational,"updatedBy")
    values(e.id,e.name,e."eventDate",e."eventType",e.ensemble,e."durationMinutes",e.area,e.address,e.source,e.notes,e."createdDate",e.archived,e."archiveReason",e.milestones,coalesce(e.operational,'{}'::jsonb),auth.uid()) returning revision into result_revision;
  else
    update public.hs_events set name=e.name,"eventDate"=e."eventDate","eventType"=e."eventType",ensemble=e.ensemble,"durationMinutes"=e."durationMinutes",area=e.area,address=e.address,source=e.source,notes=e.notes,archived=e.archived,"archiveReason"=e."archiveReason",milestones=e.milestones,operational=coalesce(e.operational,'{}'::jsonb),revision=revision+1,"updatedAt"=now(),"updatedBy"=auth.uid()
    where id=eid and revision=expected returning revision into result_revision;
    if not found then raise exception 'This event changed in another session. Reload before saving.' using errcode='40001'; end if;
  end if;
  delete from public.hs_details where "eventId"=eid;
  insert into public.hs_details select eid, d.key, d.value->>'state',d.value->>'value',d.value->>'dueDate',d.value->>'trigger' from jsonb_each(p_event->'details') d;
  if (select count(*) from public.hs_details where "eventId"=eid)<>8 then raise exception 'All eight detail resolution fields are required'; end if;
  delete from public.hs_contacts where "eventId"=eid;
  select coalesce(jsonb_agg(v.value || jsonb_build_object('eventId',eid,'sortOrder',v.ordinality-1)),'[]') into child from jsonb_array_elements(p_event->'contacts') with ordinality v;
  insert into public.hs_contacts select * from jsonb_populate_recordset(null::public.hs_contacts,child);
  delete from public.hs_event_musicians where "eventId"=eid;
  select coalesce(jsonb_agg(v.value || jsonb_build_object('eventId',eid,'sortOrder',v.ordinality-1,'musicianId',nullif(v.value->>'musicianId',''))),'[]') into child from jsonb_array_elements(p_event->'musicians') with ordinality v;
  insert into public.hs_event_musicians select * from jsonb_populate_recordset(null::public.hs_event_musicians,child);
  delete from public.hs_event_repertoire where "eventId"=eid;
  select coalesce(jsonb_agg(v.value || jsonb_build_object('eventId',eid,'sortOrder',v.ordinality-1,'pieceId',nullif(v.value->>'pieceId',''))),'[]') into child from jsonb_array_elements(p_event->'repertoire') with ordinality v;
  insert into public.hs_event_repertoire select * from jsonb_populate_recordset(null::public.hs_event_repertoire,child);
  delete from public.hs_finance where "eventId"=eid;
  insert into public.hs_finance select * from jsonb_populate_record(null::public.hs_finance,(p_event->'finance') || jsonb_build_object('eventId',eid));
  delete from public.hs_tasks where "eventId"=eid;
  select coalesce(jsonb_agg(v.value || jsonb_build_object('eventId',eid,'sortOrder',v.ordinality-1)),'[]') into child from jsonb_array_elements(p_event->'tasks') with ordinality v;
  insert into public.hs_tasks select * from jsonb_populate_recordset(null::public.hs_tasks,child);
  delete from public.hs_communications where "eventId"=eid;
  select coalesce(jsonb_agg(v.value || jsonb_build_object('eventId',eid,'sortOrder',v.ordinality-1)),'[]') into child from jsonb_array_elements(p_event->'communicationLog') with ordinality v;
  insert into public.hs_communications select * from jsonb_populate_recordset(null::public.hs_communications,child);
  insert into public.hs_audit(event_id,revision) values(eid,result_revision);
  return public.hs_get_event(eid);
end $$;

alter table public.website_enquiries
  add column if not exists wedding_package text check (wedding_package is null or wedding_package in ('still-deciding','classic','signature','prestige','other')),
  add column if not exists requested_ensemble text check (requested_ensemble is null or requested_ensemble in ('still-deciding','duet','quartet')),
  add column if not exists dashboard_status text not null default 'new' check (dashboard_status in ('new','converted')),
  add column if not exists dashboard_event_id uuid references public.hs_events(id) on delete set null,
  add column if not exists dashboard_handled_at timestamptz,
  add column if not exists dashboard_handled_by uuid references auth.users(id);

create unique index if not exists website_enquiries_dashboard_event_idx
  on public.website_enquiries(dashboard_event_id)
  where dashboard_event_id is not null;

grant select on public.website_enquiries to authenticated;
drop policy if exists hs_owner_read_website_enquiries on public.website_enquiries;
create policy hs_owner_read_website_enquiries on public.website_enquiries
  for select to authenticated using (public.hs_is_owner());

create or replace function public.hs_convert_website_enquiry(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  enquiry public.website_enquiries%rowtype;
  event_id uuid;
  event_record jsonb;
  saved jsonb;
  ensemble_name text;
  event_type text;
  event_notes text;
begin
  if not public.hs_is_owner() then
    raise exception 'Owner access required' using errcode = '42501';
  end if;

  select * into enquiry
  from public.website_enquiries
  where id = p_id
  for update;

  if not found then
    raise exception 'Website enquiry not found' using errcode = 'P0002';
  end if;

  if enquiry.dashboard_event_id is not null then
    return public.hs_get_event(enquiry.dashboard_event_id);
  end if;

  event_id := gen_random_uuid();
  ensemble_name := case enquiry.requested_ensemble
    when 'duet' then 'Duo'
    when 'quartet' then 'Quartet'
    else ''
  end;
  event_type := case enquiry.wedding_package
    when 'other' then 'Other event'
    else 'Wedding'
  end;
  event_notes := concat_ws(
    E'\n\n',
    nullif(enquiry.message, ''),
    case when enquiry.wedding_package is not null
      then 'Website package: ' || replace(enquiry.wedding_package, '-', ' ')
    end,
    case when enquiry.requested_ensemble is not null
      then 'Requested ensemble: ' || replace(enquiry.requested_ensemble, '-', ' ')
    end
  );

  event_record := jsonb_build_object(
    'id', event_id,
    'code', '',
    'revision', 0,
    'name', enquiry.name,
    'eventDate', coalesce(enquiry.event_date::text, ''),
    'eventType', event_type,
    'ensemble', ensemble_name,
    'durationMinutes', 0,
    'area', coalesce(enquiry.area, ''),
    'address', coalesce(enquiry.venue, ''),
    'source', 'Website enquiry',
    'notes', event_notes,
    'createdDate', ((enquiry.created_at at time zone 'Australia/Sydney')::date)::text,
    'archived', false,
    'archiveReason', '',
    'details', jsonb_build_object(
      'timing', jsonb_build_object('state','Unknown','value','','dueDate','','trigger',''),
      'venueSetup', jsonb_build_object('state','Unknown','value','','dueDate','','trigger',''),
      'wetWeather', jsonb_build_object('state','Unknown','value','','dueDate','','trigger',''),
      'onDayContact', jsonb_build_object('state','Unknown','value','','dueDate','','trigger',''),
      'repertoireBrief', jsonb_build_object('state','Unknown','value','','dueDate','','trigger',''),
      'rehearsal', jsonb_build_object('state','Unknown','value','','dueDate','','trigger',''),
      'logistics', jsonb_build_object('state','Unknown','value','','dueDate','','trigger',''),
      'runSheet', jsonb_build_object('state','Unknown','value','','dueDate','','trigger','')
    ),
    'operational', '{}'::jsonb,
    'contacts', jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(),
      'role', 'Main contact',
      'name', enquiry.name,
      'email', enquiry.email,
      'phone', coalesce(enquiry.phone, ''),
      'notes', 'Preferred reply: ' || initcap(enquiry.preferred_contact)
    )),
    'musicians', '[]'::jsonb,
    'repertoire', '[]'::jsonb,
    'finance', jsonb_build_object(
      'performance',0,'travel',0,'arrangements',0,'otherCharges',0,
      'depositRequired',0,'depositReceived',false,'depositAmount',0,
      'depositDate','','finalReceived',0,'finalDate','',
      'invoiceReference','','invoiceSent',false,'otherCosts',0
    ),
    'milestones', jsonb_build_object(
      'responded','','welcomeSent','','finalConfirmed','','thankYouSent','','reviewRequested',''
    ),
    'tasks', '[]'::jsonb,
    'communicationLog', '[]'::jsonb
  );

  saved := public.hs_save_event(event_record);

  update public.website_enquiries
  set dashboard_status = 'converted',
      dashboard_event_id = event_id,
      dashboard_handled_at = now(),
      dashboard_handled_by = auth.uid()
  where id = p_id;

  return saved;
end;
$$;

revoke all on function public.hs_convert_website_enquiry(uuid) from public;
grant execute on function public.hs_convert_website_enquiry(uuid) to authenticated;

create or replace function public.hs_load_workspace() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'events', coalesce((select jsonb_agg(public.hs_get_event(id) order by "createdDate" desc,code desc) from public.hs_events),'[]'::jsonb),
    'settings', (select to_jsonb(s)-'id' from public.hs_settings s where id=1),
    'musicians', coalesce((select jsonb_agg(to_jsonb(m) order by name) from public.hs_musicians m),'[]'::jsonb),
    'pieces', coalesce((select jsonb_agg(to_jsonb(p) order by title) from public.hs_pieces p),'[]'::jsonb),
    'websiteEnquiries', coalesce((
      select jsonb_agg(item order by created_at desc)
      from (
        select created_at, jsonb_build_object(
          'id', id,
          'createdAt', created_at,
          'name', name,
          'email', email,
          'phone', coalesce(phone,''),
          'preferredContact', preferred_contact,
          'eventDate', coalesce(event_date::text,''),
          'venue', coalesce(venue,''),
          'area', coalesce(area,''),
          'message', coalesce(message,''),
          'weddingPackage', coalesce(wedding_package,''),
          'requestedEnsemble', coalesce(requested_ensemble,''),
          'emailStatus', email_status,
          'dashboardStatus', dashboard_status,
          'dashboardEventId', coalesce(dashboard_event_id::text,'')
        ) item
        from public.website_enquiries
        order by created_at desc
        limit 100
      ) recent
    ),'[]'::jsonb)
  ) where public.hs_is_owner();
$$;

revoke all on function public.hs_load_workspace() from public;
grant execute on function public.hs_load_workspace() to authenticated;

commit;
