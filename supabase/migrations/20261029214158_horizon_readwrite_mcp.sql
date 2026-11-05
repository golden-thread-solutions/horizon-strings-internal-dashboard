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

-- BEGIN GENERATED RECORD SCHEMAS (node --import tsx scripts/generate-mcp-validation.ts)
create function hs_mcp_private.record_schema(kind text) returns jsonb
language sql immutable set search_path='' as $schema$
  select '{"event":{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"code":{"type":"string","maxLength":300},"revision":{"type":"integer","minimum":0,"maximum":9007199254740991},"name":{"type":"string","minLength":1,"maxLength":300},"eventDate":{"type":"string","format":"horizon-date","minLength":0},"eventType":{"type":"string","maxLength":300},"ensemble":{"type":"string","enum":["","Solo","Duo","Trio","Quartet","Quintet","Sextet"]},"durationMinutes":{"type":"integer","minimum":0,"maximum":1440},"area":{"type":"string","maxLength":300},"address":{"type":"string","maxLength":300},"source":{"type":"string","maxLength":300},"notes":{"type":"string","maxLength":10000},"createdDate":{"type":"string","format":"horizon-date","minLength":10},"archived":{"type":"boolean"},"deletedAt":{"default":"","type":"string"},"archiveReason":{"type":"string","maxLength":10000},"details":{"type":"object","properties":{"timing":{"type":"object","properties":{"state":{"type":"string","enum":["Unknown","Filled","Not Applicable","Deferred"]},"value":{"type":"string","maxLength":10000},"dueDate":{"type":"string","format":"horizon-date","minLength":0},"trigger":{"type":"string","enum":["","Internal Organisation","Final Details"]}},"required":["state","value","dueDate","trigger"]},"venueSetup":{"type":"object","properties":{"state":{"type":"string","enum":["Unknown","Filled","Not Applicable","Deferred"]},"value":{"type":"string","maxLength":10000},"dueDate":{"type":"string","format":"horizon-date","minLength":0},"trigger":{"type":"string","enum":["","Internal Organisation","Final Details"]}},"required":["state","value","dueDate","trigger"]},"wetWeather":{"type":"object","properties":{"state":{"type":"string","enum":["Unknown","Filled","Not Applicable","Deferred"]},"value":{"type":"string","maxLength":10000},"dueDate":{"type":"string","format":"horizon-date","minLength":0},"trigger":{"type":"string","enum":["","Internal Organisation","Final Details"]}},"required":["state","value","dueDate","trigger"]},"onDayContact":{"type":"object","properties":{"state":{"type":"string","enum":["Unknown","Filled","Not Applicable","Deferred"]},"value":{"type":"string","maxLength":10000},"dueDate":{"type":"string","format":"horizon-date","minLength":0},"trigger":{"type":"string","enum":["","Internal Organisation","Final Details"]}},"required":["state","value","dueDate","trigger"]},"repertoireBrief":{"type":"object","properties":{"state":{"type":"string","enum":["Unknown","Filled","Not Applicable","Deferred"]},"value":{"type":"string","maxLength":10000},"dueDate":{"type":"string","format":"horizon-date","minLength":0},"trigger":{"type":"string","enum":["","Internal Organisation","Final Details"]}},"required":["state","value","dueDate","trigger"]},"rehearsal":{"type":"object","properties":{"state":{"type":"string","enum":["Unknown","Filled","Not Applicable","Deferred"]},"value":{"type":"string","maxLength":10000},"dueDate":{"type":"string","format":"horizon-date","minLength":0},"trigger":{"type":"string","enum":["","Internal Organisation","Final Details"]}},"required":["state","value","dueDate","trigger"]},"logistics":{"type":"object","properties":{"state":{"type":"string","enum":["Unknown","Filled","Not Applicable","Deferred"]},"value":{"type":"string","maxLength":10000},"dueDate":{"type":"string","format":"horizon-date","minLength":0},"trigger":{"type":"string","enum":["","Internal Organisation","Final Details"]}},"required":["state","value","dueDate","trigger"]},"runSheet":{"type":"object","properties":{"state":{"type":"string","enum":["Unknown","Filled","Not Applicable","Deferred"]},"value":{"type":"string","maxLength":10000},"dueDate":{"type":"string","format":"horizon-date","minLength":0},"trigger":{"type":"string","enum":["","Internal Organisation","Final Details"]}},"required":["state","value","dueDate","trigger"]}},"required":["timing","venueSetup","wetWeather","onDayContact","repertoireBrief","rehearsal","logistics","runSheet"]},"operational":{"default":{"timing":{},"venueSetup":{},"wetWeather":{},"onDayContact":{},"repertoireBrief":{},"rehearsal":{},"logistics":{},"runSheet":{}},"type":"object","properties":{"timing":{"default":{},"type":"object","propertyNames":{"type":"string"},"additionalProperties":{"anyOf":[{"type":"string","maxLength":10000},{"type":"number"}]}},"venueSetup":{"default":{},"type":"object","propertyNames":{"type":"string"},"additionalProperties":{"anyOf":[{"type":"string","maxLength":10000},{"type":"number"}]}},"wetWeather":{"default":{},"type":"object","propertyNames":{"type":"string"},"additionalProperties":{"anyOf":[{"type":"string","maxLength":10000},{"type":"number"}]}},"onDayContact":{"default":{},"type":"object","propertyNames":{"type":"string"},"additionalProperties":{"anyOf":[{"type":"string","maxLength":10000},{"type":"number"}]}},"repertoireBrief":{"default":{},"type":"object","propertyNames":{"type":"string"},"additionalProperties":{"anyOf":[{"type":"string","maxLength":10000},{"type":"number"}]}},"rehearsal":{"default":{},"type":"object","propertyNames":{"type":"string"},"additionalProperties":{"anyOf":[{"type":"string","maxLength":10000},{"type":"number"}]}},"logistics":{"default":{},"type":"object","propertyNames":{"type":"string"},"additionalProperties":{"anyOf":[{"type":"string","maxLength":10000},{"type":"number"}]}},"runSheet":{"default":{},"type":"object","propertyNames":{"type":"string"},"additionalProperties":{"anyOf":[{"type":"string","maxLength":10000},{"type":"number"}]}}}},"contacts":{"maxItems":40,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"role":{"type":"string","maxLength":300},"name":{"type":"string","maxLength":300},"email":{"anyOf":[{"type":"string","format":"email","pattern":"^(?:[A-Za-z0-9_''+\\-]+\\.)*[A-Za-z0-9_''+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$"},{"type":"string","const":""}]},"phone":{"type":"string","maxLength":300},"notes":{"type":"string","maxLength":10000}},"required":["id","role","name","email","phone","notes"]}},"musicians":{"maxItems":30,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"musicianId":{"anyOf":[{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},{"type":"string","const":""}]},"name":{"type":"string","maxLength":300},"instrument":{"type":"string","maxLength":300},"confirmed":{"type":"boolean"},"musicSent":{"type":"boolean"},"contractRequired":{"type":"boolean"},"signed":{"type":"boolean"},"paid":{"type":"boolean"},"fee":{"type":"number","minimum":0,"maximum":10000000},"notes":{"type":"string","maxLength":10000}},"required":["id","musicianId","name","instrument","confirmed","musicSent","contractRequired","signed","paid","fee","notes"]}},"repertoire":{"maxItems":150,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"pieceId":{"anyOf":[{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},{"type":"string","const":""}]},"title":{"type":"string","maxLength":300},"moment":{"type":"string","maxLength":300},"status":{"type":"string","enum":["Requested","Needs arranging","Available","Approved","Not Applicable"]},"notes":{"type":"string","maxLength":10000}},"required":["id","pieceId","title","moment","status","notes"]}},"finance":{"type":"object","properties":{"performance":{"type":"number","minimum":0,"maximum":10000000,"multipleOf":0.01},"travel":{"type":"number","minimum":0,"maximum":10000000,"multipleOf":0.01},"arrangements":{"type":"number","minimum":0,"maximum":10000000,"multipleOf":0.01},"otherCharges":{"type":"number","minimum":0,"maximum":10000000,"multipleOf":0.01},"depositRequired":{"type":"number","minimum":0,"maximum":10000000,"multipleOf":0.01},"depositReceived":{"type":"boolean"},"depositAmount":{"type":"number","minimum":0,"maximum":10000000,"multipleOf":0.01},"depositDate":{"type":"string","format":"horizon-date","minLength":0},"finalReceived":{"type":"number","minimum":0,"maximum":10000000,"multipleOf":0.01},"finalDate":{"type":"string","format":"horizon-date","minLength":0},"invoiceReference":{"type":"string","maxLength":300},"invoiceSent":{"type":"boolean"},"otherCosts":{"type":"number","minimum":0,"maximum":10000000,"multipleOf":0.01}},"required":["performance","travel","arrangements","otherCharges","depositRequired","depositReceived","depositAmount","depositDate","finalReceived","finalDate","invoiceReference","invoiceSent","otherCosts"]},"milestones":{"type":"object","properties":{"responded":{"type":"string","format":"horizon-date","minLength":0},"welcomeSent":{"type":"string","format":"horizon-date","minLength":0},"finalConfirmed":{"type":"string","format":"horizon-date","minLength":0},"thankYouSent":{"type":"string","format":"horizon-date","minLength":0},"reviewRequested":{"type":"string","format":"horizon-date","minLength":0}},"required":["responded","welcomeSent","finalConfirmed","thankYouSent","reviewRequested"]},"communicationLog":{"maxItems":500,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"date":{"type":"string","format":"horizon-date","minLength":10},"recipient":{"type":"string","maxLength":300},"summary":{"type":"string","minLength":1,"maxLength":10000}},"required":["id","date","recipient","summary"]}},"tasks":{"maxItems":500,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"title":{"type":"string","minLength":1,"maxLength":300},"kind":{"type":"string","enum":["Task","Communication"]},"dueDate":{"type":"string","format":"horizon-date","minLength":10},"assignee":{"type":"string","maxLength":300},"recipient":{"type":"string","maxLength":300},"notes":{"type":"string","maxLength":10000},"done":{"type":"boolean"},"completedAt":{"type":"string","format":"horizon-date","minLength":0}},"required":["id","title","kind","dueDate","assignee","recipient","notes","done","completedAt"]}}},"required":["id","code","revision","name","eventDate","eventType","ensemble","durationMinutes","area","address","source","notes","createdDate","archived","archiveReason","details","contacts","musicians","repertoire","finance","milestones","communicationLog","tasks"]},"settings":{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"revision":{"type":"integer","minimum":0,"maximum":9007199254740991},"internalWeeks":{"type":"integer","minimum":0,"maximum":104},"musiciansWeeks":{"type":"integer","minimum":0,"maximum":104},"repertoireWeeks":{"type":"integer","minimum":0,"maximum":104},"arrangementsWeeks":{"type":"integer","minimum":0,"maximum":104},"rehearsalWeeks":{"type":"integer","minimum":0,"maximum":104},"finalWeeks":{"type":"integer","minimum":0,"maximum":104},"finalCheckWeeks":{"type":"integer","minimum":0,"maximum":104},"paymentWeeks":{"type":"integer","minimum":0,"maximum":104},"responseDays":{"type":"integer","minimum":0,"maximum":30},"depositFollowupDays":{"type":"integer","minimum":0,"maximum":90},"postEventDays":{"type":"integer","minimum":0,"maximum":90},"readyRequiresPayment":{"type":"boolean"},"defaultsReviewed":{"type":"boolean"}},"required":["revision","internalWeeks","musiciansWeeks","repertoireWeeks","arrangementsWeeks","rehearsalWeeks","finalWeeks","finalCheckWeeks","paymentWeeks","responseDays","depositFollowupDays","postEventDays","readyRequiresPayment","defaultsReviewed"],"additionalProperties":false},"musician":{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"revision":{"type":"integer","minimum":0,"maximum":9007199254740991},"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"name":{"type":"string","minLength":1,"maxLength":300},"instrument":{"type":"string","maxLength":300},"email":{"anyOf":[{"type":"string","format":"email","pattern":"^(?:[A-Za-z0-9_''+\\-]+\\.)*[A-Za-z0-9_''+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$"},{"type":"string","const":""}]},"phone":{"type":"string","maxLength":300},"notes":{"type":"string","maxLength":10000}},"required":["revision","id","name","instrument","email","phone","notes"]},"piece":{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"revision":{"type":"integer","minimum":0,"maximum":9007199254740991},"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"title":{"type":"string","minLength":1,"maxLength":300},"artist":{"type":"string","maxLength":300},"musicUrl":{"anyOf":[{"type":"string","format":"uri"},{"type":"string","const":""}]},"genre":{"default":"","type":"string","enum":["","Classical","Traditional","Pop / vocal","Jazz","Film / game music","Contemporary – rock","Contemporary – pop","Musical theatre","Folk / acoustic","Sacred / religious","Other"]},"weddingSuitable":{"default":"Unreviewed","type":"string","enum":["Unreviewed","Yes","No"]},"notes":{"type":"string","maxLength":10000}},"required":["revision","id","title","artist","musicUrl","notes"]}}'::jsonb -> kind;
$schema$;
-- END GENERATED RECORD SCHEMAS

-- This validator deliberately supports only the schema keywords emitted by the
-- committed model generator. No client-supplied schema or SQL is ever executed.
create function hs_mcp_private.valid_json(p_value jsonb, spec jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare k text; v jsonb; rule jsonb; t text:=jsonb_typeof(p_value); s text; n numeric; units integer;
begin
  if p_value is null or spec is null then return false; end if;
  if spec ? 'anyOf' then
    for rule in select * from jsonb_array_elements(spec->'anyOf') loop
      if hs_mcp_private.valid_json(p_value,rule) then return true; end if;
    end loop;
    return false;
  end if;
  if spec ? 'const' and p_value is distinct from spec->'const' then return false; end if;
  if spec ? 'enum' and not exists(select 1 from jsonb_array_elements(spec->'enum') a where a=p_value) then return false; end if;
  if spec ? 'type' and t is distinct from (case when spec->>'type'='integer' then 'number' else spec->>'type' end) then return false; end if;
  if t='object' then
    for k in select jsonb_array_elements_text(coalesce(spec->'required','[]'::jsonb)) loop
      if not p_value ? k then return false; end if;
    end loop;
    for k,v in select * from jsonb_each(p_value) loop
      if spec ? 'propertyNames' and not hs_mcp_private.valid_json(to_jsonb(k),spec->'propertyNames') then return false; end if;
      rule:=spec->'properties'->k;
      if rule is null then
        if spec->'additionalProperties'='false'::jsonb then return false; end if;
        rule:=case when jsonb_typeof(spec->'additionalProperties')='object' then spec->'additionalProperties' else '{}'::jsonb end;
      end if;
      if not hs_mcp_private.valid_json(v,rule) then return false; end if;
    end loop;
  elsif t='array' then
    if spec ? 'maxItems' and jsonb_array_length(p_value)>(spec->>'maxItems')::integer then return false; end if;
    for v in select * from jsonb_array_elements(p_value) loop
      if not hs_mcp_private.valid_json(v,spec->'items') then return false; end if;
    end loop;
  elsif t='string' then
    s:=p_value#>>'{}';
    -- JavaScript/Zod lengths count UTF-16 units, not Postgres code points.
    units:=length(s);
    if octet_length(s)<>units then
      select units+count(*)::integer into units from regexp_split_to_table(s,'') c where ascii(c)>65535;
    end if;
    if spec ? 'maxLength' and units>(spec->>'maxLength')::integer then return false; end if;
    if spec ? 'minLength' and (units<(spec->>'minLength')::integer or ((spec->>'minLength')::integer>0 and
      btrim(s,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')='')) then return false; end if;
    if spec ? 'pattern' and s !~ (spec->>'pattern') then return false; end if;
    if spec->>'format'='horizon-date' and s<>'' then
      if s !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char(s::date,'YYYY-MM-DD')<>s then return false; end if;
    elsif spec->>'format'='uri' then
      -- Conservative HTTP(S) catalogue URLs: ASCII DNS/IPv4 host, no credentials.
      if s !~ '^https?://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' then return false; end if;
      if substring(s from '^https?://[^/:?#]+:([0-9]+)')::integer>65535 then return false; end if;
      k:=substring(s from '^https?://([^/:?#]+)');
      if k ~ '^[0-9.]+$' then perform k::inet; end if;
    end if;
  elsif t='number' then
    n:=(p_value#>>'{}')::numeric;
    if abs(n)>1.7976931348623157e308 then return false; end if;
    if spec->>'type'='integer' and trunc(n)<>n then return false; end if;
    if spec ? 'minimum' and n<(spec->>'minimum')::numeric then return false; end if;
    if spec ? 'maximum' and n>(spec->>'maximum')::numeric then return false; end if;
    if spec ? 'exclusiveMinimum' and n<=(spec->>'exclusiveMinimum')::numeric then return false; end if;
    if spec ? 'multipleOf' and mod(n,(spec->>'multipleOf')::numeric)<>0 then return false; end if;
  end if;
  return true;
exception when others then return false;
end;
$$;

create function hs_mcp_private.assert_record(kind text, p_value jsonb) returns void
language plpgsql stable set search_path='' as $$
declare today text:=to_char(now() at time zone 'Australia/Sydney','YYYY-MM-DD'); v jsonb; k text;
begin
  if not hs_mcp_private.valid_json(p_value,hs_mcp_private.record_schema(kind)) then
    raise exception 'Invalid persisted record' using errcode='22023';
  end if;
  if kind='settings' then
    if (p_value->>'internalWeeks')::integer<(p_value->>'finalWeeks')::integer or
      (p_value->>'finalWeeks')::integer<(p_value->>'finalCheckWeeks')::integer then
      raise exception 'Invalid workflow timing' using errcode='22023';
    end if;
  elsif kind='event' then
    if p_value->>'createdDate'>today then raise exception 'Invalid creation date' using errcode='22023'; end if;
    for v in select x from jsonb_each(p_value->'details') a(k,x) loop
      if v->>'state'='Deferred' and v->>'dueDate'='' and v->>'trigger'='' then
        raise exception 'Deferred detail needs a date or trigger' using errcode='22023';
      end if;
    end loop;
    for v in select x from jsonb_each(p_value->'milestones') a(k,x)
      union all select p_value->'finance'->'depositDate'
      union all select p_value->'finance'->'finalDate'
      union all select x->'date' from jsonb_array_elements(p_value->'communicationLog') x
      union all select x->'completedAt' from jsonb_array_elements(p_value->'tasks') x loop
      if v#>>'{}'>today then raise exception 'Completed action is in the future' using errcode='22023'; end if;
    end loop;
    if ((p_value->'finance'->>'depositReceived')::boolean and
        ((p_value->'finance'->>'depositAmount')::numeric<=0 or p_value->'finance'->>'depositDate'='')) or
      ((p_value->'finance'->>'finalReceived')::numeric>0 and p_value->'finance'->>'finalDate'='') then
      raise exception 'Received payment needs amount and date' using errcode='22023';
    end if;
    for k in select unnest(array['contacts','tasks','musicians','repertoire','communicationLog']) loop
      if exists(select 1 from jsonb_array_elements(p_value->k) x group by x->>'id' having count(*)>1) then
        raise exception 'Duplicate item identifiers' using errcode='22023';
      end if;
    end loop;
  end if;
end;
$$;
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
    perform hs_mcp_private.assert_record('settings',p_record);
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
    perform hs_mcp_private.assert_record(case when op='save_musician' then 'musician' else 'piece' end,p_record);
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
    p_record:=jsonb_build_object('deletedAt','')||p_record;
    p_record:=jsonb_set(p_record,'{operational}',
      '{"timing":{},"venueSetup":{},"wetWeather":{},"onDayContact":{},"repertoireBrief":{},"rehearsal":{},"logistics":{},"runSheet":{}}'::jsonb
      ||coalesce(p_record->'operational','{}'::jsonb));
    eid:=(p_command->>'id')::uuid;
    -- Prevent a competing create from becoming a replacement update.
    perform pg_advisory_xact_lock(hashtextextended('horizon-event:'||eid::text,0));
    perform 1 from public.hs_events where id=eid for update;
    before_record:=public.hs_get_event(eid);
    -- Match the model's defaults for older events saved with operational={};
    -- normalisation must not make unrelated, valid edits fail comparison.
    if before_record is not null then
      before_record:=jsonb_build_object('deletedAt','')||before_record;
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
        or p_record->>'revision'<>'0' or p_record->>'archived'<>'false' or coalesce(p_record->>'deletedAt','')<>''
        or p_record->'finance' is distinct from '{"performance":0,"travel":0,"arrangements":0,"otherCharges":0,"depositRequired":400,"depositReceived":false,"depositAmount":400,"depositDate":"","finalReceived":0,"finalDate":"","invoiceReference":"","invoiceSent":false,"otherCosts":0}'::jsonb
        or p_record->'contacts'<>'[]'::jsonb or p_record->'tasks'<>'[]'::jsonb
        or p_record->'musicians'<>'[]'::jsonb or p_record->'repertoire'<>'[]'::jsonb
        or p_record->'communicationLog'<>'[]'::jsonb then
        raise exception 'Invalid new event' using errcode='22023';
      end if;
    else
      if before_record is null or before_record->>'archived'='true' or before_record->>'deletedAt'<>'' then raise exception 'Event unavailable' using errcode='22023'; end if;
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
    perform hs_mcp_private.assert_record('event',p_record);
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
