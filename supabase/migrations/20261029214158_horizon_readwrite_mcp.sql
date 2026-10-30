-- Additive delegated writes. Existing OAuth clients remain read-only.
begin;
alter table public.hs_mcp_clients add column write_enabled boolean not null default false;

create function public.hs_mcp_can_write() returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(public.hs_mcp_can_read(),false) and exists (
    select 1 from public.hs_mcp_clients where client_id=auth.jwt()->>'client_id'
      and user_id=auth.uid() and enabled and write_enabled
  );
$$;
revoke all on function public.hs_mcp_can_write() from public,anon;
grant execute on function public.hs_mcp_can_write() to authenticated;

create schema hs_mcp_private;
revoke all on schema hs_mcp_private from public,anon,authenticated;
create table public.hs_mcp_requests (
  user_id uuid not null, client_id text not null, request_id uuid not null,
  command jsonb not null, result jsonb not null, created_at timestamptz not null default now(),
  primary key(user_id,client_id,request_id)
);
create table public.hs_mcp_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null, client_id text not null, request_id uuid not null,
  operation text not null, record_id text not null, revision integer not null,
  created_at timestamptz not null default now()
);
alter table public.hs_mcp_requests enable row level security;
alter table public.hs_mcp_activity enable row level security;
revoke all on public.hs_mcp_requests,public.hs_mcp_activity from public,anon,authenticated;

-- Ordinary dashboard updates must participate in directory conflict protection.
alter table public.hs_musicians add column revision integer not null default 1 check(revision>0);
alter table public.hs_pieces add column revision integer not null default 1 check(revision>0);
create function hs_mcp_private.directory_revision() returns trigger
language plpgsql set search_path='' as $$
begin
  if TG_OP='INSERT' then new.revision:=1; else new.revision:=old.revision+1; end if;
  return new;
end;
$$;
create trigger musician_revision before insert or update on public.hs_musicians
for each row execute function hs_mcp_private.directory_revision();
create trigger piece_revision before insert or update on public.hs_pieces
for each row execute function hs_mcp_private.directory_revision();

create function hs_mcp_private.merge_object(base jsonb, patch jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare k text; v jsonb; result jsonb:=base;
begin
  if jsonb_typeof(patch)<>'object' then return patch; end if;
  for k,v in select * from jsonb_each(patch) loop
    result:=jsonb_set(result,array[k],case when jsonb_typeof(v)='object'
      then hs_mcp_private.merge_object(coalesce(result->k,'{}'::jsonb),v) else v end,true);
  end loop;
  return result;
end;
$$;

-- This may return a receipt only to the same still-authorised actor/client.
create function public.hs_mcp_retry(p_command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare receipt public.hs_mcp_requests;
begin
  if not coalesce(public.hs_mcp_can_write(),false) then
    raise exception 'MCP write access denied' using errcode='42501';
  end if;
  select * into receipt from public.hs_mcp_requests where user_id=auth.uid()
    and client_id=auth.jwt()->>'client_id' and request_id=(p_command->>'requestId')::uuid;
  if found then
    if receipt.command<>p_command then raise exception 'Request ID reused' using errcode='22023'; end if;
    return receipt.result;
  end if;
  return null;
end;
$$;
revoke all on function public.hs_mcp_retry(jsonb) from public,anon;
grant execute on function public.hs_mcp_retry(jsonb) to authenticated;

create function public.hs_mcp_change_record(p_command jsonb,p_record jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare op text:=p_command->>'operation'; rid uuid:=(p_command->>'requestId')::uuid;
  eid uuid; expected integer:=(p_command->>'expectedRevision')::integer;
  before_record jsonb; saved jsonb; result jsonb; wanted jsonb;
  collection text; item jsonb; old_item jsonb; items jsonb; n integer;
begin
  if not coalesce(public.hs_mcp_can_write(),false) then
    raise exception 'MCP write access denied' using errcode='42501';
  end if;
  -- Pin access while writing; concurrent revocation waits for this transaction.
  perform 1 from public.hs_mcp_clients where client_id=auth.jwt()->>'client_id' for share;
  perform 1 from public.hs_owners where user_id=auth.uid() for share;
  perform 1 from auth.sessions where id::text=auth.jwt()->>'session_id' for share;
  if not coalesce(public.hs_mcp_can_write(),false) then
    raise exception 'MCP write access denied' using errcode='42501';
  end if;
  if rid is null or expected is null or expected<0 or octet_length(p_command::text)>32768
    or octet_length(p_record::text)>1000000 then
    raise exception 'Invalid command' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||(auth.jwt()->>'client_id')||':'||rid::text,0));
  result:=public.hs_mcp_retry(p_command);
  if result is not null then return result; end if;
  if op='update_settings' then
    select to_jsonb(s)-'id' into before_record from public.hs_settings s where id=1 for update;
    if (before_record->>'revision')::integer<>expected then raise exception 'Stale settings' using errcode='40001'; end if;
    if jsonb_typeof(p_command->'patch')<>'object' or
      exists(select 1 from jsonb_object_keys(p_command->'patch') k where not (before_record-'revision') ? k) then
      raise exception 'Invalid settings fields' using errcode='22023';
    end if;
    wanted:=before_record||(p_command->'patch');
    if p_record is distinct from wanted then raise exception 'Invalid settings candidate' using errcode='22023'; end if;
    saved:=public.hs_save_settings(p_record);
  elsif op in ('save_musician','save_piece') then
    eid:=(p_command->>'id')::uuid;
    -- Serialise creates as well as updates, including ordinary UI upserts.
    if op='save_musician' then
      lock table public.hs_musicians in share row exclusive mode;
      select to_jsonb(m) into before_record from public.hs_musicians m where id=eid;
    else
      lock table public.hs_pieces in share row exclusive mode;
      select to_jsonb(p) into before_record from public.hs_pieces p where id=eid;
    end if;
    if coalesce((before_record->>'revision')::integer,0)<>expected then raise exception 'Stale directory record' using errcode='40001'; end if;
    if eid is null or jsonb_typeof(p_command->'data')<>'object' or
       p_record is distinct from ((p_command->'data')||jsonb_build_object('id',eid,'revision',expected)) or
       exists(select 1 from jsonb_object_keys(p_command->'data') k
         where not k=any(case when op='save_musician' then array['name','instrument','email','phone','notes']
           else array['title','artist','musicUrl','genre','weddingSuitable','notes'] end)) then
      raise exception 'Invalid directory fields' using errcode='22023';
    end if;
    if op='save_musician' then
      insert into public.hs_musicians select * from jsonb_populate_record(null::public.hs_musicians,p_record)
      on conflict(id) do update set name=excluded.name,instrument=excluded.instrument,email=excluded.email,phone=excluded.phone,notes=excluded.notes;
      select to_jsonb(m) into saved from public.hs_musicians m where id=eid;
    else
      insert into public.hs_pieces select * from jsonb_populate_record(null::public.hs_pieces,p_record)
      on conflict(id) do update set title=excluded.title,artist=excluded.artist,"musicUrl"=excluded."musicUrl",genre=excluded.genre,"weddingSuitable"=excluded."weddingSuitable",notes=excluded.notes;
      select to_jsonb(p) into saved from public.hs_pieces p where id=eid;
    end if;
  elsif op in ('create_event','update_event','set_event_item') then
    eid:=(p_command->>'id')::uuid;
    -- Prevent a competing create from becoming a replacement update.
    perform pg_advisory_xact_lock(hashtextextended('horizon-event:'||eid::text,0));
    perform 1 from public.hs_events where id=eid for update;
    before_record:=public.hs_get_event(eid);
    -- Match the model's defaults for older events saved with operational={};
    -- normalisation must not make unrelated, valid edits fail comparison.
    if before_record is not null then
      before_record:=jsonb_set(before_record,'{operational}',
        '{"timing":{},"venueSetup":{},"wetWeather":{},"onDayContact":{},"repertoireBrief":{},"rehearsal":{},"logistics":{},"runSheet":{}}'::jsonb
        ||coalesce(before_record->'operational','{}'::jsonb));
    end if;
    if eid is null or coalesce((before_record->>'revision')::integer,0)<>expected then
      raise exception 'Stale event' using errcode='40001';
    end if;
    if op='create_event' then
      if before_record is not null or expected<>0 or p_record->>'id'<>eid::text
        or p_record->>'name' is distinct from p_command->>'name'
        or p_record->>'revision'<>'0' or p_record->>'archived'<>'false'
        or p_record->'finance' is distinct from '{"performance":0,"travel":0,"arrangements":0,"otherCharges":0,"depositRequired":400,"depositReceived":false,"depositAmount":400,"depositDate":"","finalReceived":0,"finalDate":"","invoiceReference":"","invoiceSent":false,"otherCosts":0}'::jsonb
        or p_record->'contacts'<>'[]'::jsonb or p_record->'tasks'<>'[]'::jsonb
        or p_record->'musicians'<>'[]'::jsonb or p_record->'repertoire'<>'[]'::jsonb
        or p_record->'communicationLog'<>'[]'::jsonb then
        raise exception 'Invalid new event' using errcode='22023';
      end if;
    else
      if before_record is null or before_record->>'archived'='true' then raise exception 'Event unavailable' using errcode='22023'; end if;
      if op='update_event' then
        if jsonb_typeof(p_command->'patch')<>'object' or exists(
          select 1 from jsonb_object_keys(p_command->'patch') k where not k=any(array[
            'name','eventDate','eventType','ensemble','durationMinutes','area','address','source','notes','details','operational','milestones'])) then
          raise exception 'Invalid event fields' using errcode='22023';
        end if;
        wanted:=hs_mcp_private.merge_object(before_record,p_command->'patch');
      else
        collection:=p_command->>'collection'; item:=p_command->'data';
        if collection is null or not collection=any(array['contacts','tasks','musicians','repertoire','communicationLog'])
          or jsonb_typeof(item)<>'object' or nullif(item->>'id','') is null then
          raise exception 'Invalid event item' using errcode='22023';
        end if;
        select v into old_item from jsonb_array_elements(before_record->collection) v where v->>'id'=item->>'id';
        if collection='musicians' then
          if item ? 'fee' or item ? 'paid' then raise exception 'Financial edits excluded' using errcode='22023'; end if;
          item:=jsonb_build_object('fee',0,'paid',false)||coalesce(old_item,'{}'::jsonb)||item;
        end if;
        select coalesce(jsonb_agg(case when v->>'id'=item->>'id' then item else v end order by ord),'[]'::jsonb)
          into items from jsonb_array_elements(before_record->collection) with ordinality a(v,ord);
        if old_item is null then items:=items||jsonb_build_array(item); end if;
        wanted:=jsonb_set(before_record,array[collection],items);
      end if;
      if p_record is distinct from wanted then raise exception 'Invalid event candidate' using errcode='22023'; end if;
    end if;
    saved:=hs_mcp_private.save_event(p_record);
  else
    raise exception 'Unsupported operation' using errcode='22023';
  end if;
  result:=jsonb_build_object('saved',true,'operation',op,'record',saved,'requestId',rid);
  insert into public.hs_mcp_activity(user_id,client_id,request_id,operation,record_id,revision)
    values(auth.uid(),auth.jwt()->>'client_id',rid,op,coalesce(eid::text,'settings'),(saved->>'revision')::integer);
  insert into public.hs_mcp_requests(user_id,client_id,request_id,command,result)
    values(auth.uid(),auth.jwt()->>'client_id',rid,p_command,result);
  return result;
end;
$$;
revoke all on function public.hs_mcp_change_record(jsonb,jsonb) from public,anon;
grant execute on function public.hs_mcp_change_record(jsonb,jsonb) to authenticated;

-- Private atomic saver follows the existing application save contract. Its only
-- caller is the guarded writer above; the ordinary owner RPC remains unchanged.
create function hs_mcp_private.save_event(p_event jsonb) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare e public.hs_events; eid uuid; expected integer; result_revision integer; child jsonb;
begin
  if not coalesce(public.hs_mcp_can_write(),false) then raise exception 'Owner access required' using errcode='42501'; end if;
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
revoke all on all functions in schema hs_mcp_private from public,anon,authenticated;
commit;
