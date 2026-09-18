# Decision Log

## Local-only v0.5 first

Why: Prove the workflow, UI, and data model before committing to Supabase/Vercel.

Alternatives considered: Build directly on Supabase and deploy immediately.

## Dashboard plus separate action page

Why: User wants general statistics on the dashboard, with a clear action/attention page.

Alternatives considered: Make the dashboard only action-focused.

## Spreadsheet-like event page

Why: The current event sheets are familiar and already contain useful sections.

Alternatives considered: A more abstract CRM-style page.

## Checkpoints as first-class concepts

Why: Deposit invoice sent, deposit received, setlist sorted, and musicians sorted are operationally important.

Alternatives considered: Treating these as ordinary tasks only.

## No Supabase, no auth, no deployment yet

Why: Local-only prototype can safely use real source material without making premature security or hosting decisions.

Alternatives considered: Deploying a live unauthenticated app, which is not appropriate for real customer data.

## Prepare Supabase before switching the app to it

Why: We can create the database shape and review it without risking a broken dashboard or accidental data exposure.

Alternatives considered: Connect the app directly to Supabase immediately.

## Add simple password protection for online testing

Why: The internal dashboard may contain client names, contact details, dates, and venues. A basic password is not a full login system, but it prevents an accidental public dashboard during v0.5 testing.

Alternatives considered: No protection until later, or full Supabase authentication now.

## Keep first Vercel deployment on local dummy data

Why: This proves GitHub and Vercel deployment before introducing database connection risk.

Alternatives considered: Migrate Sheets, connect Supabase, and deploy all at once.

## Preserve Sheet source references during CRM migration

Why: The live `Event Details` workbook uses client tabs, hub tabs, and marker cells. Keeping source sheet names, sheet IDs, task IDs, and template mapping records gives us an audit trail while moving to the CRM.

Alternatives considered: Drop all spreadsheet metadata and keep only clean CRM fields.

## Store task rules separately from tasks

Why: The workbook has `Task Rules` that generate recurring workflow tasks. These are different from one-off manual tasks.

Alternatives considered: Convert every rule into static tasks only.

## Make checkpoint due offsets configurable

Why: The Sheet currently contains older timing rules, while the CRM product requirement is musicians sorted around 3 months before and setlist sorted 6 weeks before. Settings let us change this later without rewriting workflow code.

Alternatives considered: Hard-code the Sheet's old 6-month / 4-month rules, or hard-code the new CRM rules permanently.
