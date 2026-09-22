# Dashboard architecture

Private dashboard only. The public website remains a separate project.

Browser → Next.js `/api/workspace` → validated owner session → Supabase/Postgres → saved records → derived stage/action queue.

- Next.js 16 / React 19, TypeScript, Zod, Supabase Auth/Postgres, Vercel.
- Two named owner accounts with shared access to one business. Every API request validates its token through Supabase Auth and checks `hs_owners`. Database row-level security independently checks membership.
- The app uses the publishable/anon key and the owner's token. No service-role key. No public registration UI or customer-data import. The public website owns enquiry submission and email notification; the dashboard reads those private records through owner-only RLS and converts them idempotently into events.
- The login shell has no business data. Missing production configuration closes access. Explicit local demo mode is development-only and disabled when Supabase is configured.
- `hs_save_event` saves an event and child rows atomically, with an expected revision. Invalid child data rolls the whole transaction back; stale edits are rejected. Settings also check revisions. Small musician/repertoire directory upserts use the last successful save if edited simultaneously.
- Stable IDs (`E00001` etc.) come from a database sequence. Array ordering is preserved. The UI keeps unsaved edits when a save fails and warns before leaving an edited event.
- Stages and generated actions are derived, never maintained as status dropdowns. Lists refresh explicitly so another owner's changes do not replace an unsaved draft.

## Tables

| Table | Purpose |
| --- | --- |
| `hs_owners` | Approved Supabase Auth user IDs |
| `hs_events` | Identity, date, type, ensemble, area, address, duration, source, notes, milestone dates, revision/archive |
| `hs_details` | Eight named operational groups with resolution and deferral state |
| `hs_contacts` | Main, on-day, celebrant, venue, couple and other contacts |
| `hs_musicians` / `hs_event_musicians` | Directory and event players, fees, confirmation, music, contracts, payment |
| `hs_pieces` / `hs_event_repertoire` | Catalogue, private music links, requests and arrangements |
| `hs_finance` | Typed charges, received amounts/dates, invoice reference and other costs |
| `hs_tasks` | Manual tasks and outbound communications, assignee, due date and completion |
| `hs_communications` | Contact history |
| `hs_settings` | Week/day offsets and payment readiness rule |
| `hs_audit` | Event revision, editing user and timestamp |

Dashboard-owned tables use `hs_`. The integration migration adds only dashboard workflow columns to `website_enquiries`; historical tables remain untouched. Old SQL/docs are explicitly archived under `legacy-reference` and must not be used for setup. Detailed timing, venue, wet-weather, repertoire brief, rehearsal, logistics and run-sheet information is stored in named structured groups.

References: [Supabase Auth](https://supabase.com/docs/guides/auth), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword).
