-- Read-only OAuth delegation. Apply only after inspecting the existing Auth hook.
-- No clients are enabled by this migration. No production records are changed.
begin;
create table public.hs_mcp_clients (
  client_id text primary key check (length(client_id) between 1 and 2000),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (length(label) between 1 and 300),
  resource_url text not null check (resource_url ~ '^https://[^/]+/mcp$' or resource_url ~ '^http://(localhost|127[.]0[.]0[.]1)(:[0-9]+)?/mcp$'),
  enabled boolean not null default false
);
alter table public.hs_mcp_clients enable row level security;
revoke all on public.hs_mcp_clients from public, anon, authenticated;

-- Existing invoker RPCs and the security-definer enquiry converter all consult
-- hs_is_owner. OAuth tokens are never human dashboard sessions, even for owners.
create or replace function public.hs_is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select nullif(auth.jwt()->>'client_id','') is null
    and exists(select 1 from public.hs_owners where user_id=auth.uid());
$$;
drop policy if exists owner_reads_self on public.hs_owners;
create policy owner_reads_self on public.hs_owners for select to authenticated
  using (user_id=(select auth.uid()) and nullif(auth.jwt()->>'client_id','') is null);

-- Narrow definer exception: callers cannot read grants, owners or Auth sessions
-- directly. Only this predicate and the bounded-purpose reader use that power.
create function public.hs_mcp_can_read() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.jwt()->>'role' = 'authenticated'
    and coalesce(auth.jwt()->>'is_anonymous','false') = 'false'
    and exists(select 1 from public.hs_owners where user_id=auth.uid())
    and exists(select 1 from public.hs_mcp_clients c
      where c.client_id=auth.jwt()->>'client_id' and c.user_id=auth.uid()
        and c.enabled and c.resource_url=auth.jwt()->>'aud')
    and exists(select 1 from auth.sessions s
      where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid()
        and (s.not_after is null or s.not_after>now()));
$$;
revoke all on function public.hs_mcp_can_read() from public, anon;
grant execute on function public.hs_mcp_can_read() to authenticated;

-- The only delegated data RPC. No sync/conversion or writes occur here.
-- Its definer context allows hs_get_event (still invoker) to assemble child rows;
-- normal callers of hs_get_event remain subject to the existing owner RLS.
create function public.hs_mcp_read_workspace() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not coalesce(public.hs_mcp_can_read(),false) then
    raise exception 'Horizon MCP access denied' using errcode='42501';
  end if;
  select workspace into result from (
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
      ) recent
    ),'[]'::jsonb)
  ) as workspace
  ) data;
  return result;
end;
$$;
revoke all on function public.hs_mcp_read_workspace() from public, anon;
grant execute on function public.hs_mcp_read_workspace() to authenticated;

-- Bind only explicitly approved clients to their exact MCP audience. Unknown
-- clients keep their original audience and cannot use Horizon RPCs or tables.
create function public.hs_mcp_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare resource text;
  cid text:=coalesce(event->>'client_id',event->'claims'->>'client_id');
begin
  select resource_url into resource from public.hs_mcp_clients c
    where c.client_id=cid and c.user_id::text=event->>'user_id' and c.enabled;
  if resource is not null then event:=jsonb_set(event,'{claims,aud}',to_jsonb(resource)); end if;
  return event;
end;
$$;
revoke all on function public.hs_mcp_token_hook(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hs_mcp_token_hook(jsonb) to supabase_auth_admin;
commit;
