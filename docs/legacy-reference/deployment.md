# Deployment Plan - GitHub, Supabase, Vercel

## Plain English Version

GitHub stores the code.

Supabase stores the database.

Vercel hosts the internal dashboard online.

The dashboard should eventually work like this:

User -> Vercel dashboard -> server-side app logic -> Supabase database -> updated dashboard

## Current Recommendation

Use the expected stack:

- GitHub: private repository for the internal dashboard code.
- Supabase: PostgreSQL database for clients, events, tasks, finance, musicians, repertoire, communications, and notes.
- Vercel: hosts the Next.js dashboard.
- Simple dashboard password: temporary protection before proper administrator login.

Confidence: 8/10.

This is a sensible small-business setup. The main weak point is that a simple password is not a full permissions system, but it is enough to avoid an accidentally public internal dashboard while we test.

## Must-Have Before Real Data Goes Online

- Private GitHub repository.
- Vercel project connected to that private repository.
- `DASHBOARD_PASSWORD` set in Vercel.
- Supabase project created.
- Supabase database migration run.
- Supabase service role key stored only in Vercel environment variables.
- No service role key committed to GitHub.

## Nice-To-Have Later

- Proper admin login.
- Role-based permissions.
- Supabase Row Level Security policies tied to real users.
- Automated Google Sheets import.
- Email draft integration.
- Calendar integration.

## Exact Setup Steps

### 1. GitHub

Create a new private repository for the internal dashboard.

Recommended repo name:

`horizon-strings-ops`

Commit and push only the `Horizon Build` folder contents, not the whole `Internal dashboards` folder.

Reason: the parent folder holds unrelated reference docs and other projects.

### 2. Supabase

Create a new Supabase project.

Recommended project name:

`horizon-strings-ops`

Open the SQL editor and run:

`supabase/migrations/0001_initial_horizon_schema.sql`

Then, for test data only, run:

`supabase/seed.sql`

Do not put real customer data in until the dashboard is password-protected online.

### 3. Vercel

Create a new Vercel project from the GitHub repository.

Framework:

`Next.js`

Build command:

`pnpm build`

Install command:

`pnpm install`

Output directory:

Leave as the Vercel default for Next.js.

### 4. Environment Variables

Copy `.env.example` into Vercel's environment variables.

Use:

`DASHBOARD_USERNAME`

`DASHBOARD_PASSWORD`

`NEXT_PUBLIC_SUPABASE_URL`

`SUPABASE_SERVICE_ROLE_KEY`

Leave Supabase values blank until the app is actually switched from local file data to database reads.

### 5. First Online Test

For the first online test, deploy with:

- local dummy data still active;
- `DASHBOARD_PASSWORD` set;
- no real customer data;
- no Supabase connection used by the app yet.

This proves Vercel and GitHub are working without risking customer data.

### 6. Database Connection Step

After the first deployment works, the next build step is to replace `data/horizon.ts` reads with Supabase reads.

Do that in a controlled pass:

- events list first;
- then individual event pages;
- then tasks/action queue;
- then musicians/repertoire/finance pages;
- then write/edit actions.

## Risks

The biggest risk is accidentally publishing real customer names, emails, phone numbers, wedding dates, or venue details without access protection.

The second risk is using the Supabase service role key in browser code. It must only be used server-side.

The third risk is trying to migrate the full spreadsheet at the same time as deploying. Keep those as separate steps.
