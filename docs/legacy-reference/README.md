# Historical v0.5 README — superseded; do not use for setup

Local v0.5 internal dashboard for Horizon Strings.

## Current State

- Next.js app
- Local dummy/data-file records in `data/horizon.ts`
- Workflow rules in `lib/workflow.ts`
- Supabase database schema prepared in `supabase/migrations`
- Optional password protection prepared through `DASHBOARD_PASSWORD`
- Not yet connected to live Supabase data

## Safe Online Path

1. Put this folder in a private GitHub repository.
2. Create a Supabase project.
3. Run the migration in `supabase/migrations/0001_initial_horizon_schema.sql`.
4. Optionally run `supabase/seed.sql` to create dummy online records.
5. Create a Vercel project from the GitHub repository.
6. Add Vercel environment variables from `.env.example`.
7. Set `DASHBOARD_PASSWORD` before putting any real customer data online.

See `docs/deployment.md` for the full checklist.
