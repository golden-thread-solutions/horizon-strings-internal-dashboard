# Dashboard launch setup

Golden Thread Solutions accounts, separate from the public website. No live credentials or customer records are in this release.

## Supabase

Proposed: a dedicated `Horizon Strings Operations` project in Sydney, unless the owner deliberately selects an existing dashboard project. Keep the database password in the owner's password manager; the app does not use it.

1. SQL Editor: run **only** `supabase/migrations/202609180001_dashboard_v1.sql`. This first-install transaction is not a reset/repeatable script. Never apply `supabase/legacy-reference` files.
2. Authentication: disable new-user signup; keep email/password sign-in enabled.
3. Authentication → Users → Add user → Create user: create two confirmed password users. Use direct creation rather than invitations for initial setup, so no SMTP or outgoing invite is required. Owners enter/retain their own passwords; never paste passwords into a task or source file.
4. Replace the two email placeholders in `supabase/configure-owners.sql` and run it. It verifies both confirmed accounts before granting access. Do not use browser-editable metadata for owner membership.
5. Copy the project URL and **publishable** key (or legacy anon key) from API settings. No service-role/secret key, Storage bucket, Edge Function, cron, webhook, Resend or Google key is needed.

Every business table has RLS. Removing a user from `hs_owners` revokes business access, including through the direct database API.

## Vercel

Import `golden-thread-solutions/horizon-strings-internal-dashboard` into Golden Thread Solutions. Root directory `.`, Next.js, Node 24. `vercel.json` supplies install/build commands. Deploy the approved release branch, then use `main` after merge.

Set in Production and approved Preview environments:

- `NEXT_PUBLIC_SUPABASE_URL` — selected project's HTTPS URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — its publishable or legacy anon key.

Do not set `DASHBOARD_DEMO_MODE`, old Basic Auth variables or a service-role key. Public environment variables are compiled into the bundle, so redeploy when changing them. Start with the generated HTTPS Vercel address; a custom subdomain can wait. Set the Supabase Auth Site URL to that address; password sign-in has no callback route requirement.

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

Confirm the selected Supabase plan's backup/restore facilities before live customer data. Do not assume a free project has automatic recoverable backups. Settings offers a private JSON export as an additional manual backup; there is no self-service import.

Application rollback: redeploy the prior tested dashboard commit in Vercel. Never use the old v0.5 sample app as a real-data fallback. Never drop tables/reapply the initial migration to fix deployment; database recovery needs a reviewed backup plan.

## Local development

Node 24; `npm ci --ignore-scripts`; copy `.env.example` to `.env.local`; `npm run dev -- --hostname 127.0.0.1 --port 4179`. Blank Supabase variables plus `DASHBOARD_DEMO_MODE=true` means synthetic browser-local data only. Production with blank variables shows a closed setup screen.

`npm run check`: types and workflow/database tests. `npm run build`: production bundle. `npm run preflight`: configuration presence checks without values. A successful build does not verify live credentials, owner access or backups.
