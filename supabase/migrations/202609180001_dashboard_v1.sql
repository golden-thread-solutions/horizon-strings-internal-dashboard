-- Dashboard V1 only. Does not read, alter or import website/legacy tables.
begin;

create table public.hs_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null
);
alter table public.hs_owners enable row level security;
create policy owner_reads_self on public.hs_owners for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.hs_owners from authenticated;
grant select on public.hs_owners to authenticated;
revoke all on public.hs_owners from anon;

create function public.hs_is_owner() returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.hs_owners where user_id = (select auth.uid())); $$;
revoke all on function public.hs_is_owner() from public;
grant execute on function public.hs_is_owner() to authenticated;

create sequence public.hs_event_code_seq start 1;
create table public.hs_events (
  id uuid primary key,
  code text not null unique default ('E' || lpad(nextval('public.hs_event_code_seq')::text, 5, '0')),
  revision integer not null default 1 check (revision > 0),
  name text not null check (length(trim(name)) between 1 and 300),
  "eventDate" text not null default '' check ("eventDate" = '' or "eventDate" ~ '^\d{4}-\d{2}-\d{2}$'),
  "eventType" text not null default '', ensemble text not null default '' check (ensemble in ('','Solo','Duo','Trio','Quartet','Quintet','Sextet')),
  "durationMinutes" integer not null default 0 check ("durationMinutes" between 0 and 1440),
  area text not null default '', address text not null default '', source text not null default '', notes text not null default '',
  "createdDate" text not null, archived boolean not null default false, "archiveReason" text not null default '',
  milestones jsonb not null default '{"responded":"","welcomeSent":"","finalConfirmed":"","thankYouSent":"","reviewRequested":""}'::jsonb,
  "updatedAt" timestamptz not null default now(), "updatedBy" uuid references auth.users(id)
);
create index hs_events_date_idx on public.hs_events("eventDate");
create table public.hs_details (
  "eventId" uuid not null references public.hs_events(id) on delete cascade,
  key text not null check (key in ('timing','venueSetup','wetWeather','onDayContact','repertoireBrief','rehearsal','logistics','runSheet')),
  state text not null check (state in ('Unknown','Filled','Not Applicable','Deferred')),
  value text not null default '', "dueDate" text not null default '', trigger text not null default '' check (trigger in ('','Internal Organisation','Final Details')),
  primary key ("eventId", key),
  check (state <> 'Filled' or length(trim(value)) > 0),
  check (state <> 'Deferred' or "dueDate" <> '' or trigger <> '')
);
create table public.hs_contacts (
  id uuid primary key, "eventId" uuid not null references public.hs_events(id) on delete cascade,
  role text not null, name text not null, email text not null, phone text not null, notes text not null
);
create table public.hs_musicians (
  id uuid primary key, name text not null check (length(trim(name)) > 0), instrument text not null,
  email text not null, phone text not null, notes text not null
);
create table public.hs_pieces (
  id uuid primary key, title text not null check (length(trim(title)) > 0), artist text not null,
  "musicUrl" text not null check ("musicUrl" = '' or "musicUrl" ~ '^https?://'), notes text not null
);
create table public.hs_event_musicians (
  id uuid primary key, "eventId" uuid not null references public.hs_events(id) on delete cascade,
  "musicianId" uuid references public.hs_musicians(id), name text not null, instrument text not null,
  confirmed boolean not null, "musicSent" boolean not null, "contractRequired" boolean not null,
  signed boolean not null, paid boolean not null, fee numeric(12,2) not null check (fee >= 0), notes text not null
);
create table public.hs_event_repertoire (
  id uuid primary key, "eventId" uuid not null references public.hs_events(id) on delete cascade,
  "pieceId" uuid references public.hs_pieces(id), title text not null, moment text not null,
  status text not null check (status in ('Requested','Needs arranging','Available','Approved','Not Applicable')), notes text not null
);
create table public.hs_finance (
  "eventId" uuid primary key references public.hs_events(id) on delete cascade,
  performance numeric(12,2) not null check (performance >= 0), travel numeric(12,2) not null check (travel >= 0),
  arrangements numeric(12,2) not null check (arrangements >= 0), "otherCharges" numeric(12,2) not null check ("otherCharges" >= 0),
  "depositRequired" numeric(12,2) not null check ("depositRequired" >= 0), "depositReceived" boolean not null,
  "depositAmount" numeric(12,2) not null check ("depositAmount" >= 0), "depositDate" text not null,
  "finalReceived" numeric(12,2) not null check ("finalReceived" >= 0), "finalDate" text not null,
  "invoiceReference" text not null, "invoiceSent" boolean not null, "otherCosts" numeric(12,2) not null check ("otherCosts" >= 0),
  check (not "depositReceived" or ("depositAmount" > 0 and "depositDate" <> '')),
  check ("finalReceived" = 0 or "finalDate" <> '')
);
create table public.hs_tasks (
  id uuid primary key, "eventId" uuid not null references public.hs_events(id) on delete cascade,
  title text not null check (length(trim(title)) > 0), kind text not null check (kind in ('Task','Communication')),
  "dueDate" text not null check ("dueDate" ~ '^\d{4}-\d{2}-\d{2}$'), assignee text not null, recipient text not null,
  notes text not null, done boolean not null, "completedAt" text not null
);
create table public.hs_communications (
  id uuid primary key, "eventId" uuid not null references public.hs_events(id) on delete cascade,
  date text not null check (date ~ '^\d{4}-\d{2}-\d{2}$'), recipient text not null, summary text not null check (length(trim(summary)) > 0)
);
create table public.hs_settings (
  id integer primary key default 1 check (id = 1), revision integer not null default 0,
  "internalWeeks" integer not null default 12 check ("internalWeeks" between 0 and 104),
  "musiciansWeeks" integer not null default 12 check ("musiciansWeeks" between 0 and 104),
  "repertoireWeeks" integer not null default 6 check ("repertoireWeeks" between 0 and 104),
  "arrangementsWeeks" integer not null default 4 check ("arrangementsWeeks" between 0 and 104),
  "rehearsalWeeks" integer not null default 3 check ("rehearsalWeeks" between 0 and 104),
  "finalWeeks" integer not null default 2 check ("finalWeeks" between 0 and 104),
  "finalCheckWeeks" integer not null default 1 check ("finalCheckWeeks" between 0 and 104),
  "paymentWeeks" integer not null default 1 check ("paymentWeeks" between 0 and 104),
  "responseDays" integer not null default 1 check ("responseDays" between 0 and 30),
  "depositFollowupDays" integer not null default 7 check ("depositFollowupDays" between 0 and 90),
  "postEventDays" integer not null default 7 check ("postEventDays" between 0 and 90),
  "readyRequiresPayment" boolean not null default true, "defaultsReviewed" boolean not null default false,
  check ("internalWeeks" >= "finalWeeks" and "finalWeeks" >= "finalCheckWeeks")
);
alter table public.hs_contacts add column "sortOrder" integer not null default 0;
alter table public.hs_event_musicians add column "sortOrder" integer not null default 0;
alter table public.hs_event_repertoire add column "sortOrder" integer not null default 0;
alter table public.hs_tasks add column "sortOrder" integer not null default 0;
alter table public.hs_communications add column "sortOrder" integer not null default 0;
insert into public.hs_settings default values;
create table public.hs_audit (
  id bigint generated always as identity primary key, event_id uuid not null references public.hs_events(id),
  revision integer not null, changed_by uuid not null default auth.uid(), changed_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['hs_events','hs_details','hs_contacts','hs_musicians','hs_pieces','hs_event_musicians','hs_event_repertoire','hs_finance','hs_tasks','hs_communications','hs_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy owners_only on public.%I for all to authenticated using ((select public.hs_is_owner())) with check ((select public.hs_is_owner()))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
  foreach t in array array['hs_contacts','hs_event_musicians','hs_event_repertoire','hs_tasks','hs_communications'] loop
    execute format('create index on public.%I ("eventId")', t);
  end loop;
end $$;
alter table public.hs_audit enable row level security;
create policy owners_read_audit on public.hs_audit for select to authenticated using ((select public.hs_is_owner()));
create policy owners_append_audit on public.hs_audit for insert to authenticated with check ((select public.hs_is_owner()) and changed_by = (select auth.uid()));
revoke all on public.hs_audit from anon, authenticated;
grant select, insert on public.hs_audit to authenticated;
grant usage, select on sequence public.hs_event_code_seq, public.hs_audit_id_seq to authenticated;

create function public.hs_get_event(p_id uuid) returns jsonb language sql stable security invoker set search_path = '' as $$
  select (to_jsonb(e) - 'updatedAt' - 'updatedBy') || jsonb_build_object(
    'details', coalesce((select jsonb_object_agg(d.key, to_jsonb(d) - 'key' - 'eventId') from public.hs_details d where d."eventId"=e.id),'{}'::jsonb),
    'contacts', coalesce((select jsonb_agg(to_jsonb(c)-'eventId'-'sortOrder' order by c."sortOrder") from public.hs_contacts c where c."eventId"=e.id),'[]'::jsonb),
    'musicians', coalesce((select jsonb_agg((to_jsonb(m)-'eventId'-'sortOrder') || jsonb_build_object('musicianId', coalesce(m."musicianId"::text,'')) order by m."sortOrder") from public.hs_event_musicians m where m."eventId"=e.id),'[]'::jsonb),
    'repertoire', coalesce((select jsonb_agg((to_jsonb(r)-'eventId'-'sortOrder') || jsonb_build_object('pieceId', coalesce(r."pieceId"::text,'')) order by r."sortOrder") from public.hs_event_repertoire r where r."eventId"=e.id),'[]'::jsonb),
    'finance', (select to_jsonb(f)-'eventId' from public.hs_finance f where f."eventId"=e.id),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t)-'eventId'-'sortOrder' order by t."sortOrder") from public.hs_tasks t where t."eventId"=e.id),'[]'::jsonb),
    'communicationLog', coalesce((select jsonb_agg(to_jsonb(c)-'eventId'-'sortOrder' order by c."sortOrder") from public.hs_communications c where c."eventId"=e.id),'[]'::jsonb)
  ) from public.hs_events e where e.id=p_id;
$$;
create function public.hs_save_event(p_event jsonb) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare e public.hs_events; eid uuid; expected integer; result_revision integer; child jsonb;
begin
  if not public.hs_is_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
  if octet_length(p_event::text)>1000000 then raise exception 'Event is too large'; end if;
  e := jsonb_populate_record(null::public.hs_events,p_event);
  eid := e.id; expected := e.revision;
  if expected=0 then
    insert into public.hs_events(id,name,"eventDate","eventType",ensemble,"durationMinutes",area,address,source,notes,"createdDate",archived,"archiveReason",milestones,"updatedBy")
    values(e.id,e.name,e."eventDate",e."eventType",e.ensemble,e."durationMinutes",e.area,e.address,e.source,e.notes,e."createdDate",e.archived,e."archiveReason",e.milestones,auth.uid()) returning revision into result_revision;
  else
    update public.hs_events set name=e.name,"eventDate"=e."eventDate","eventType"=e."eventType",ensemble=e.ensemble,"durationMinutes"=e."durationMinutes",area=e.area,address=e.address,source=e.source,notes=e.notes,archived=e.archived,"archiveReason"=e."archiveReason",milestones=e.milestones,revision=revision+1,"updatedAt"=now(),"updatedBy"=auth.uid()
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

create function public.hs_load_workspace() returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'events', coalesce((select jsonb_agg(public.hs_get_event(id) order by "createdDate" desc,code desc) from public.hs_events),'[]'::jsonb),
    'settings', (select to_jsonb(s)-'id' from public.hs_settings s where id=1),
    'musicians', coalesce((select jsonb_agg(to_jsonb(m) order by name) from public.hs_musicians m),'[]'::jsonb),
    'pieces', coalesce((select jsonb_agg(to_jsonb(p) order by title) from public.hs_pieces p),'[]'::jsonb)
  ) where public.hs_is_owner();
$$;
create function public.hs_save_settings(p_settings jsonb) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.hs_settings; result jsonb;
begin
  s:=jsonb_populate_record(null::public.hs_settings,p_settings);
  update public.hs_settings set revision=revision+1,"internalWeeks"=s."internalWeeks","musiciansWeeks"=s."musiciansWeeks","repertoireWeeks"=s."repertoireWeeks","arrangementsWeeks"=s."arrangementsWeeks","rehearsalWeeks"=s."rehearsalWeeks","finalWeeks"=s."finalWeeks","finalCheckWeeks"=s."finalCheckWeeks","paymentWeeks"=s."paymentWeeks","responseDays"=s."responseDays","depositFollowupDays"=s."depositFollowupDays","postEventDays"=s."postEventDays","readyRequiresPayment"=s."readyRequiresPayment","defaultsReviewed"=s."defaultsReviewed"
  where id=1 and revision=s.revision returning to_jsonb(hs_settings)-'id' into result;
  if not found then raise exception 'Settings changed in another session. Reload before saving.' using errcode='40001'; end if;
  return result;
end $$;
revoke all on function public.hs_get_event(uuid), public.hs_save_event(jsonb), public.hs_load_workspace(), public.hs_save_settings(jsonb) from public;
grant execute on function public.hs_get_event(uuid), public.hs_save_event(jsonb), public.hs_load_workspace(), public.hs_save_settings(jsonb) to authenticated;
commit;
