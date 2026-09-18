# Current decisions

| Decision | Why / alternative considered |
| --- | --- |
| Clean dashboard GitHub baseline, separate checkout | Avoid archived customer-data history and leave website work alone |
| Fact-derived stages and editable deadlines | Replace stale manual stages, fixed sample date and hardcoded day offsets |
| Compact queues and continuous event editor | Latest owner request prioritises completion without another design gate |
| Prepare individual owner Auth + RLS | Shared optional Basic Auth is inadequate for live client records; full RBAC is unnecessary |
| Publishable key only | No app service key that bypasses database access rules |
| New prefixed migration | Old unapplied SQL used obsolete stages; preserve as historical reference |
| Atomic saves/revision checks | Avoid partial saves and stale overwrites between two owners |
| Explicit development-only synthetic demo | Production must never silently substitute local/sample storage |
| Provisional editable timing/readiness defaults | Minor unresolved choices need not block a testable build |
| npm lockfile, Node 24, pinned current dependencies | Reproducible builds; remove conflicting package-manager locks |
| Disable persistent development compiler cache | This workstation ran out of disk during verification; no product data is affected |

On 18 September 2026 the owner selected the existing Horizon Strings Supabase project `rqsdieaugozncjsmhcgd` and authorized browser setup. Dashboard tables/RLS and Auth restrictions are applied; Vercel is deployed under Golden Thread Solutions with the existing publishable key. The website tables remain unchanged. No additional Supabase project or paid upgrade was created.

Still pending: the two owner accounts and approved owner email addresses, authenticated live checks, backup/restore choice and confirmation of the provisional workflow defaults. No live spreadsheet import is approved. Only remaining owner actions belong in the owner checklist; completed setup is recorded here and in VERIFICATION.md.
