# Horizon Strings dashboard MCP

Status: the GTS task note records the read-only release, production activation and personal ChatGPT connection on 30 October 2026, using production source `7f85db140069aafc81d5c1c57b8530c1325a7eb8` (PR #8). Hosted refresh/revocation and full account-side data-tool acceptance remain unverified in that note. The read-write extension below is a new review candidate; it has not been deployed or enabled. GTS task `369f0674-a0f7-4a5e-99f7-4961764607e7` belongs to **Horizon Strings Dashboard**.

## Read-write extension — 30 October 2026

Koby requested read-write support using the delegated-dashboard note. The existing eight read tools remain. When `MCP_ENABLE_WRITES=true`, a ninth tool, `change_record`, accepts an allowlisted command:

- `create_event`: provide a stable UUID, name, expectedRevision 0 and requestId. Uses the dashboard's existing name-only enquiry defaults, including its unchanged deposit defaults.
- `update_event`: patch name/date/type/ensemble/duration/location/source/notes, resolution details, operational fields or recorded milestones. Nested objects merge; unspecified fields remain saved as before. Read `get_event` first and use its revision.
- `set_event_item`: add/update exactly one contact, manual task, recorded communication, musician assignment or repertoire item by its stable item ID. Supply all editable fields for that item, the event ID and the event revision. All other items are preserved. Assignment fees and paid status cannot be edited.
- `save_musician` / `save_piece`: create or update one directory record, supplying all editable fields. Use its returned revision, or 0 for a new stable UUID. Directory revisions advance for ordinary dashboard edits too.
- `update_settings`: patch workflow fields against the revision from `get_settings`.

Financial edits, deletion, archiving/restoration, enquiry conversion, file contents and outbound messages are excluded, following the note's non-deleting operational write pattern. Financial reads remain available. A communication record documents an action already taken; it does not send anything. Archived events must be restored through the dashboard before editing. Derived stages/actions are recalculated from the saved source records.

Every write requires BOTH the application environment switch and the connection's admin-managed `hs_mcp_clients.write_enabled` flag. Existing client rows default to false. Database functions independently recheck client, owner, exact resource audience and active session; raw tables, ordinary owner RPCs, the registry, private saver and receipt/activity tables remain inaccessible to OAuth callers. Environment flags govern the application endpoint; the database grant independently governs direct RPC calls.

Local verification: Node 24 type generation/typecheck, all 27 synthetic tests and the production build pass. The actual service is exercised against embedded PostgreSQL for each write variant. Tests cover gate denial, exact retry receipts after later edits, changed-command rejection, revision conflicts including human directory edits, child-item preservation, financial/archive denial, private/raw-table access denial, rollback after a failed child constraint and old events with empty operational objects. Real-handler tests verify eight tools when writes are off and the ninth write tool/annotations/calls when on. This is local evidence; hosted security advisors, actual target-account writes, OAuth refresh/revocation and a live write rollout have not been performed for this candidate.

The command, stable requestId, actor and client bind a retry receipt. Do not change requestId after an uncertain result: retry the exact command. A changed command with the same requestId is rejected. An exact retry returns the original result even after later edits; reread for current state. Conflicts require a fresh read and a reconsidered command with a new requestId. The database checks revisions under locks and commits the record, activity metadata and receipt together. Receipts contain private command/result data and have no automatic expiry in this candidate; keep them restricted and include them in backup/retention planning.

The new migration adds a private copy of the existing atomic event saver with a delegated-write guard. The public human saver and `hs_is_owner` remain unchanged. The writer compares the candidate against the exact command/current record before invoking that private saver. Keep these implementations aligned if the event save contract changes. No shared secret or service-role key is introduced.

### Release checklist for the authorised release route

1. Review and test the candidate against current main. Rehearse `20261029214158_horizon_readwrite_mcp.sql` after the read-only migration on isolated Supabase; run security advisors. Local PGlite tests are not a hosted advisor/OAuth check.
2. Apply the additive migration with all existing clients still read-only. Do not reapply the old read-only migration. Check existing reads and ordinary owner edits, including directory revision increments. Back up first.
3. Deploy reviewed source with `MCP_ENABLE_WRITES=false`. The eight-tool read contract stays available. The consent page explains optional owner-enabled writes.
4. For the intended connection, explicitly review the write scope and complete/reconfirm owner consent before enabling its write grant. Existing OAuth consent may redirect immediately; do not treat an old read-only consent or a successful token refresh as approval of the broader scope. Reauthorise/revoke the previous grant as required by the host. Preserve the existing client, callback and audience unless the host requires a replacement.
5. Enable `write_enabled=true` only for the approved client/owner/resource row, set `MCP_ENABLE_WRITES=true` in the intended deployment, and use the authorised release route to redeploy. Refresh the personal ChatGPT plugin's tool definitions and confirm nine tools, including the non-read-only `change_record`.
6. With isolated synthetic records and explicit test authority, verify all write variants, exact retries, changed-payload retry denial, stale revisions, ordinary human edit conflicts, client/session/owner revocation, financial/deletion/archive denial and preserved website enquiries. Verify actual connected-account calls and hosted OAuth refresh/revocation; do not test by changing client records.

For recovery, set that client's `write_enabled=false` to stop mutations while keeping reads. Disabling the application write switch also requires an authorised redeploy. Retain OAuth-denying RLS, additive directory revisions, receipts and activity during rollback. An older frontend remains compatible with the directory revision triggers. Retain the existing read-only shutdown procedure below for complete revocation.

## Coverage

Eight tools: `list_events`, `get_event`, `list_actions`, `list_directory`, `list_website_enquiries`, `get_settings`, `search`, `fetch`. Event detail includes contacts, operational details/applicability markers, notes, musician assignments, repertoire, finances, recorded communications and manual tasks. Stages, readiness and pending actions use the existing workflow. Archives are available through an explicit list option and search. Catalogue music URLs are returned as saved information; linked files and external inboxes are not downloaded.

Read access includes private client/contact and financial information; the owner must trust the connected account and workspace. Records are source data, never instructions. Read tools never edit/delete/archive records, convert website enquiries or send messages. Reads call only `hs_mcp_read_workspace`, never the normal loader that automatically converts new enquiries. No OpenAI API key or new hosted service is required.

## Security design

- Preserve the existing Next.js/Vercel dashboard and Supabase project. Proposed endpoint after release: `https://horizon-strings-internal-dashboard-kappa.vercel.app/mcp`.
- Use remote Streamable HTTP, OAuth authorization-code with S256 PKCE, registered clients, individual owner authentication and explicit consent. Keep dynamic registration and public signup disabled. A different ChatGPT login does not require a new Horizon owner: authenticate with an existing authorised Horizon identity.
- JWT validation checks signature, issuer, exact resource audience, subject, client, expiry, issued-at and session ID. ES256/RS256 only. Discovery and each call require an enabled database grant; authenticated services are never shared between requests.
- The migration introduces an admin-managed `hs_mcp_clients` registry. Each row binds one OAuth client to one owner and one resource URL, disabled by default. Public/anonymous/authenticated callers cannot access the registry table.
- `hs_is_owner` rejects OAuth clients, preventing their use of existing owner table policies and write RPCs, including the security-definer enquiry converter. Ordinary owner dashboard sessions retain existing access. Inspect other consumers of this function before release.
- `hs_mcp_read_workspace` is a narrow SECURITY DEFINER exception. Before assembling the existing event projections, it checks registered client, owner membership, audience and the active `auth.sessions` row. The existing invoker `hs_get_event` executes inside this guarded definer context; outside it, existing RLS applies. Callers cannot choose SQL, tables, projections or arbitrary URLs.
- `hs_mcp_token_hook` binds approved clients to the resource audience. Only `supabase_auth_admin` can execute it. Compose it with any existing hook rather than silently replacing one. This Supabase project also serves the separate public website.
- Metadata contains no business records. Data responses use no-store caching; request bodies have a streamed 32 KiB cap. `MCP_ENABLED` defaults off. No shared bearer secret, service-role key, management access or SQL tool is exposed.

## Original read-only installation checklist (historical)

The writer prepares/tests the branch and PR. A separate authorised release route performs production activation.

1. Inspect deployed migrations, Auth configuration, signing keys, existing token hook, RLS and `hs_is_owner` consumers. Rehearse on isolated Supabase with synthetic data; run security advisors there. Preserve a backup and application rollback candidate. Writer preparation does not change production records or configuration.
2. Apply `supabase/migrations/20261028202257_horizon_readonly_mcp.sql` after the existing three dashboard migrations. It enables no clients. The filename timestamp was generated by the CLI in UTC. Vercel does not apply SQL automatically.
3. Enable Supabase OAuth 2.1 and asymmetric signing keys. Preserve the existing dashboard Site URL and set Authorization Path to `/oauth/consent`. Preserve website DNS, email and anonymous enquiry submission permissions.
4. In the intended other ChatGPT account, open Plugins → Add custom MCP server (or its available custom-connector UI). Obtain the actual OAuth redirect URI. Register a public client for that exact callback, with token endpoint auth method `none` and S256 PKCE. Account/workspace policies may restrict installation. Do not guess callback URLs or put passwords in ChatGPT.
5. Add the real client ID and existing Horizon owner UUID to `hs_mcp_clients`, with the exact HTTPS `/mcp` resource URL. Start disabled. Use the admin setup template below; do not substitute a shared/service key.
6. Enable/compose `public.hs_mcp_token_hook` as the Custom Access Token Hook. Inspect issued/refreshed claims without logging tokens; verify Supabase RPC accepts the resource audience. Configure `MCP_PUBLIC_ORIGIN=https://horizon-strings-internal-dashboard-kappa.vercel.app` and `MCP_ENABLED=true` only in the reviewed deployment. Give Preview its own origin/grant; never reuse the production audience there.
7. Enable the approved registry row after isolated acceptance. Enter the endpoint and registered OAuth client ID in the other ChatGPT account, then complete Horizon login and consent in the browser. The human completes credentials and consent. No token copying or release-credential switching is required.
8. Verify tool discovery, synthetic reads, pagination, complete event finance/details, enquiry reads without conversion, consent denial, token refresh and revocation from the actual target account. Client disablement, session termination and owner removal must stop access. Raw-table and mutation RPC calls must fail for OAuth; normal owner editing and public website enquiries must still work.
9. Refresh cached tools after schema changes. Keep the GTS task open until release and target-account acceptance; a code/build result alone is not a connected account.

```sql
-- Admin-only template; placeholders are not real IDs or credentials.
insert into public.hs_mcp_clients(client_id,user_id,label,resource_url,enabled)
values ('ACTUAL_OAUTH_CLIENT_ID','ACTUAL_EXISTING_OWNER_UUID'::uuid,
  'Approved ChatGPT connection',
  'https://horizon-strings-internal-dashboard-kappa.vercel.app/mcp',false);
```

## Verification and limitations

Use Node 24, `npm ci --ignore-scripts --no-audit --no-fund`, `npm run check`, `npm run build`. Tests use synthetic data, local signing keys and embedded PostgreSQL. Real-handler tests cover initialization, eight read-only tools, finance, unsupported writes, pagination/search/fetch and caller isolation. SQL tests apply the migration and check grants, blocked raw tables and mutation/conversion RPCs, wrong audience, unknown clients, missing claims, client disablement, session termination, owner removal and preserved human reads. Existing website-sync/workflow tests remain in the suite.

For a local synthetic dashboard preview, leave Supabase variables blank and set `DASHBOARD_DEMO_MODE=true`. Test fixture URLs/keys exist only in tests. Do not expose a synthetic authentication bypass or use real customer records for testing. Consent has a separate shell and never mounts/synchronises the operational workspace.

The reader loads the small business dataset per call and tools paginate output (max 50). It includes all website submissions, unlike the UI loader's latest-100 limit. Future large datasets should move pagination/filtering into the guarded database reader. No large-scale performance claim is made.

Local tests do not verify a hosted Supabase OAuth server, real refresh/consent, Vercel or the other ChatGPT account. The original writer preparation did not activate production. Later read-only activation is recorded at the top of this document; it does not validate or activate this read-write candidate. Hosted security advisors for the new migration remain a release check.

## Revocation and recovery

Set a client's `enabled=false` for immediate reader rejection; revoke its OAuth grants/sessions or remove the owner membership as appropriate. `MCP_ENABLED=false` with an authorised redeploy disables the endpoint. Provider-side grant/token revocation remains a hosted acceptance check; this candidate checks active sessions and registry state on every database read, not an undocumented provider grant table.

Retain the registry and OAuth-denying owner predicate during application rollback. Do not restore the old predicate while OAuth tokens remain valid: a frontend rollback must not remove the database read-only boundary. Disable grants/endpoint and terminate issued sessions before separately reviewing hook/client removal. Never drop event tables or replay initial seed/migrations to roll back the application.

## Sources

- [Knob: delegated dashboard API and MCP access](https://github.com/golden-thread-solutions/golden-thread-knowledge/blob/23539bf43d9e299531205bba76fcb917772ab1e1/knowledge/notes/delegated-dashboard-mcp-access.md). Its GTS financial exclusions are project-specific; Horizon's owner-requested read coverage includes finance.
- [OpenAI authentication](https://developers.openai.com/plugins/build/auth) and [custom MCP connection](https://developers.openai.com/api/docs/guides/custom-mcp-server).
- [Supabase OAuth server setup](https://supabase.com/docs/guides/auth/oauth-server/getting-started) and [token security/RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security). Identity scopes do not restrict database access.
