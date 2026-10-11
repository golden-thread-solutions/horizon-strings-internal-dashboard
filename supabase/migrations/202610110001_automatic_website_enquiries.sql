-- Automatically convert new website submissions when an owner loads the dashboard.
-- Earlier enquiries retain their existing manual conversion workflow.
begin;

create table if not exists public.hs_website_enquiry_sync (
  id integer primary key check (id = 1),
  enabled_from timestamptz not null default now()
);
alter table public.hs_website_enquiry_sync enable row level security;
revoke all on public.hs_website_enquiry_sync from public, anon, authenticated;
grant select on public.hs_website_enquiry_sync to authenticated;
drop policy if exists hs_owner_read_enquiry_sync on public.hs_website_enquiry_sync;
create policy hs_owner_read_enquiry_sync on public.hs_website_enquiry_sync
  for select to authenticated using (public.hs_is_owner());
insert into public.hs_website_enquiry_sync(id) values (1) on conflict do nothing;

create or replace function public.hs_sync_and_load_workspace()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare enquiry_id uuid;
begin
  if not public.hs_is_owner() then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  for enquiry_id in
    select e.id from public.website_enquiries e
    join public.hs_website_enquiry_sync s on s.id = 1
    where e.created_at >= s.enabled_from
      and e.dashboard_event_id is null
      and e.dashboard_status = 'new'
    order by e.created_at, e.id
  loop
    -- Conversion locks the submission and returns its existing event on retries.
    perform public.hs_convert_website_enquiry(enquiry_id);
  end loop;
  return public.hs_load_workspace();
end;
$$;
revoke all on function public.hs_sync_and_load_workspace() from public, anon;
grant execute on function public.hs_sync_and_load_workspace() to authenticated;
commit;
