# Data Model - v0.5

## Core Records

### Event

The main operational record. It currently combines what the spreadsheet stores across a client tab and hub tabs.

Key fields:

- event ID
- client name
- event date
- event type
- stage
- main details
- contacts
- timings
- location
- logistics
- musicians
- repertoire
- finance
- communication log
- tasks

### Contact

Contacts are attached to events for now:

- main contact
- on-the-day contact
- celebrant
- other contact

Later these can become reusable people records.

### Task

Tasks may be manually recorded or generated from workflow checkpoints.

Sources:

- Workflow
- Manual
- Finance
- Musicians
- Repertoire

### Checkpoint

Important checkpoints:

- deposit invoice sent
- deposit received
- musicians sorted
- setlist sorted

Checkpoint tasks are generated when reality says the checkpoint is not complete.

### Musician Booking

Event-specific musician status:

- name
- instrument
- confirmed
- music sent
- signed
- paid

### Repertoire Request

Event-specific piece or song request:

- moment
- piece
- status
- notes

## Future Database Direction

When moving to Supabase, these should become relational tables:

- businesses
- contacts
- events
- tasks
- event_checkpoints
- event_musicians
- repertoire_items
- event_repertoire
- payments
- event_costs
- communication_logs
- workflow_rules

## Supabase Prep Added

The first migration is in:

`supabase/migrations/0001_initial_horizon_schema.sql`

Dummy seed data is in:

`supabase/seed.sql`

Sheet-specific alignment is in:

`supabase/migrations/0002_sheet_crm_alignment.sql`

The live `Event Details` mapping notes are in:

`docs/sheet-crm-mapping.md`

The schema keeps the current Horizon concepts readable while leaving a reusable base underneath:

- one `businesses` record for Horizon Strings;
- `clients` as reusable people/business contacts;
- `events` as the central job/event record;
- linked tables for contacts, tasks, musicians, repertoire, payments, costs, communication logs, notes, and checkpoints.

## Important Refinements From The Live Sheet

The live Sheet has a separate client/event index, event tabs, hub tabs, task rules, and a template map. The database should therefore support:

- source sheet tracking during migration;
- manual tasks as well as generated workflow tasks;
- task assignee, category, urgency, and external task ID;
- client progression fields such as contact medium, enquiry details, and deposit/follow-up checkpoints;
- detailed logistics such as inside/outside, wet weather plan, second address, rain-call time, shelter, dress code, chairs, and guest count;
- finance line items and paid dates rather than one simple amount field only.
