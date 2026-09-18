# Horizon Strings Operations

Private, two-owner event workspace. The public website is a separate project.

Implemented: name-only enquiries, derived stages, pending tasks/outbound communications, a continuous event editor, explicit unknown/filled/not-applicable/deferred detail states, week-based workflow settings, contacts, musicians, repertoire/arrangements, payment tracking, contact history and archive rules.

Prepared for live use: Supabase owner authentication/RLS, atomic event saves, concurrent-edit protection, migrations, environment template, Vercel settings and automated checks. **Live account configuration and end-to-end production verification remain pending.** No real customer data is included.

## Run locally

Use Node 24:

```sh
npm ci --ignore-scripts
```

Copy `.env.example` to `.env.local`. Leave Supabase variables blank for synthetic local preview, then:

```sh
npm run dev -- --hostname 127.0.0.1 --port 4179
npm run check
npm run build
```

Demo records live only in this browser. Production never uses demo mode. No Supabase service-role key is needed.

- [Owner launch checklist](docs/OWNER_LAUNCH_CHECKLIST.md)
- [Deployment and live verification](docs/deployment.md)
- [Architecture and data model](docs/architecture.md)
- [Workflow and proposed defaults](docs/workflow.md)
- [Decision log](docs/decision-log.md)
- [Deferred work](docs/future-architecture.md)

The only current initial migration is `supabase/migrations/202609180001_dashboard_v1.sql`. Old docs/SQL live under `legacy-reference` and are not installation instructions. Do not migrate the spreadsheet without explicit owner approval.
