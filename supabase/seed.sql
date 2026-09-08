insert into businesses (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Horizon Strings')
on conflict do nothing;

insert into clients (id, business_id, display_name, primary_email, primary_phone, notes)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Sample enquiry', null, null, 'Dummy client for online database testing.'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Sample booked wedding', null, null, 'Dummy client with deposit received.'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Sample planning event', null, null, 'Dummy client with repertoire and musician work.')
on conflict do nothing;

insert into events (
  id,
  business_id,
  client_id,
  event_code,
  sheet_name,
  event_type,
  stage,
  event_date,
  source,
  created_date,
  playing_minutes,
  ensemble,
  location_area,
  logistics
)
values
  (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000101',
    'E9001',
    'Sample enquiry - E9001',
    'Wedding',
    'New',
    current_date + interval '90 days',
    'Seed',
    current_date,
    90,
    'Quartet',
    null,
    '{"Shelter": "", "Dress code": "", "Guest count": ""}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000102',
    'E9002',
    'Sample booked - E9002',
    'Wedding',
    'Booked',
    current_date + interval '180 days',
    'Seed',
    current_date,
    120,
    'Quartet',
    'Coffs Harbour',
    '{"Shelter": "Confirmed", "Dress code": "Black formal"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000203',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000103',
    'E9003',
    'Sample planning - E9003',
    'Wedding',
    'Planning',
    current_date + interval '35 days',
    'Seed',
    current_date,
    150,
    'Trio',
    'Byron Bay',
    '{"Shelter": "Needs confirmation", "Amplification": "TBD"}'::jsonb
  )
on conflict do nothing;

insert into event_contacts (event_id, role, name, phone, email)
values
  ('00000000-0000-0000-0000-000000000201', 'Main contact', 'Sample enquiry', null, null),
  ('00000000-0000-0000-0000-000000000202', 'Main contact', 'Sample booked wedding', null, null),
  ('00000000-0000-0000-0000-000000000203', 'Main contact', 'Sample planning event', null, null);

insert into tasks (business_id, event_id, title, stage, status, due_date, source, priority, notes)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', 'Respond to enquiry', 'First contact', 'Not started', current_date, 'Workflow', 'High', 'Same-day response target.'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', 'Send deposit invoice if booking proceeds', 'Finance', 'Not started', current_date + interval '3 days', 'Finance', 'High', 'Deposit invoice sent is a formal checkpoint.'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000203', 'Confirm wet weather shelter', 'Logistics', 'Not started', current_date + interval '7 days', 'Workflow', 'High', 'Outdoor strings need shelter clarity.'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000203', 'Finish setlist', 'Repertoire', 'Not started', current_date + interval '14 days', 'Repertoire', 'High', 'Setlist sorted checkpoint is due six weeks before event.');

insert into event_checkpoints (event_id, label, due_date, completed, detail, source)
values
  ('00000000-0000-0000-0000-000000000201', 'Deposit invoice sent', current_date, false, 'Needs sending when booking is ready.', 'Finance'),
  ('00000000-0000-0000-0000-000000000201', 'Deposit received', current_date + interval '7 days', false, '$0 / $400', 'Finance'),
  ('00000000-0000-0000-0000-000000000202', 'Deposit invoice sent', current_date, true, 'Sent', 'Finance'),
  ('00000000-0000-0000-0000-000000000202', 'Deposit received', current_date, true, '$400 / $400', 'Finance'),
  ('00000000-0000-0000-0000-000000000203', 'Musicians sorted', current_date - interval '57 days', false, 'Due three months before event.', 'Musicians'),
  ('00000000-0000-0000-0000-000000000203', 'Setlist sorted', current_date - interval '7 days', false, 'Due six weeks before event.', 'Repertoire');

insert into musicians (id, business_id, name, instrument, status, notes)
values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', 'Sample violinist', 'Violin', 'Active', 'Dummy roster member.'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001', 'Sample cellist', 'Cello', 'Active', 'Dummy roster member.')
on conflict do nothing;

insert into event_musicians (event_id, musician_id, display_name, instrument, confirmed, music_sent, signed, paid)
values
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000301', 'Sample violinist', 'Violin', true, false, false, false),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000302', 'Sample cellist', 'Cello', true, false, false, false);

insert into event_repertoire (event_id, moment, piece, status, sort_order)
values
  ('00000000-0000-0000-0000-000000000203', 'Processional', 'Sample modern song', 'Needs arranging', 1),
  ('00000000-0000-0000-0000-000000000203', 'Signing', 'Sample classical piece', 'Available', 2),
  ('00000000-0000-0000-0000-000000000203', 'Recessional', 'Sample upbeat song', 'Requested', 3);

insert into payments (event_id, label, amount, required_amount, invoice_sent, received, received_at, notes)
values
  ('00000000-0000-0000-0000-000000000201', 'Deposit', 0, 400, false, false, null, 'Dummy deposit not yet sent.'),
  ('00000000-0000-0000-0000-000000000202', 'Deposit', 400, 400, true, true, current_date, 'Dummy deposit received.'),
  ('00000000-0000-0000-0000-000000000202', 'Final payment', 0, 1400, false, false, null, 'Dummy final balance.');

insert into event_costs (event_id, label, amount, category, paid)
values
  ('00000000-0000-0000-0000-000000000202', 'Musician costs', 800, 'Musicians', false),
  ('00000000-0000-0000-0000-000000000203', 'Musician costs', 600, 'Musicians', false);

insert into communication_logs (event_id, label, communication_date, done, notes)
values
  ('00000000-0000-0000-0000-000000000201', 'Enquiry received', current_date, true, 'Dummy communication log.'),
  ('00000000-0000-0000-0000-000000000202', 'Deposit received', current_date, true, 'Dummy communication log.');

insert into task_rules (
  business_id,
  active,
  stage,
  task,
  due_basis,
  offset_days,
  default_done,
  notes,
  template_row,
  category,
  owner
)
values
  ('00000000-0000-0000-0000-000000000001', true, 'First contact', 'Respond to enquiry', 'Manual date', 0, false, 'Same-day response policy unless after 6 pm.', 3, 'Communication', 'Koby'),
  ('00000000-0000-0000-0000-000000000001', true, 'First contact', 'Schedule follow up', 'Manual date', 7, false, '1 week after our reply.', 4, 'Communication', 'Koby'),
  ('00000000-0000-0000-0000-000000000001', true, 'Primary call', 'Schedule call', 'Manual date', 0, false, null, 5, 'Communication', 'Koby'),
  ('00000000-0000-0000-0000-000000000001', true, 'Primary call', 'Call', 'Primary call date', 0, false, 'Becomes a task on the day it is scheduled.', 7, 'Communication', 'Koby'),
  ('00000000-0000-0000-0000-000000000001', true, 'Internal set up', 'Send setlist', 'Primary call date', 4, false, 'Within 3 days of primary call email.', 12, 'Setlist', 'Koby'),
  ('00000000-0000-0000-0000-000000000001', true, 'Internal set up', 'Contact and organise musicians', 'Event date', -180, false, '6 months before event in the Sheet. Product checkpoint target may become 3 months before event.', 14, 'Musicians', 'Koby'),
  ('00000000-0000-0000-0000-000000000001', true, 'Internal set up', 'Arrange / find necessary pieces', 'Event date', -120, false, '4 months before event in the Sheet. Product checkpoint target may become 6 weeks before event.', 15, 'Setlist', 'Koby'),
  ('00000000-0000-0000-0000-000000000001', true, 'Final call', 'Schedule date for final call', 'Event date', -50, false, '1 month before event; walk through the day.', 18, 'Communication', 'Koby'),
  ('00000000-0000-0000-0000-000000000001', true, 'Event day post', 'Send review request', 'Event date', 7, false, null, 24, 'Communication', 'Koby');

insert into sheet_template_mappings (
  business_id,
  area,
  field_name,
  source_range,
  direction,
  used_by,
  notes,
  required,
  active
)
values
  ('00000000-0000-0000-0000-000000000001', 'Main Details', 'Client name', 'A3', 'Client sheet -> hubs', 'Apps Script', 'Manual source-of-truth value.', true, true),
  ('00000000-0000-0000-0000-000000000001', 'Main Details', 'Event date', 'B3', 'Client sheet -> hubs', 'Task due dates, dashboard', 'Use real date value.', true, true),
  ('00000000-0000-0000-0000-000000000001', 'Main Details', 'Event ID', 'E3', 'Client sheet -> hubs', 'All hubs', 'Stable unique ID for the client sheet.', true, true),
  ('00000000-0000-0000-0000-000000000001', 'Contacts', 'Contact table', 'A5:E9', 'Client sheet -> hubs', 'Future contact hub', null, false, true),
  ('00000000-0000-0000-0000-000000000001', 'Tasks', 'Task rules / source list', 'R2:W24', 'Client sheet -> Pending Tasks Hub', 'Apps Script', 'T is Done, U is Pending, V is Date.', true, true),
  ('00000000-0000-0000-0000-000000000001', 'Markers', 'Marker columns', 'Client sheets!AH:AJ', 'Marker -> section detection', 'Apps Script', 'Scripts find #SECTION markers rather than fixed rows.', true, true);

insert into business_settings (business_id, key, value, label, notes)
values
  ('00000000-0000-0000-0000-000000000001', 'default_deposit_amount', '400'::jsonb, 'Default deposit amount', 'Current default placeholder from Event Details settings.'),
  ('00000000-0000-0000-0000-000000000001', 'musicians_sorted_days_before_event', '92'::jsonb, 'Musicians sorted due date', 'CRM setting. Product preference is around 3 months before event.'),
  ('00000000-0000-0000-0000-000000000001', 'setlist_sorted_days_before_event', '42'::jsonb, 'Setlist sorted due date', 'CRM setting. Product preference is 6 weeks before event.'),
  ('00000000-0000-0000-0000-000000000001', 'final_invoice_lead_days', '14'::jsonb, 'Final payment target', 'Full payment should be received two weeks before event.'),
  ('00000000-0000-0000-0000-000000000001', 'review_request_days_after_event', '7'::jsonb, 'Review request timing', 'Default review request offset.')
on conflict (business_id, key) do update
set value = excluded.value,
    label = excluded.label,
    notes = excluded.notes;
