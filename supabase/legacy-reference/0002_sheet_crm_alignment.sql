alter table events
  add column if not exists active boolean not null default true,
  add column if not exists archive_non_sale boolean not null default false,
  add column if not exists sheet_created boolean not null default false,
  add column if not exists source_spreadsheet_id text,
  add column if not exists source_sheet_id integer,
  add column if not exists source_sheet_name text,
  add column if not exists first_name text,
  add column if not exists contact_medium text,
  add column if not exists heard_about_us text,
  add column if not exists enquiry_details text,
  add column if not exists enquiry_notes text,
  add column if not exists bride_name text,
  add column if not exists groom_name text,
  add column if not exists couple_other text,
  add column if not exists in_outside text,
  add column if not exists wet_weather_location_change text,
  add column if not exists wet_weather_rain_call_time text,
  add column if not exists second_address_required text,
  add column if not exists second_address_details text,
  add column if not exists rehearsal_required text,
  add column if not exists wedding_rehearsal_notes text;

alter table tasks
  add column if not exists external_task_id text,
  add column if not exists assignee text,
  add column if not exists category text,
  add column if not exists urgency integer check (urgency is null or (urgency >= 1 and urgency <= 10)),
  add column if not exists due_basis text,
  add column if not exists offset_days integer,
  add column if not exists template_row integer,
  add column if not exists pending boolean;

alter table event_musicians
  add column if not exists finalised boolean,
  add column if not exists contract_sent boolean not null default false;

alter table event_repertoire
  add column if not exists section text,
  add column if not exists genre_preference text,
  add column if not exists source_summary text;

alter table communication_logs
  add column if not exists medium text,
  add column if not exists follow_up_date date;

create table if not exists task_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  active boolean not null default true,
  stage text not null,
  task text not null,
  due_basis text not null,
  offset_days integer not null default 0,
  default_done boolean not null default false,
  notes text,
  template_row integer,
  category text,
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_rules_business_id_idx on task_rules(business_id);
create index if not exists task_rules_stage_idx on task_rules(stage);

create table if not exists sheet_template_mappings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  area text not null,
  field_name text not null,
  source_range text not null,
  direction text,
  used_by text,
  notes text,
  required boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists sheet_template_mappings_business_id_idx on sheet_template_mappings(business_id);
create index if not exists sheet_template_mappings_area_idx on sheet_template_mappings(area);

create table if not exists business_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  key text not null,
  value jsonb not null,
  label text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, key)
);

create index if not exists business_settings_business_id_idx on business_settings(business_id);

comment on column events.archive_non_sale is 'Maps from Clients!K Archive/non sale. Kept separate from archived because it describes why a record is not active.';
comment on column events.sheet_created is 'Maps from Clients!I Sheet Created.';
comment on column events.source_sheet_name is 'Original Event Details client tab name, such as Sample Client - E9001.';
comment on table task_rules is 'Database version of the Task Rules tab used to generate workflow tasks.';
comment on table sheet_template_mappings is 'Database copy of the Template Map tab for future Google Sheets import/audit logic.';
comment on table business_settings is 'Simple key/value settings for Horizon workflow defaults, such as checkpoint due offsets.';
