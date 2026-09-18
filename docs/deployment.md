# Dashboard launch setup

Golden Thread Solutions accounts. The dashboard has a separate Vercel project and shares the existing Horizon Strings Supabase project with the public website. No secret credentials or customer records are in source control.

## Supabase

The owner selected the existing **Horizon Strings** project `rqsdieaugozncjsmhcgd` (Sydney) on 18 September 2026. The dashboard uses separate `hs_` tables; the website tables were not changed. Do not create another project. Keep the database password in the owner's password manager; the app does not use it.

1. **Already applied:** `supabase/migrations/202609180001_dashboard_v1.sql` through SQL Editor on 18 September 2026. All 13 dashboard tables have RLS. This first-install transaction is not a reset/repeatable script; do not run it again. Never apply `supabase/legacy-reference` files.
2. **Already configured:** public signup disabled, email/password sign-in enabled, anonymous sign-in disabled, email confirmation retained.
3. Authentication → Users → Add user → Create user: create two confirmed password users. Use direct creation rather than invitations for initial setup, so no SMTP or outgoing invite is required. Owners enter/retain their own passwords; never paste passwords into a task or source file.
4. Replace the two email placeholders in `supabase/configure-owners.sql` and run it. It verifies both confirmed accounts before granting access. Do not use browser-editable metadata for owner membership.
5. **Already configured:** the existing project URL and publishable key are in the Vercel Production/Preview environments and ignored local `.env.local`. No service-role/secret key, Storage bucket, Edge Function, cron, webhook, Resend or Google key is needed.

Every business table has RLS. Removing a user from `hs_owners` revokes business access, including through the direct database API.

## Vercel

Project: [horizon-strings-internal-dashboard](https://vercel.com/golden-thread-solutions/horizon-strings-internal-dashboard). Production: [Horizon Strings Operations](https://horizon-strings-internal-dashboard-kappa.vercel.app/). Connected repository: `golden-thread-solutions/horizon-strings-internal-dashboard`, branch `main`, root `.`, Next.js, Node 24. `vercel.json` supplies install/build commands. Sydney (`syd1`) is the selected function region to match the database.

Set in Production and approved Preview environments:

- `NEXT_PUBLIC_SUPABASE_URL` — selected project's HTTPS URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — its publishable or legacy anon key.

Do not set `DASHBOARD_DEMO_MODE`, old Basic Auth variables or a service-role key. Public environment variables are compiled into the bundle, so redeploy when changing them. Supabase Auth Site URL is configured as `https://horizon-strings-internal-dashboard-kappa.vercel.app`; password sign-in has no callback route requirement. A custom subdomain can wait.

## Live smoke test (Codex can do after setup)

- Anonymous browser: login screen, API 401, no records.
- Auth user absent from `hs_owners`: API denied and direct database reads empty/denied.
- Each owner: sign in, create a synthetic enquiry, save response/welcome/deposit, reload, and view the same data from the other account.
- Two stale event editors: second save rejected without overwriting first.
- Deferred field without trigger/date rejected; valid deferral generates the correct due date.
- Change a week offset: generated dates update, manual dates remain.
- Sign out: private screens cleared.
- Review Settings once. Real customer data waits until persistence, both logins, access restrictions and backups have been verified.

## Recovery

The project's Backups screen confirms that its Free plan does not include project backups. The owner still needs to choose a paid scheduled-backup plan or an agreed manual backup/restore process before entering real customer data. No paid upgrade was made. Settings offers a private JSON export as an additional manual backup; there is no self-service import.

The independent backup implementation is documented in [EXTERNAL_BACKUPS.md](EXTERNAL_BACKUPS.md). It is designed for a six-hour maximum data-loss window and remains inactive until its R2 bucket and GitHub secrets are configured.

Application rollback: redeploy the prior tested dashboard commit in Vercel. Never use the old v0.5 sample app as a real-data fallback. Never drop tables/reapply the initial migration to fix deployment; database recovery needs a reviewed backup plan.

## Local development

Node 24; `npm ci --ignore-scripts`; copy `.env.example` to `.env.local`; `npm run dev -- --hostname 127.0.0.1 --port 4179`. Blank Supabase variables plus `DASHBOARD_DEMO_MODE=true` means synthetic browser-local data only. Production with blank variables shows a closed setup screen.

`npm run check`: types and workflow/database tests. `npm run build`: production bundle. `npm run preflight`: configuration presence checks without values. A successful build does not verify live credentials, owner access or backups.

`node --env-file=.env.local scripts/verify-live-access.mjs https://horizon-strings-internal-dashboard-kappa.vercel.app` checks public API denial, signup settings, deployed anonymous GET/POST denial and framing protection. It does not test either owner's sign-in or authenticated event persistence.
