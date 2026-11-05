-- Administrator only. Immediate database kill switch; preserves approved reads,
-- ordinary owner editing, receipts, activity and all operational records.
begin;
update hs_mcp_private.control set writes_enabled=false where id;
commit;
