-- Owner-only recoverable deletion; no customer records are changed by this migration.
begin;
alter table public.hs_events add column "deletedAt" text not null default '';

create function public.hs_set_event_deleted(p_id uuid, p_revision integer, p_deleted boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved_revision integer;
begin
  if not public.hs_is_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
  update public.hs_events set "deletedAt"=case when p_deleted then now()::text else '' end,
    revision=revision+1, "updatedAt"=now(), "updatedBy"=auth.uid()
  where id=p_id and revision=p_revision
    and ((p_deleted and "deletedAt"='') or (not p_deleted and "deletedAt"<>''))
  returning revision into saved_revision;
  if not found then raise exception 'Event changed. Reload before deleting or restoring.' using errcode='40001'; end if;
  insert into public.hs_audit(event_id,revision) values(p_id,saved_revision);
  return public.hs_get_event(p_id);
end $$;
revoke all on function public.hs_set_event_deleted(uuid,integer,boolean) from public, anon;
grant execute on function public.hs_set_event_deleted(uuid,integer,boolean) to authenticated;

-- An old editor, including a direct save RPC, cannot edit a trashed event.
create function public.hs_guard_trashed_event() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if old."deletedAt"<>'' and new."deletedAt"<>'' then
    raise exception 'Restore this event from Trash before editing.' using errcode='40001';
  end if;
  return new;
end $$;
revoke all on function public.hs_guard_trashed_event() from public, anon, authenticated;
create trigger hs_guard_trashed_event before update on public.hs_events
for each row execute function public.hs_guard_trashed_event();

-- Assignment directory only: these rows never grant owner/Auth membership.
create table public.hs_people (
 id uuid primary key, revision integer not null default 1 check(revision>0),
 name text not null check(length(trim(name)) between 1 and 300), active boolean not null default true
);
create unique index hs_people_unique_name on public.hs_people(lower(name));
insert into public.hs_people(id,name) values (gen_random_uuid(),'Koby'),(gen_random_uuid(),'Mia');
create table public.hs_general_tasks (
 id uuid primary key, revision integer not null default 1 check(revision>0),
 title text not null check(length(trim(title)) between 1 and 300),
 kind text not null check(kind in ('Task','Communication')),
 "dueDate" text not null check("dueDate" ~ '^\d{4}-\d{2}-\d{2}$'),
 assignee text not null default '', recipient text not null default '', notes text not null default '',
 done boolean not null default false, "completedAt" text not null default '',
 check((done and "completedAt"<>'') or (not done and "completedAt"=''))
);
create table public.hs_work_audit (
 id bigint generated always as identity primary key, record_id uuid not null,
 kind text not null check(kind in ('person','task')), revision integer not null,
 changed_by uuid not null default auth.uid(), changed_at timestamptz not null default now()
);
alter table public.hs_people enable row level security;
alter table public.hs_general_tasks enable row level security;
alter table public.hs_work_audit enable row level security;
revoke all on public.hs_people, public.hs_general_tasks, public.hs_work_audit from public, anon, authenticated;
grant select, insert, update on public.hs_people, public.hs_general_tasks to authenticated;
grant select, insert on public.hs_work_audit to authenticated;
grant usage, select on sequence public.hs_work_audit_id_seq to authenticated;
create policy owners_only on public.hs_people for all to authenticated using ((select public.hs_is_owner())) with check ((select public.hs_is_owner()));
create policy owners_only on public.hs_general_tasks for all to authenticated using ((select public.hs_is_owner())) with check ((select public.hs_is_owner()));
create policy owners_read on public.hs_work_audit for select to authenticated using ((select public.hs_is_owner()));
create policy owners_append on public.hs_work_audit for insert to authenticated with check ((select public.hs_is_owner()) and changed_by=(select auth.uid()));

create function public.hs_save_person(p_record jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.hs_people; result public.hs_people;
begin
 if not public.hs_is_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
 p:=jsonb_populate_record(null::public.hs_people,p_record);
 if p.revision=0 then
  insert into public.hs_people(id,name,active) values(p.id,trim(p.name),p.active) returning * into result;
 else
  update public.hs_people set name=trim(p.name),active=p.active,revision=revision+1
   where id=p.id and revision=p.revision returning * into result;
  if not found then raise exception 'Person changed. Reload before saving.' using errcode='40001'; end if;
 end if;
 insert into public.hs_work_audit(record_id,kind,revision) values(result.id,'person',result.revision);
 return to_jsonb(result);
end $$;
revoke all on function public.hs_save_person(jsonb) from public, anon;
grant execute on function public.hs_save_person(jsonb) to authenticated;

create function public.hs_save_general_task(p_record jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.hs_general_tasks; result public.hs_general_tasks; prior_assignee text;
begin
 if not public.hs_is_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
 t:=jsonb_populate_record(null::public.hs_general_tasks,p_record);
 if t.revision>0 then
  select assignee into prior_assignee from public.hs_general_tasks where id=t.id and revision=t.revision for update;
  if not found then raise exception 'Task changed. Reload before saving.' using errcode='40001'; end if;
 end if;
 if t.assignee<>'' and t.assignee is distinct from prior_assignee
   and not exists(select 1 from public.hs_people where id::text=t.assignee and active) then
  raise exception 'Choose an active person for this task.' using errcode='22023';
 end if;
 if t.revision=0 then
  insert into public.hs_general_tasks(id,title,kind,"dueDate",assignee,recipient,notes,done,"completedAt")
  values(t.id,trim(t.title),t.kind,t."dueDate",t.assignee,t.recipient,t.notes,t.done,t."completedAt") returning * into result;
 else
  update public.hs_general_tasks set title=trim(t.title),kind=t.kind,"dueDate"=t."dueDate",assignee=t.assignee,
   recipient=t.recipient,notes=t.notes,done=t.done,"completedAt"=t."completedAt",revision=revision+1
   where id=t.id and revision=t.revision returning * into result;
 end if;
 insert into public.hs_work_audit(record_id,kind,revision) values(result.id,'task',result.revision);
 return to_jsonb(result);
end $$;
revoke all on function public.hs_save_general_task(jsonb) from public, anon;
grant execute on function public.hs_save_general_task(jsonb) to authenticated;
create or replace function public.hs_load_workspace() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'people', coalesce((select jsonb_agg(to_jsonb(p) order by name) from public.hs_people p),'[]'::jsonb),
    'generalTasks', coalesce((select jsonb_agg(to_jsonb(t) order by "dueDate",id) from public.hs_general_tasks t),'[]'::jsonb),
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


commit;
