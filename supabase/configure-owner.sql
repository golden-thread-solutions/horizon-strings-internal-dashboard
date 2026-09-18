-- Run after creating one confirmed Supabase Auth user.
-- Replace the email only; this does not create users or send email.
begin;
do $$
declare owner_email text := 'REPLACE_OWNER_EMAIL';
declare matched integer;
begin
  if owner_email like 'REPLACE_%' then
    raise exception 'Set the confirmed owner email first';
  end if;
  select count(*) into matched
  from auth.users
  where lower(email) = lower(owner_email)
    and email_confirmed_at is not null;
  if matched <> 1 then
    raise exception 'The confirmed Auth account must exist first';
  end if;
  insert into public.hs_owners(user_id, display_name)
  select id, 'Owner'
  from auth.users
  where lower(email) = lower(owner_email)
  on conflict (user_id) do nothing;
end $$;
commit;
