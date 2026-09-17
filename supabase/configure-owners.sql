-- After the V1 migration and creation of both confirmed Auth password users.
-- Replace the two placeholders. This does not create or email users.
begin;
do $$
declare owner_one text := 'REPLACE_OWNER_ONE_EMAIL';
        owner_two text := 'REPLACE_OWNER_TWO_EMAIL';
        matched integer;
begin
  if owner_one like 'REPLACE_%' or owner_two like 'REPLACE_%' or lower(owner_one)=lower(owner_two) then
    raise exception 'Set two distinct owner email addresses first';
  end if;
  select count(*) into matched from auth.users where lower(email) in (lower(owner_one),lower(owner_two)) and email_confirmed_at is not null;
  if matched <> 2 then raise exception 'Both confirmed accounts must exist in Authentication > Users first'; end if;
  insert into public.hs_owners(user_id,display_name)
  select id, case when lower(email)=lower(owner_one) then 'Owner 1' else 'Owner 2' end
  from auth.users where lower(email) in (lower(owner_one),lower(owner_two))
  on conflict (user_id) do nothing;
end $$;
commit;
