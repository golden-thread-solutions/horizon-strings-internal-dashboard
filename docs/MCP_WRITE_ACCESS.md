# Authenticated operational MCP writes

This change extends the existing Horizon Strings MCP endpoint and OAuth client identity. It adds ten operational tools and preserves all eight readers, including financial information. It creates no replacement plugin, account, shared password or service-role path.

## Requirements and inspection

Sources: the owner's authenticated-write request; current `lib/model.ts`, event editor, board/Lost/Archive/Trash helpers, workflow, `app/api/workspace`, OAuth consent, MCP transport/service/auth, and all repository migrations. Product context: `docs/architecture.md`, `docs/workflow.md`, `docs/BOARD_AND_TASKS.md`, `docs/BOARD_DESIGN_AND_MOVES.md` and the workspace migration brief. Archived implementations are not requirements.

The baseline reader uses a delegated owner's token and an administrator-registered `hs_mcp_clients` row. `hs_is_owner` deliberately rejects OAuth identities; ordinary owner RLS and write routes remain separate. The guarded reader avoids the normal loader's website-enquiry conversion. Events already have revisions; directories previously did not. Board stages remain fact-derived. Lost/Archive use `archived` plus financial facts; Trash uses `deletedAt`.

Live inspection through the connected Supabase tool was denied (`You do not have permission to perform this action`). Browser inventory reported local browser use disabled in Work settings. Repository inspection and synthetic SQL rehearsal are evidence of the candidate, not evidence of the deployed schema, active client, backups or connected-account acceptance.

## Supported commands

| Tool | Mutation and revision boundary |
| --- | --- |
| `create_event` | New caller-supplied event UUID; expected revision zero; name required; optional operational patch |
| `update_event` | Latest event revision; patch identity/date/ensemble/area/address/source/notes, detail resolutions, individual operational fields and recorded milestones |
| `upsert_event_contact` | One full contact record, identified by UUID, with the latest parent event revision |
| `upsert_event_task` | One full event-linked task/communication action with the latest event revision |
| `record_event_communication` | One full recorded history entry with the latest event revision; sends nothing |
| `upsert_event_musician` | One full operational assignment; preserves existing fee/payment facts |
| `upsert_event_repertoire` | One full event repertoire entry; preserves siblings |
| `upsert_musician` | Create at revision zero or update at the latest directory revision |
| `upsert_piece` | Create at revision zero or update at the latest directory revision |
| `update_workflow_settings` | Patch timing/readiness settings at the latest settings revision |

For child tools, `id` is the event UUID, while `data.id` identifies the individual child. Omitted collection entries are never removed or replaced. A child UUID already belonging to another event is rejected. Nonempty directory references must exist. Collection limits match the dashboard model. Operational patches merge at group and field level; unedited valid legacy fields are retained.

Create-event financial defaults are server-owned: zero charges/received amounts, $400 required/recordable deposit, no receipt/payment flags. New assignments start with fee zero and unpaid; these defaults do not represent a negotiated fee or receipt of money. MCP never accepts financial fields, fees or payment flags as command input. Financial changes remain in the ordinary owner dashboard. Archived, Lost and trashed records are readable under existing read behavior but cannot be written by these tools. Nothing changes board move, archive, restore or Trash semantics.

General business tasks, People management, financial edits, deletion, archiving/restoration, website-enquiry conversion, downloads and message sending are excluded. A recorded communication does not imply it was sent now and does not automatically set milestones. Notes, links and retrieved record content remain untrusted source data, never execution instructions.

## Authentication, consent and switches

Every mutation calls `hs_mcp_can_write` inside the database. It composes the existing reader's owner membership, exact resource audience, enabled registered client, role and active Auth session checks with three independent requirements:

1. Database emergency switch `hs_mcp_private.control.writes_enabled=true`.
2. Client row `write_enabled=true`.
3. That row has the owner's current `operational-v1` consent and timestamp.

The application separately requires `MCP_WRITE_ENABLED=true`. Existing `MCP_ENABLED`, signing-key/issuer/audience validation, OAuth connection, plugin/server name and owner login are retained. The migration defaults every new gate off and grants no client writes. Merely deploying the application does not activate writing. Tools remain discoverable while disabled, returning a write-disabled/access-denied error when used.

`/settings/mcp` shows only the signed-in owner's registered clients, exact IDs and resources, explains the full scope and exclusions, and requires an unchecked acknowledgement before the owner records consent. It can revoke consent immediately without removing reads. The page bypasses the business workspace loader, so opening it cannot convert an enquiry. It requires an active ordinary owner session; delegated tokens cannot list clients, grant themselves consent or change administrative switches. Confirm the client ID in the intended existing ChatGPT account/workspace before consenting. The agent must not approve on the human's behalf.

OAuth tokens remain excluded from ordinary owner tables, conversion/sync functions, People/general-task RPCs, Trash RPCs and the normal `/api/workspace` write route. Only the narrowly scoped mutation function is a delegated write entry. Private helper schema, control, receipt and activity tables are inaccessible to `anon` and `authenticated`. No service-role fallback exists.

## Database integrity and retries

`lib/mcp/commands.ts` defines closed shapes; `scripts/generate-mcp-write-contract.ts --write` embeds their JSON-schema subset into the migration. The contract test detects drift. The private recursive validator checks JSON types before extraction: objects, keys, required properties, null rejection, enums, primitives, ranges, string lengths, UUID/email/URL/date patterns, and real calendar dates. Arrays are not accepted anywhere in a command. Semantic checks inside `hs_mcp_mutate` additionally enforce deferred-date/trigger requirements, recorded dates not in the future, task completion consistency, workflow timing order, ownership relationships and collection limits. PostgreSQL constraints/FKs remain a final atomic guard. The boundary validates changed input rather than revalidating/replacing untouched legacy records.

Every command includes a stable UUID `requestId`. A private receipt binds the ID globally to the authenticated owner, client, operation and exact JSONB command. JSON object key order is insignificant; values, omitted fields, strings, arrays, operation and revisions are significant. Never change a command while reusing its request ID. On a stale edit, read again and construct a newly reviewed command with a new request ID. On an ambiguous transport failure, retry the original exact command/ID.

An advisory transaction lock serializes duplicate request IDs; row locks and expected revisions protect event, directory and settings updates. Shared permission/session row locks serialize revocation with in-flight mutations, followed by a fresh authorization check before receipt replay or effects. Committed revocations deny later operations; a revocation waiting for an already authorised mutation takes effect after that transaction completes. An identical successful retry returns its original result, even if a newer revision now exists. Changed commands or another actor/client using that ID are rejected. Authorization is checked before receipt lookup, so revocation also denies old retries. A failed attempt creates no receipt, activity or changed revision. Event audit, actor/client activity, business mutation and successful retry receipt commit together. Do not purge receipts while clients can retry them. Receipts contain private command/result content and must remain in the protected database/backups.

Directory triggers advance revisions for both MCP writes and ordinary owner upserts. This prevents a later MCP edit from overlooking a human directory edit. The human directory UI retains its existing upsert behavior; event/settings owner revisions remain unchanged.

## Release sequence — separate authorised release route

The writer can prepare the working branch/PR and checks. It cannot merge main, apply production migrations, deploy production or activate expanded access. Independent review must inspect the pinned candidate and the surrounding owner/MCP/SQL boundaries before a separate release decision.

1. Reinspect deployed schema/migrations, table/function grants, all consumers of `hs_is_owner`, OAuth client registration, exact resource audience, active-session fields and any custom token hook. Compare to the repository; stop on unreviewed drift. This shares the Supabase project with the public website: preserve website tables, anonymous submission permissions and email/DNS settings.
2. Verify a recent encrypted external backup, its timestamp, checksum and decryption, then perform an isolated actual restore. `pg_restore --list` alone is not a restore rehearsal. Record backup/restore evidence with the release. Verify sufficient recovery coverage for Auth, grants, operational tables and the new private evidence tables.
3. Rehearse the migration on isolated PostgreSQL/Supabase with synthetic accounts and preexisting valid legacy records. Run `npm run check`, `npm run build`, dependency audit, changed-file secret review, RLS/function/privilege review and hosted Supabase security advisors. Rehearse capability rollback and immediate disable. Use two actual PostgreSQL connections for row/advisory lock contention; PGlite queues calls and is not proof of multi-session lock behavior.
4. Apply `supabase/migrations/20261105221834_authenticated_mcp_writes.sql` after all existing migrations. It is a once-only, transactional additive migration. Vercel does not apply it. Deploy the reviewed application with `MCP_WRITE_ENABLED=false`; preserve existing read/OAuth configuration and identity. Keep the database switch and per-client grant false.
5. The intended owner reviews `/settings/mcp`, verifies the exact existing client ID/resource and target ChatGPT account/workspace, and explicitly records scope consent. Do not create a replacement plugin or rotate to a shared identity. Record consent evidence without exposing tokens or passwords.
6. Under the separate release authorization, enable only the approved existing client and database switch, then the application write switch in the reviewed deployment. No other registered connection receives writes. Enable a synthetic acceptance window before customer operations.
7. Refresh tools on the **existing plugin connection** in the intended account. Confirm the eight original read tools and ten new write tools, unchanged server/connection identity and no forbidden tools. Do not mark plugin refresh complete from a server build or tools/list test alone.
8. Execute every command through the actual connected account using clearly named synthetic records, including child add/update preserving siblings, revision conflicts, exact and changed retries, finance reads and excluded-write denial. Verify actual access-token refresh, consent denial, client write-grant revocation, consent revocation, database disable, session termination, read-grant disable, owner removal and recovery. Revoking only writes must preserve reads; full access revocation must deny both. Check raw table/administrative/ordinary owner routes with delegated tokens. Confirm ordinary owner editing, board/Lost/Archive/Trash behavior and website-enquiry handling remain compatible.
9. Retain the release record with candidate SHA, reviewed SHA, backup/restore evidence, migrations, deploy ID, intended owner/client/resource, consent evidence, tool refresh, synthetic command results/revisions/receipt IDs, token-refresh/revocation/recovery results and unresolved findings. Never include token or customer data in a public PR. Customer writes remain disabled until all acceptance gates pass.

Administrator activation template (replace placeholders; never run as a delegated client):

```sql
begin;
update public.hs_mcp_clients set write_enabled=true
where client_id='VERIFIED_EXISTING_CLIENT_ID'
  and user_id='VERIFIED_OWNER_UUID'::uuid
  and resource_url='https://horizon-strings-internal-dashboard-kappa.vercel.app/mcp'
  and enabled and write_consent_version='operational-v1' and write_consented_at is not null;
-- Verify exactly one intended row, then enable the database switch.
update hs_mcp_private.control set writes_enabled=true where id;
commit;
```

The release operator must verify affected rows; this template is not a grant or instruction to activate automatically.

## Immediate disable, rollback and recovery

Run `supabase/disable-mcp-writes.sql` administratively to block **all** database writes immediately, including direct RPCs and retries, while keeping approved reads and ordinary owner editing. For one client, set its `write_enabled=false`, or revoke consent through `/settings/mcp`. `MCP_WRITE_ENABLED=false` plus the authorised application redeploy adds the application gate but is not a substitute for database disablement.

`supabase/rollback-mcp-writes.sql` disables the database/client write gates and revokes delegated mutation execution. Redeploy the prior reviewed application through the release route. Keep the reader, OAuth-denying owner predicate, private evidence, directory revisions and all business records. Do not drop tables or roll back OAuth separation while delegated sessions exist. Full compromise response may also disable the affected read grant and terminate provider sessions; that intentionally removes reads too.

For recovery, verify/re-review the cause, preserve receipts, restore mutation EXECUTE for `authenticated` only if revoked, recheck the owner/client/audience/session and owner consent, repeat synthetic acceptance, and re-enable only the reviewed gates. Never replay a successful mutation with a new request ID merely because its original response was lost. Business-data restoration is a separate backup-based, reviewed recovery action.

## Verification state

Implemented in the candidate: ten tools, separate application/database/client/consent gates, private atomic mutation boundary, directory revisions, exact retry receipts, attribution, consent/revocation UI, migration, immediate-disable and capability-rollback scripts, and synthetic verification.

Local verification includes every operation, 860 direct malformed commands (nulls, arrays, objects, wrong primitives and invalid dates), unchanged workspace/revision/receipt/activity after rejections, legacy-field preservation, collection relationships, excluded fields, stale/overlapping edits, retries, actor/client binding, permission revocation/recovery, owner compatibility and read-without-conversion checks. Application transport tests enforce the write switch and ordinary-owner route denial. Migration over a synthetic legacy event, immediate disable and capability rollback are rehearsed in embedded PostgreSQL.

`scripts/rehearse-mcp-concurrency.mjs` also applies every migration to a fresh **real PostgreSQL 17.11** cluster on loopback, with two independent connections. It observes an actual row-lock wait, stale rejection after commit, a concurrent identical retry returning the original result with one revision/receipt/activity, and changed-retry rejection. It stops its synthetic cluster on exit. To reproduce, install `embedded-postgres@17.11.0-beta.19` and `pg@8.23.1` in a disposable runtime directory (outside the app dependency tree), then run `node scripts/rehearse-mcp-concurrency.mjs PATH_TO_RUNTIME`. No existing database/production URL is accepted. The npm runtime wrapper is beta; this rehearsal uses the bundled PostgreSQL 17.11 server and does not establish hosted Supabase/OAuth behavior. It creates no OS account and retains its stopped synthetic temporary directory for inspection.

Security dependency checks identified baseline advisories; the candidate pins Next.js 16.4.5 and Zod 4.6.7 and refreshes affected transitive lock entries. The resulting full `npm audit --json` reports zero vulnerabilities. This reports dependency evidence, not an assertion of exploitability or a whole-system security certification. Typecheck, the complete 46-test suite, production build and audit results are recorded in the PR for the exact candidate.

Independent review, hosted migration/security advisors, backup restore, production deployment, activation, human intended-account consent, existing-plugin refresh, real OAuth refresh and connected-account read/write/revocation/recovery acceptance are separate release evidence. No such completion is implied by the local suite. Live access was unavailable to this writer; no production data, grants or configuration were changed.
