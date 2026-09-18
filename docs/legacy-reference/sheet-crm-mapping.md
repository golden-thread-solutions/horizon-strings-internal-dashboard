# Event Details Sheet -> CRM Mapping

## Source Read

Spreadsheet:

`Event Details`

Spreadsheet ID:

`EVENT_DETAILS_SPREADSHEET_ID`

Ranges inspected:

- `Clients!A1:N20`
- `Client Sheet Template!A1:AK60`
- `Sample Client - E9001!A1:AK90`
- `Tasks!A1:S25`
- `Finance!A1:U25`
- `Musicians!A1:T25`
- `Arrangements!A1:R25`
- `Settings!A1:M40`
- `Task Rules!A1:J50`
- `Template Map!A1:H50`
- `Event Overview!A1:Z12`
- `Client Tasks!A1:AA12`
- `Client progression!A1:AG12`
- `Event timing!A1:AG12`
- `Event logistics!A1:AF12`
- `Contact details!A1:AD12`
- `Event repertoire!A1:AB12`
- `Repertoire!A1:Z20`
- `[[ACRCHIVE] Finance!A1:AH12`
- `Archive - Events!A1:BA12`
- `Sheet Notes!A1:AA20`
- `Client Intake!A1:Y12`

## What The Sheet Is Doing

The workbook is both a CRM and an operating checklist.

It has three layers:

1. `Clients` is the master index.
2. Each client/event tab is the operational source of truth for that event.
3. Hub tabs pull repeated slices from client sheets: tasks, finance, musicians, arrangements, timing, logistics, contact details, repertoire, and progression.

The CRM should not reproduce the spreadsheet layout exactly. It should preserve the useful records and relationships behind it.

## Clients Tab

Source range:

`Clients!A:N`

Fields:

- Active
- Event ID
- First Name
- Client Name
- Sheet Name
- Event Date
- Event Type
- Status
- Sheet Created
- Created Date
- Archive/non sale
- Notes
- Source
- Last Refresh

CRM mapping:

- `events.event_code`
- `events.first_name`
- `clients.display_name`
- `events.source_sheet_name`
- `events.event_date`
- `events.event_type`
- `events.stage`
- `events.sheet_created`
- `events.created_date`
- `events.archive_non_sale`
- `events.internal_notes`
- `events.source`
- `events.last_refresh`

## Client Event Tabs

Example read:

`Sample Client - E9001!A1:AK90`

Template read:

`Client Sheet Template!A1:AK60`

Important sections:

- Main details
- Contact details
- Timing details
- Location details
- Wet weather
- Musicians
- Finance
- Client contact
- Other logistics
- Tasks
- Setlist
- Pending arrangements

Important design point:

The Apps Script uses marker cells such as `#MAIN_DETAILS`, `#TASKS`, `#MUSICIANS`, `#FINANCE`, and `#PENDING_ARRANGEMENTS`.

CRM decision:

Keep marker knowledge in import/mapping tables, but show normal dashboard sections to the user.

## Tasks

There are two task systems in the workbook.

### Template / generated tasks

Source:

`Task Rules!A:J`

Fields:

- Active
- Stage
- Task
- Due Basis
- Offset Days
- Default Done
- Notes
- Template Row
- Category
- Owner

CRM mapping:

- `task_rules`
- generated `tasks`

These are workflow rules, not just manually typed tasks.

### Manual / CRM tasks

Source:

`Client Tasks!A:AA`

Fields:

- Event ID
- Name
- Event date
- Task ID
- Category
- Assignee
- Details
- Notes
- Due date
- Urgency (1-10)
- Status

CRM mapping:

- `tasks.external_task_id`
- `tasks.category`
- `tasks.assignee`
- `tasks.title`
- `tasks.notes`
- `tasks.due_date`
- `tasks.urgency`
- `tasks.status`

Dashboard implication:

The action page should combine generated workflow tasks and manual CRM tasks.

## Finance

Current hub:

`Finance!A:U`

Archived finance model:

`[[ACRCHIVE] Finance!A:AH`

Fields include:

- Deposit
- Deposit paid date / received state
- Performance fee
- Travel fee
- Arrangement fee
- Other
- Total paid
- Total quoted
- Deposit sent
- Final invoice sent
- Final invoice paid
- Number of players
- Total duration
- Hourly rate

CRM mapping:

- `payments`
- `event_costs`
- event-level summary fields where useful

Important rule:

Deposit invoice sent and deposit received must stay separate.

## Musicians

Source:

`Musicians!A:T`

Fields:

- Event ID
- Client
- Event date
- Ensemble
- Musician
- Instrument
- Finalised
- Music sent
- Notes
- Signed
- Paid

CRM mapping:

- `musicians`
- `event_musicians`

Important rule:

Musicians sorted should be due 3 months before the event.

Potential naming issue:

The Sheet uses `Finalised`, while the prototype used `confirmed`. In the app, use `finalised` as the underlying field and display it as confirmed/sorted where that reads better.

## Repertoire And Arrangements

Sources:

- `Event repertoire!A:AB`
- `Arrangements!A:R`

Fields include:

- Genre preference
- Ceremony notes
- Groomsmen entry
- Bridal party entry
- Signing of the register
- Recessional
- Reception entrance
- First dance
- Other
- Pending arrangement
- Due date

CRM mapping:

- `repertoire_items`
- `event_repertoire`

Important rule:

Setlist sorted should be due 6 weeks before the event.

## Timing

Source:

`Event timing!A:AG`

Fields include:

- Date
- Day
- Arrival time
- Playing duration
- Play start time
- Pre ceremony playtime
- Ceremony start
- Ceremony duration
- Remaining playtime
- Post ceremony details
- Other start/finish time

CRM mapping:

- timing fields on `events`

Later improvement:

If timing becomes more complex, use an `event_timeline_items` table. Do not add it yet unless event runsheets become important.

## Logistics

Source:

`Event logistics!A:AF`

Fields include:

- Area
- Arrival address
- Inside/outside
- Details
- Wet weather location change
- Wet weather address
- Time of rain call
- Second address
- Secret signal
- Gazebo/shelter
- Dress code
- Chairs
- Guests

CRM mapping:

- explicit event fields for the high-value items;
- `events.logistics` JSON for miscellaneous operational detail.

## Contacts

Source:

`Contact details!A:AD`

Contact groups:

- Main contact
- On the day contact
- Celebrant
- Couple
- Other contact

CRM mapping:

- `clients`
- `event_contacts`
- `events.bride_name`
- `events.groom_name`
- `events.couple_other`

## Progression

Source:

`Client progression!A:AG`

Fields include:

- Contact medium
- How did you hear about us
- Enquiry details
- Welcome/deposit email sent
- Follow up
- Deposit received
- Call time confirmed
- Musicians confirmed
- Musicians sent contract
- Setlist confirmed
- Music in drive
- Other tasks
- Post event texts
- Pay musicians

CRM mapping:

- `events.contact_medium`
- `events.heard_about_us`
- `events.enquiry_details`
- `events.enquiry_notes`
- `event_checkpoints`
- `tasks`
- `communication_logs`

Important design point:

Progression should be calculated from reality where possible, not manually maintained as a loose status.

## Settings

Source:

`Settings!A:M`

Contains controlled lists and defaults:

- musicians
- instruments
- ensemble types
- task stages
- task statuses
- finance items
- event types
- date basis values
- default deposit
- default hourly rate
- default invoice/review offsets

CRM mapping:

- keep fixed app constants for v0.5;
- later move configurable lists into settings tables if needed.

## Database Changes Made From This Mapping

Added migration:

`supabase/migrations/0002_sheet_crm_alignment.sql`

It adds:

- sheet/source tracking on events;
- archive/non-sale and sheet-created flags;
- enquiry/progression fields;
- couple fields;
- more logistics fields;
- manual task IDs, assignee, category, urgency, due-basis, offset fields;
- musician finalised/contract fields;
- task rule table;
- sheet template mapping table.
- business settings for workflow defaults and due-date offsets.

## Configurable Checkpoint Settings

The live Sheet has task rules that currently use 6 months for musician organisation and 4 months for arrangement work.

The CRM should not blindly inherit those timings because the product decision is:

- musicians sorted: around 3 months before the event;
- setlist sorted: 6 weeks before the event.

Therefore the CRM stores these as settings:

- `musicians_sorted_days_before_event`
- `setlist_sorted_days_before_event`

The dashboard currently displays them in Settings and uses them when generating checkpoint due dates.

## Dashboard Changes Still Needed

The current dashboard already shows the main CRM areas, but the next build pass should:

- use `finalised` wording for musician booking status;
- add manual task ID, assignee, category, and urgency to task views;
- add enquiry/progression fields to individual event pages;
- split logistics into clearer sections: location, wet weather, second address, setup details;
- show client source sheet/name data for audit while we transition from Sheets.
