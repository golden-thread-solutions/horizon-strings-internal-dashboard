# Event board, save feedback, Trash and task assignment

Owner request, 2 November 2026: implement the approved compact Kanban in Events & enquiries and render it directly at `/`, then complete the five GTS dashboard requests. The owner confirmed recoverable Trash, both general and event tasks, and a Settings People list initially containing Koby and Mia. People are assignment entries, not Auth accounts.

## Behaviour

- `/` and the existing `/clients` URL render the same nine-column board, without a landing page or redirect. The sidebar has one Events & enquiries entry. All actions remains available separately.
- Cards are 150px wide (140px on phones) and show exactly date, names/event name, area and total booking value, in that order. Unknown dates/areas/values show TBC. Value is the total fee, not the deposit or balance. Stages continue to derive from saved facts; drag-to-change-stage is intentionally absent.
- Archived events and trashed events never appear on the active board. Archive is a separate list; Trash is separate and recoverable. Trashed records are also excluded from event action queues, finance and musician/repertoire activity, and from MCP service results.
- Unconverted historical website submissions appear as New Enquiry cards and open their enquiry context. After conversion the event replaces the submission card. Converted submissions never reappear as fresh enquiries, even if their event is archived or in Trash. Existing automatic conversion and submission history are retained.
- Successful event, settings, musician, repertoire, person and general-task saves show the shared dismissible, eight-second confirmation. Failures retain their form/error state and do not create success messages. Creation/conversion and Trash/restore also confirm their result.
- Move to Trash and Restore check the event revision and append existing event audit history. Trashed events cannot be saved by a stale or directly called event saver. Restore retains archive state, website link, event information and children. There is no permanent deletion or purge schedule.
- General business tasks and event tasks can be created from All actions. Event tasks remain editable in their event workspace. General tasks can be edited/completed/reopened in All actions, and open tasks join the due-date queue. Task assignment uses stable People IDs; existing text assignments remain visible and filter by matching names.
- Settings supports adding, renaming and deactivating people. Deactivation prevents new selection while retaining existing assignments. No login access or owner membership is created.

## Release and recovery

Apply `supabase/migrations/20261101202353_board_trash_and_people.sql` once through the separately authorised release route before deploying this candidate. The filename was created with the Supabase CLI. This adds `hs_events.deletedAt`, three owner-only RLS tables (People, general tasks and work audit), invoker RPCs and a guard on saving trashed events, then extends the existing human workspace loader. It seeds only the approved Koby/Mia assignment entries; no event content or existing assignments are backfilled. It preserves the existing owner/OAuth predicates and website conversion functions. Tests apply the real migration to embedded PostgreSQL with the read-only MCP migration in place.

Do not reapply old migrations, change credentials or grant delegated writes. This PR is separate from the pending read-write MCP PR #9. If that lands first, reconcile its model/service changes and repeat combined checks; preserve its write gate and the Trash guard. General-task/People tools are not added to the MCP.

Before a production migration obtain a current verified backup through the authorised release route. After release use synthetic records to verify owner save/reload, website deduplication, Archive, Trash/restore, task assignment/completion and second-owner stale edits. No production migration, deployment or customer-record edits were performed by the writer.

For rollback, leave additive tables, audit history and OAuth-denying policies in place. Older applications do not understand Trash and can show deleted events again; restore any trashed events deliberately before rolling back, or retain a compatible UI. Disable new Trash operations during a rollback. Do not drop rows/tables or revert owner predicates as an application rollback.

## Validation and limits

Local Node 24 type checks and all 30 tests passed, covering board deduplication/stages/date sorting, total-fee display data, legacy assignment resolution, actual PostgreSQL Trash/restore/stale-save guard, preserved submission links, task/person revisions and inactive assignment retention, and anonymous/non-owner/OAuth denial. Existing workflow, structured-details, atomic persistence and MCP tests remain included. The standard production build passed.

Browser synthetic demo: verified direct home board, conversion feedback and one resulting event card; Trash exclusion and restoration; archiving with a reason and exclusion from the board while retained in Archive; general task creation assigned to Mia and its queue/name display; successful person save; duplicate person save rejected with entered name retained and no success message. At the desktop breakpoint the board has nine 150px columns, each card has four fields, and the document has no horizontal overflow (only the board scrolls). At the narrow sidebar-panel breakpoint columns are 140px with the same containment. Browser evidence uses synthetic local demo data; it does not establish production behaviour or measured time savings.

Existing limitations remain: the human loader returns the newest 100 website submissions, full workspace data is loaded at once, communications are manual prompts/history, and the fixed-deposit issue is outside these five requests. No external messages are sent. Hosted database advisors, actual two-owner use, production persistence and recovery have not been newly tested. A successful build is not a release.

GTS tasks remain open until released and accepted: save confirmations `e05d5b87-ba0c-49c8-8c9d-e0096f4fa375`; event deletion `2898d474-5f9c-4765-ade2-3ed665b4b035`; archive visibility `5acf676d-e8cd-4e01-837c-6f0afaa13c11`; converted-enquiry visibility `8b6f64c3-2055-4c53-9298-7cad94a5afa3`; task assignment `877648ac-c528-4b4c-bd9e-9e87ac408c3f`.
