# Horizon Strings Operations

Private, two-owner event workspace. The public website is a separate project.

Implemented: automatic website enquiry inbox and one-click event conversion, name-only manual enquiries, derived stages, pending tasks/outbound communications, a continuous event editor, structured timing/logistics/wet-weather fields, explicit unknown/filled/not-applicable/deferred detail states, week-based workflow settings, contacts, musicians, repertoire/arrangements, payment tracking, contact history and archive rules.

Deployed at [Horizon Strings Operations](https://horizon-strings-internal-dashboard-kappa.vercel.app/), connected to the existing Horizon Strings Supabase project. The dashboard migration, private access rules, public-signup restriction, production environment, owner membership and initial workflow rules are configured. Anonymous live access checks passed. **The new integration migration, updated deployment and external backup activation remain pending until this release is applied.** No spreadsheet customer data is included.

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

- [Deployment and live verification](docs/deployment.md)
- [Architecture and data model](docs/architecture.md)
- [Workflow and proposed defaults](docs/workflow.md)
- [Decision log](docs/decision-log.md)
- [Deferred work](docs/future-architecture.md)

Apply migrations in timestamp order. `202609180001_dashboard_v1.sql` is the already-applied initial install; `202609230001_website_enquiry_inbox.sql` adds the website inbox, conversion, structured event data and repertoire metadata. Old docs/SQL live under `legacy-reference` and are not installation instructions. Do not import the spreadsheet's customer data.
