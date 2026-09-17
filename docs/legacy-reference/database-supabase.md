# Supabase Database Notes

## Purpose

This database structure prepares the internal dashboard for online use without forcing the app to switch away from local data immediately.

## Generic vs Horizon-Specific

Generic tables:

- `businesses`
- `clients`
- `events`
- `tasks`
- `event_notes`

These could be reused for other small-business operating dashboards later.

Horizon-specific tables:

- `event_musicians`
- `event_repertoire`
- `repertoire_items`
- `payments`
- `event_costs`
- `event_checkpoints`
- `communication_logs`

These are still understandable business concepts, but they are shaped around Horizon's actual work.

## Why This Shape

The event is the main operational record.

Tasks, payments, contacts, musicians, repertoire, communications, and notes attach to an event.

Checkpoints are stored separately because they are not just normal notes. Deposit invoice sent, deposit received, musicians sorted, and setlist sorted are business-critical operational markers.

## Event Details Mapping Pass

The schema has now been checked against the live Google Sheet called `Event Details`.

See:

`docs/sheet-crm-mapping.md`

The second migration adds fields and tables found in the live workbook:

- source sheet/tab tracking;
- `Archive/non sale`;
- `Sheet Created`;
- enquiry/progression fields;
- bride/groom/other couple fields;
- detailed wet weather and logistics fields;
- manual CRM task fields such as task ID, assignee, category, urgency, due basis, and offset days;
- musician `finalised`;
- task rules;
- template map records.
- business settings for workflow defaults and due-date offsets.

Initial settings:

- `default_deposit_amount`: 400
- `musicians_sorted_days_before_event`: 92
- `setlist_sorted_days_before_event`: 42
- `final_invoice_lead_days`: 14
- `review_request_days_after_event`: 7

## Current Security Position

Row Level Security is enabled in the migration, but no user policies are added yet.

For the next step, the app should read database data server-side only. That lets the dashboard use a Supabase service role key without exposing that key in browser code.

When proper login is added, policies can be added for admin users and roles.

## Not Included Yet

- Client portal tables.
- Musician portal tables.
- Full user/role permissions.
- Generic workflow builder.
- Bank transaction import.
- Google Sheets migration scripts.
