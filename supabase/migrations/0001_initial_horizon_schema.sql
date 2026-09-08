create extension if not exists pgcrypto;

create type event_stage as enum (
  'New',
  'Qualifying',
  'Quote Sent',
  'Booking Pending',
  'Booked',
  'Planning',
  'Ready',
  'Completed',
  'Closed'
);

create type task_status as enum ('Not started', 'In progress', 'Done', 'Blocked');
create type task_source as enum ('Workflow', 'Manual', 'Finance', 'Musicians', 'Repertoire');
create type task_priority as enum ('High', 'Medium', 'Low');
create type repertoire_status as enum ('Unknown', 'Requested', 'Available', 'Needs arranging', 'Approved', 'N/A');

create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  display_name text not null,
  primary_email text,
  primary_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  event_code text not null unique,
  sheet_name text,
  event_type text not null default 'Wedding',
  stage event_stage not null default 'New',
  event_date date,
  archived boolean not null default false,
  source text not null default 'Dashboard',
  created_date date not null default current_date,
  last_refresh timestamptz,
  playing_minutes integer,
  ensemble text,
  event_day text,
  internal_notes text,
  location_area text,
  location_address text,
  location_details text,
  wet_weather_area text,
  wet_weather_address text,
  wet_weather_details text,
  arrival_time text,
  pre_ceremony_time text,
  play_start_time text,
  ceremony_start_time text,
  ceremony_duration text,
  remaining_time text,
  logistics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_business_id_idx on events(business_id);
create index events_client_id_idx on events(client_id);
create index events_stage_idx on events(stage);
create index events_event_date_idx on events(event_date);

create table event_contacts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  role text not null,
  name text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  title text not null,
  stage text,
  status task_status not null default 'Not started',
  due_date date,
  source task_source not null default 'Manual',
  priority task_priority not null default 'Medium',
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_business_id_idx on tasks(business_id);
create index tasks_event_id_idx on tasks(event_id);
create index tasks_due_date_idx on tasks(due_date);
create index tasks_status_idx on tasks(status);

create table event_checkpoints (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  label text not null,
  due_date date,
  completed boolean not null default false,
  completed_at timestamptz,
  detail text,
  source task_source not null default 'Workflow',
  created_at timestamptz not null default now(),
  unique (event_id, label)
);

create table musicians (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  instrument text not null,
  status text not null default 'Active',
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table event_musicians (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  musician_id uuid references musicians(id) on delete set null,
  display_name text not null,
  instrument text not null,
  confirmed boolean not null default false,
  music_sent boolean not null default false,
  signed boolean not null default false,
  paid boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table repertoire_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  title text not null,
  composer_or_artist text,
  arrangement_status text not null default 'Unknown',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table event_repertoire (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  repertoire_item_id uuid references repertoire_items(id) on delete set null,
  moment text not null,
  piece text,
  status repertoire_status not null default 'Unknown',
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  label text not null,
  amount numeric(10, 2) not null default 0,
  required_amount numeric(10, 2),
  invoice_sent boolean not null default false,
  invoice_reference text,
  received boolean not null default false,
  received_at date,
  notes text,
  created_at timestamptz not null default now()
);

create table event_costs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  label text not null,
  amount numeric(10, 2) not null default 0,
  category text not null default 'Other',
  paid boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table communication_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  label text not null,
  communication_date date,
  done boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table event_notes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

alter table businesses enable row level security;
alter table clients enable row level security;
alter table events enable row level security;
alter table event_contacts enable row level security;
alter table tasks enable row level security;
alter table event_checkpoints enable row level security;
alter table musicians enable row level security;
alter table event_musicians enable row level security;
alter table repertoire_items enable row level security;
alter table event_repertoire enable row level security;
alter table payments enable row level security;
alter table event_costs enable row level security;
alter table communication_logs enable row level security;
alter table event_notes enable row level security;

comment on table businesses is 'Generic enough for future reuse, but v0.5 will create one Horizon Strings business.';
comment on table events is 'Horizon-facing event/job record. Generic job concepts are kept, Horizon-specific fields are explicit and readable.';
comment on table event_checkpoints is 'Reality-based checkpoints such as deposit invoice sent, deposit received, musicians sorted, and setlist sorted.';
