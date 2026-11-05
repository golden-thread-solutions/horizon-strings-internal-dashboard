# PR12 concurrency corrections

Independent review of head `4bd93a4fe136d8445b6ab87acb432d6a8ccb78ff` against base `4183fc123d124e35463d50c51bffa0e0cb4d0c6f` reproduced two database integrity defects on synthetic PostgreSQL 17.11. The review was read from the owner's supplied report and reproducer; its checkout was not used for implementation.

## F1: child identity and parent revision

A `SELECT FOR UPDATE` lookup cannot lock an absent or uncommitted child. The old unconditional `INSERT ... ON CONFLICT DO UPDATE` could then wait for another event's insertion and overwrite that child without changing its actual parent's revision. The requested parent instead received the revision/audit/activity and a misleading successful response.

Correction: separate insert and update paths for all five event child operations. A new child uses plain INSERT, so a concurrent duplicate UUID raises `23505` and rolls back the losing statement. Existing-child UPDATE includes both the actual parent and the expected parent revision, and requires one affected row. The locked parent serializes the ordinary owner save RPC; the final event revision UPDATE also requires the expected revision. No lock protocol exclusive to MCP is relied upon for ordinary owner writes.

## F2: directory creation and revisions

The old unconditional conflict-update path likewise allowed two musician/piece creates at expected revision zero to succeed, replacing the first creator's values.

Correction: expected revision zero is insert-only. A conflicting concurrent create rejects with `23505`; a directory UPDATE includes `id` and expected revision in its final condition and rejects an unmatched update with `40001`. Existing directory triggers still advance revisions for ordinary owner upserts. The ordinary directory UI retains its documented last-successful-save behavior: an owner upsert may legitimately follow an MCP write, advance the revision and invalidate a stale MCP update. An exact retry of the earlier successful MCP command returns the original receipt without reverting that owner edit.

## Real two-connection regressions

Run `npm run test:mcp-concurrency -- PATH_TO_DISPOSABLE_RUNTIME` using the separately installed `embedded-postgres@17.11.0-beta.19` and `pg@8.23.1` runtime. The driver always creates a fresh synthetic loopback-only PostgreSQL cluster; no existing/production connection string is accepted.

The regression helper observes `pg_stat_activity` for the actual second backend, requires `wait_event_type='Lock'` and the first backend in `pg_blocking_pids`, then commits the first transaction. Timing alone is not considered a lock-wait pass.

| Scenarios | Coverage | Expected result |
| --- | --- | --- |
| 15 cross-parent child creates | All five child operations; MCP/MCP, owner/MCP, MCP/owner | Losing insert `23505`; both parents and all children consistent |
| 15 same-parent stale child edits | All five operations; MCP/MCP, owner/MCP, MCP/owner | Losing stale save `40001` |
| 4 directory create conflicts | Musicians and pieces; MCP/MCP and owner/MCP | Losing expected-zero create `23505` |
| 4 directory stale updates | Both directories; MCP/MCP and owner/MCP | Losing stale MCP update `40001` |
| 2 ordinary owner follow-up upserts | Both directories; MCP/owner | Owner succeeds at revision 2; stale MCP edit rejects; exact original MCP retry has no effect |

Every rejected-race assertion compares every row of all `public.hs_*` and private MCP tables with the winner's uncommitted snapshot, including financial facts, siblings, both parent/directory revisions, audit, receipts and activity. Losing MCP requests have no receipt/activity. Successful winner commands are retried exactly and must return their original result with an unchanged snapshot. Complete MCP workspace reads are checked after the races. Fixtures retain sibling entries, nonzero finance and existing assignment fees/payment status. The existing full suite separately exercises financial exclusions, malformed inputs, consent/revocation, legacy preservation and ordinary owner workflows.

Negative controls: disposable copies of the new tests against the reviewed migration fail at `upsert_event_contact:cross-parent:mcp/mcp` and, with child cases skipped to isolate F2, `upsert_musician:create:mcp/mcp`; both incorrectly report success on that old migration. The corrected migration passes all 40 scenarios on PostgreSQL 17.11 with observed `transactionid` waits, plus the driver's existing event stale-edit, identical-retry and changed-retry checks. No files in the independent review checkout were changed.

## Migration and release limits

This corrects the PR's dormant migration before release. It is not a production repair migration, and none was applied. Release must verify actual migration history first; do not replay the create-schema migration on a database where the earlier candidate was already applied. Any such isolated environment needs a separately reviewed function replacement or fresh disposable rehearsal database.

No read/auth/OAuth/consent/write-switch behavior changed. No financial write input, deletion, archive/restore, message sending or new scope was added. No merge, production deployment, migration, write activation or production-record/configuration change is authorised by these corrections.

To honor the no-deployment instruction while updating the existing PR, `vercel.json` disables automatic Git deployment for the exact `feat/authenticated-mcp-writes-20261106` branch only. Production/main is not matched; no provider-side project setting is changed. GitHub checks still run. This uses [Vercel's branch-specific deployment control](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled), rather than triggering another preview as a side effect of the branch update.

Fresh independent review is required for the corrected candidate. Hosted schema/Auth/RLS inspection, advisors, backup restoration, intended-account consent, existing-plugin refresh and actual connected-account read/write/token-refresh/revocation/recovery remain separate release prerequisites; local SQL tests do not establish those outcomes.

References: [PostgreSQL INSERT](https://www.postgresql.org/docs/17/sql-insert.html), [Read Committed concurrency behavior](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-READ-COMMITTED).
