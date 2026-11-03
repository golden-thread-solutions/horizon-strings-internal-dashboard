# PR11 review corrections — 4 November 2026

This is writer evidence for independent re-review, not release approval. PR #11 remains on `codex/horizon-dashboard-design-drag`, targeting main `26bb67cb0c8fe06e05929b140a95ea1ecf600c15`. The exact current candidate and tree are recorded in the PR handoff. The previous reviewed head was `755edf4cc4cbe3145cd4463b7331d15c68965651`.

## Reproduction before edits

- F1: in two credential-free local demo tabs, select Alex & Jordan → Lost and enter a reason; save General notes in the other tab. Lost save rejects the stale revision. Reload board followed by retry still rejects the captured old revision, with no usable review/reselection path.
- F2: the synthetic Taylor & Morgan Lost record also appears in the general Archived events table, with its Lost reason.

## Corrections

- The reason is part of the pending move draft. Workspace refresh returns the parsed dataset it actually loaded, rather than requiring the dialog to read a possibly stale render closure.
- Reload preserves reason/destination, resolves the current linked record and presents a read-only review with current facts, notes, retained reason and a link to the full saved workspace in a separate tab. Review receives focus. Choosing **Use reviewed version** accepts the displayed revision and returns focus to the move submit button. It does not submit the move. Until acceptance, submission is disabled.
- Missing, booked, already-Lost, already-reopened and trashed records are rechecked and blocked as appropriate. Reopening uses the same extracted revision-checked helper as the tests. If facts change again during review or after acceptance, current-state checks and the ordinary atomic persistence revision check still apply. No automatic retry or stale overwrite is introduced.
- A website submission whose conversion already succeeded resolves to the existing linked event on reload. Retry uses that event's current revision rather than creating another event. The existing explicit conversion/save partial-success messages remain.
- General Archive uses `isCompletedArchive`, derived from the same `isLostEnquiry` classification as the board. Lost and Trash are excluded; completed booked archives remain. No record is deleted, backfilled or reclassified in storage. Existing archive eligibility and persistence contracts are unchanged.

## Current writer checks

- Focused regression run: `npx tsx --test tests/board-recovery.test.ts tests/lost-enquiries.test.ts` — 9 pass.
- `npm run check` — type generation/type checking and all **39 tests pass**. Four added regressions exercise reason/intent retention, fresh revision acceptance, preserved concurrent notes, a second conflict, stale reopen, current eligibility changes, conversion-link recovery and separate Lost/completed Archive/Trash/active visibility. Existing local Postgres/RLS and conversion tests still pass.
- `npm run build` — passes on Node 24 / Next 16.3.5. `git diff --check` — passes.
- Local IAB demo at `http://127.0.0.1:4198`, development-only synthetic browser storage, Supabase variables absent. Verified stale Lost save → reload → displayed newer notes and unchanged reason → explicit acceptance → successful save; reloaded editor retained both newer notes and entered reason.
- Verified stale reopen → reload/review/accept → successful reopen, retaining the saved Lost reason and newer notes. Keyboard Enter activates acceptance/submission; review heading and then submit button receive focus. Escape closes the dialog.
- Verified a concurrent booking change is detected after reload, removes acceptance, disables the move and retains the draft reason. General Archive is empty while the synthetic Lost record remains retained/reopenable in its board tray. Completed/Trash combinations and later conflicts are additionally covered by the regression tests; a full completed-booking lifecycle was not rebuilt through browser forms in this correction pass.
- Light/dark final states checked. The author reduced-motion path was checked with a temporary root `data-motion="reduced"` attribute: review, focus, explicit acceptance and retry remain usable, with the draft reason retained. The attribute was then removed; no OS preference changed.
- A 390×844 viewport override was attempted, but DOM measurements stayed **1280×720**, with a 460px dialog. Override reset. **This correction pass does not verify narrow layout or touch.** Screenshots are kept locally; the desktop screenshot is not phone evidence.

## Evidence boundaries and release

The independent reviewer passed the prior head's type check, 35 tests/build and sampled desktop flows, but reported independent phone/touch/zoom, exact live animation/reduced-motion, hosted auth/recovery and owner composition limits. Those limits remain explicit and are not converted into independent passes by this writer's tests. The changed head requires fresh independent review. No hosted client records or access settings were changed; no production smoke, load/failure injection or owner design acceptance is claimed.

Main, PR #9, the parked public-website candidate, migrations, dependencies, environment setup, authentication/RLS and workflow derivation remain unchanged. The normal approved Preview/CI integration may build this feature branch. No merge, formal approval, auto-merge, production deployment or migration was performed. Revert the corrective commit to restore the old UI logic without deleting saved reasons or event facts.

The review's learning is already covered by existing recovery/content-parity guidance: test the path after a safe rejection, and check a new lifecycle classification against all existing views. This project note captures the purpose and observed effects; no new Standard or permanent knowledge rule is adopted.
