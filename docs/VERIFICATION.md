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

Not verified yet: a hosted Supabase project's credentials, owner accounts, external Auth settings, real network persistence between two owners, Vercel deployment and backup/restore. These require the account setup in the owner checklist. Local/demo/embedded tests are not a claim of completed live deployment.

The local disk filled during package install/compiler caching. Unused npm cache and this dashboard's generated Next.js cache were reclaimed; persistent compiler caches were disabled. Source files, the website and original archived folders were preserved. Future local development will benefit from more free disk space; remote deployment is not dependent on that cleanup.
