# Verification — 18 September 2026

- TypeScript check passed.
- Production build passed on Next.js 16.3.5 / Node 24.
- 12 automated tests passed, covering canonical stages, minimal enquiry, deposit booking, deferral validation, trigger dates, early-complete waiting, changed timing settings, required ensemble/readiness gates, Event Day/Post-event/archive, finance and Sydney/DST date arithmetic.
- Database test runs the real migration against embedded Postgres (PGlite), not a mocked persistence function. It verifies anonymous denial, authenticated non-owner denial, inability to self-grant owner membership, owner saving/loading, stable codes, atomic rollback on invalid child data, stale event/settings rejection and RLS on every business table.
- Browser: action queue layout checked; created a name-only synthetic enquiry; saved response and welcome milestones; recorded deposit; reloaded and verified derived stages/payment persistence.
- Browser: missing deferral date/trigger correctly rejected; adding Final Details saved successfully. After reload, the 20 December 2026 event's deferred wet-weather detail was due 6 December 2026.
- Production server started with the demo flag deliberately enabled: it displayed the closed **Private workspace** setup screen with no Supabase credentials. Production did not expose the local demo.
- Anonymous production API read and write returned 401; responses included no-store/private cache control and frame protection.
- Git whitespace/diff check passed.

Live setup completed on 18 September 2026:

- Applied the V1 migration in the owner's existing Supabase project `rqsdieaugozncjsmhcgd`. Preflight found two website tables, no dashboard tables and no Auth users.
- Verified 13 dashboard tables have RLS, initial settings exist, anonymous table privileges are absent and owner membership is empty. A rollback-only database verification passed non-owner reads/RPC/save denial, owner self-grant denial, anonymous event/RPC denial and preservation of website table RLS.
- Disabled public signup; email sign-in remains enabled. Public Auth settings endpoint verified both. Anonymous sign-in remains disabled and email confirmation remains enabled.
- Configured the Vercel project under Golden Thread Solutions with only the project URL and publishable key in Production/Preview. The deployed `main` release initially used commit `e711a4b`; runtime Node 24 verified.
- Production sign-in page verified in Chrome at `https://horizon-strings-internal-dashboard-kappa.vercel.app/`. Supabase Auth Site URL set to this address.
- Live HTTP checks passed: direct public event read 401; public workspace RPC 401; deployed anonymous GET/POST 401 with no-store; production page 200 with `X-Frame-Options: DENY`.
- The Supabase Backups screen confirms Free does not include project backups. No upgrade or paid backup was purchased.

Not verified yet: either owner sign-in, authenticated persistence/stale edits between two owners, or backup/restore. No Auth users or dashboard owner grants have been created, and no real customer data has been imported. These remaining dependencies are in the owner checklist.

On 19 September 2026 the single confirmed Auth account `koby@horizonstrings.com.au` was verified in Supabase. The owner has not yet confirmed the security-sensitive `hs_owners` grant. Live `hs_settings` now records 12/12/8/8/4/4/2 weeks, thank-you after 3 days, no payment gate, and reviewed defaults. The next-Thursday review calculation has a regression test.

The external backup workflow is committed but not activated: it requires the six GitHub Actions secrets and a private R2 bucket, then a successful manual run and a documented test restore. No Supabase Storage files are used by dashboard V1.

The local disk filled during package install/compiler caching. Unused npm cache and this dashboard's generated Next.js cache were reclaimed; persistent compiler caches were disabled. Source files, the website and original archived folders were preserved. Future local development will benefit from more free disk space; remote deployment is not dependent on that cleanup.
