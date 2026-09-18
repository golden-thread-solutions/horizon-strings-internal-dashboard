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

Still pending activation: live database, two owner accounts, Vercel configuration and a live smoke test. No live spreadsheet import is approved. Proposed defaults and setup choices are consolidated in the owner checklist.
