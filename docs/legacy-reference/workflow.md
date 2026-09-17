# Workflow Rules - v0.5

## Stages

Current working stages:

1. New
2. Qualifying
3. Quote Sent
4. Booking Pending
5. Booked
6. Planning
7. Ready
8. Completed
9. Closed

The existing Sheet currently uses simpler labels such as New and Booked. v0.5 supports the more detailed structure but does not force full migration yet.

## Key Checkpoints

### Deposit Invoice Sent

This is a major checkpoint. It should be surfaced separately from deposit received.

### Deposit Received

This is a major booking checkpoint. Later workflow progression into Booked should depend on this unless manually waived.

### Musicians Sorted

Due based on the setting `musiciansSortedDaysBeforeEvent`.

Current v0.5 value:

`92 days before event`

This is approximately 3 months before the event.

Complete when required musicians are confirmed.

### Setlist Sorted

Due based on the setting `setlistSortedDaysBeforeEvent`.

Current v0.5 value:

`42 days before event`

This is 6 weeks before the event.

Complete when requested pieces are available, approved, or marked N/A.

## Current Process Notes

- Same-day response policy unless a message arrives after 5 pm.
- Intro/welcome/deposit email should be available at button press later.
- Introductory call should collect missing form/event details.
- Follow-up call should review unresolved information.
- Outdoor events need wet weather and shelter checks.
- Full amount is due two weeks before the event.
- Musicians need dress code, music, water bottle, stand, and 30-minute early arrival.

## Sheet vs CRM Timing Note

The current `Event Details` Sheet has some older task-rule timings:

- Contact and organise musicians: 6 months before event.
- Arrange / find necessary pieces: 4 months before event.

The CRM keeps those source rules for reference, but the main product checkpoints use configurable settings:

- Musicians sorted: 92 days before event.
- Setlist sorted: 42 days before event.

This means we can adjust checkpoint timing later without rewriting workflow logic.
