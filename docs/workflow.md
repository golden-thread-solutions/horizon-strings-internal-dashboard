# Workflow and provisional defaults

Authority: the migration handover, superseded by the owner's 18 September 2026 dashboard-only takeover request. Reversible minor choices are implemented as documented defaults.

## Derived stages

1. New Enquiry: no response/welcome milestone or deposit.
2. Pending Enquiry: response recorded, welcome email not yet recorded.
3. Pending Booking: welcome/deposit email recorded, deposit not received.
4. Details Pending: deposit received, information unknown or waiting for the internal threshold.
5. Internal Organisation: initial details resolved and within its start threshold.
6. Final Details: inside the final threshold, with unresolved readiness requirements.
7. Event Ready: inside the final threshold and all readiness requirements met.
8. Event Day: booked event date equals today's date in Australia/Sydney.
9. Post-event: booked event date is before today.

Deposit receipt alone establishes booking, even if earlier communications are unrecorded. Event Day/Post-event take precedence over unknown details; overdue actions remain visible.

## Details and actions

Core requirements: date, ensemble, duration, separate area/address, main contact with phone or email, and eight operational groups. Groups can be Filled (requires content), Not Applicable or Deferred. Deferral requires a date or an Internal Organisation/Final Details trigger. A fixed date takes precedence. Deferred work stays visible in All actions and enters the default attention queue when overdue or within seven days. It blocks Event Ready until resolved.

Home is pending tasks and outbound communications, sorted by due date. No AI priorities or cron are necessary: the queue is computed from current records, and the open home page updates the Sydney date each minute. Manual dates stay unchanged when settings change.

## Defaults — editable in Settings, awaiting one owner review

| Rule | Default |
| --- | --- |
| Internal Organisation / musicians | 12 weeks before event |
| Repertoire | 6 weeks before |
| Arrangements | 4 weeks before |
| Rehearsals | 3 weeks before |
| Final Details | 2 weeks before |
| Final confirmation / client balance | 1 week before |
| Enquiry / booking follow-up | 1 day after enquiry/response |
| Deposit check | 7 days after welcome/deposit email |
| Post-event payments / thanks / review | 7 days after event |

Weeks are seven calendar days. Day offsets include weekends; no evening cutoff is embedded.

## Event Ready proposal

All core details resolved, no deferred groups, full named ensemble confirmed with music and any required contract, all pieces approved/not applicable, final confirmation recorded, pre-event manual actions complete, and client balance paid. Payment gating is editable. A not-applicable music brief can resolve an empty setlist.

Booked events archive only after the date and once all generated/manual actions are resolved, including player payments and post-event communications. Non-sale enquiries may archive with a reason. Archive is reversible.

## Communications and money

Pending Communications means outbound work Horizon owes. Send through normal email/phone, then record the fact. Mail links open email; the application sends nothing automatically. A manual task does not implicitly set a booking milestone.

Total fee = performance + travel + arrangements + other charges. Received = accepted deposit + other/final payments. Balance floors at zero; credits remain visible. Estimated profit subtracts all player fees and other costs. No invoice generator, bank or tax integration is included.
