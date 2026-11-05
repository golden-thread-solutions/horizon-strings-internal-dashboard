-- Safe capability rollback, not a destructive schema downgrade.
-- Run through the separately authorised release route, then roll back the app.
begin;
update hs_mcp_private.control set writes_enabled=false where id;
update public.hs_mcp_clients set write_enabled=false;
revoke execute on function public.hs_mcp_mutate(jsonb) from authenticated;
commit;
-- Keep OAuth-denying owner policies, reader, directory revision triggers,
-- client registry, consent and retry evidence. Never replay the initial schema.
-- Recovery requires re-review and an explicit GRANT EXECUTE plus activation.
