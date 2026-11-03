# Board design and moves

Purpose: make the event register directly usable as a compact pipeline, with draggable cards and a recoverable Lost enquiries destination. Koby confirmed that active stages remain automatic: show required steps rather than overriding recorded facts.

## Content and behaviour map

The baseline is main `26bb67cb0c8fe06e05929b140a95ea1ecf600c15`. Existing page components and workflow calculations remain the source of truth. No customer data, public website files, dependencies, database migrations or MCP methods change.

| Existing source                                                                                    | Destination / preservation                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`, `/clients`: nine active stages, filters, counts, search, new enquiry, Archive and Trash links | Same EventBoard, same stage/filter calculation. Columns remain 150px desktop and 140px phone. Date, couple/event name, area and total value remain the only card details. Move/reopen buttons are actions, not extra record fields.                                                   |
| Board card links and new-enquiry dialog                                                            | Original workspace/inbox destinations and creation handler retained. A separate button opens move controls for keyboard/touch users.                                                                                                                                                  |
| Archived unbooked enquiries                                                                        | Existing archive records appear in the separate Lost tray; completed booked archives stay off the board. Reasons remain in each event's Close-out section.                                                                                                                            |
| `/clients/[id]`: EventEditor                                                                       | All sections and handlers retained: main facts, contacts, details with deferred/N/A values, musicians, repertoire, finance, communications/history, generated/manual tasks, Close-out and Trash. Requirements links target these existing sections. No field is relocated or removed. |
| `/enquiries/[id]`: historical website submissions                                                  | Submitted content and manual conversion retained. Lost uses the existing idempotent converter before the archive save. The submission link prevents duplicates.                                                                                                                       |
| `/tasks`, `/actions`: action queues and business tasks                                             | Existing filters, recipients, owners, due dates, generated links, manual task forms and completion state retained. New shell/styles only. Lost enquiries stop generating actions under existing archive logic.                                                                        |
| `/musicians`, `/repertoire`: catalogues                                                            | Existing rows, editors, long notes, add/save actions and validation retained; common table/form styling only.                                                                                                                                                                         |
| `/finance`: totals and event rows                                                                  | Existing fee, payment, balance, player-cost, profit and invoice calculations retained.                                                                                                                                                                                                |
| `/settings`: workflow timing, readiness and People                                                 | Existing fields, Koby/Mia identities, activation, save confirmation, backup export and handlers retained.                                                                                                                                                                             |
| `/archive`, `/trash`                                                                               | Existing separate lists, search/open/restore flows retained. Lost is not deletion.                                                                                                                                                                                                    |
| Workspace shell                                                                                    | Same navigation, save/error feedback, demo notice, authentication and sign-out. Sliding selected indicator, theme control and route entrance added.                                                                                                                                   |
| Login and OAuth consent                                                                            | Original forms, auth/consent handlers and security boundary retained. Shared surface tokens only. No owner access or OAuth capability changes.                                                                                                                                        |
| Print and secondary content                                                                        | Original print rules preserved by screen-scoped styling. No attachment or nested content component is replaced by a sample layout.                                                                                                                                                    |

No identified content omission. Content preservation was checked by source diff and representative local screens, not a complete live authenticated audit of every conditional field.

## Interaction contract

- Active-stage drop: open the destination's description and current missing requirements. No write occurs. Follow the workspace link, record actual facts and save; the existing derivation chooses the stage.
- Lost drop: require a reason, refuse booked/trashed records, save the existing `archived`/`archiveReason` fields with revision checking. Reopen retains that reason and derives the active stage from facts.
- A historical website submission may need conversion first. If conversion succeeds and archiving fails, keep the reason and explain that the event may now exist. Reload and review before retrying; never retry blindly or invent a second event.
- Every card retains its full link. The move button provides the same destination dialog without dragging. Escape/Cancel returns focus; saves announce the result.
- After a conflict, Reload board preserves the draft reason and destination and presents the fresh saved record. The owner explicitly chooses Use reviewed version before retrying; reloading/accepting never saves automatically. Current booking, archive and Trash state is rechecked. A later concurrent change still fails the ordinary revision check.
- The general Archive uses the shared completed-archive classification and excludes Lost and Trash. Lost records and their reasons remain retained and reopenable on the board.

## Visual hierarchy and motion

Horizon identity is retained within the Golden Thread V14 language: warm neutral rounded shell, quiet sidebar, forest/gold roles, white work surfaces and compact columns. The board is primary; search and occasional tools are quieter, with Lost separated beneath it.

Actual motion includes shell/word entrances, ordered route reveals, a measured sliding navigation selection, dialog/save feedback, Lost expansion and the V14 liquid theme reveal. Preferences use `prefers-reduced-motion: reduce` or the existing author hook `html[data-motion="reduced"]`; both CSS and JavaScript paths suppress animation. Theme choice persists locally. See [pattern sample](board-patterns.html) for the new resting patterns; the application is the interactive reference.

## Initial writer verification (head 755edf4)

Local development uses explicitly labelled synthetic data only. No live writes were made.

- `npm run check`: 35 tests pass, including five Lost/stage tests covering reason validation, booked/Trash protection, stale selection, partial conversion failure, retry without duplication and unchanged workflow facts.
- `npm run build`: passes on Node 24.
- Browser at 1280×720 and 390×844: active stage pointer drop, Lost pointer drop, required reason, archive/reopen, website conversion without duplicate card, collapsed tray, keyboard activation/Escape/focus return, narrow dialog scrolling, light/dark surfaces and 140px phone columns checked.
- Observed live liquid theme reveal and route/navigation transitions; checked the immediate reduced-motion author path using a temporary root attribute that was then removed. OS preference was not changed.
- Visual review is the writer's check, not owner design approval. Full authenticated production smoke testing and release review remain for the authorised release route.

## Release and recovery

Base: main. Production is the existing Vercel dashboard on main; this working branch/PR is not a production release. Existing approved Preview integration may build a preview. No environment or schema change is needed; do not reapply the already released board/Trash/People migration. Reverting this UI commit removes the new interactions while preserving archived reasons and existing event facts.

The independent review of head `755edf4` identified a stuck conflict-recovery flow and Archive/Lost overlap. The current candidate corrects both; see [review fixes and current evidence](PR11_REVIEW_FIXES.md). The old review's checks do not approve this changed candidate. Independent phone/touch, exact live motion/reduced-motion, hosted lifecycle and owner composition acceptance remain unverified.

Observed implementation lesson: revision rejection protects records, but recovery also needs to preserve the draft through explicit review of fresh facts; a lifecycle classification must be checked across every view that consumes its underlying status. Existing client-flow/content-parity and review guidance already cover those principles. Project evidence is recorded here and in the review-fix note; no new permanent rule or Standard is proposed or saved.
