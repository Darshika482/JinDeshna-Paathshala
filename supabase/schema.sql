-- =============================================
-- jain-shivirOS – Supabase Schema
-- Run this in Supabase SQL Editor to set up all tables for a fresh instance.
--
-- FRESH INSTANCE: run the CREATE TABLE blocks.
-- EXISTING INSTANCE: run only the ALTER TABLE
--   blocks at the bottom (safe to re-run).
-- =============================================

-- ─── STUDENTS ────────────────────────────────────────────────────────────────
create table if not exists students (
  id              text primary key,
  roll_no         text not null,
  name            text not null,
  name_hi         text,
  mobile          text,
  class           text,          -- new format: 1A, 1B, 2A, 3B, 4A, etc.
  batch           text,          -- Bhag-1 / Bhag-2 / Bhag-3 / Bhag-4
  "group"         text,          -- class teacher name (English)
  group_hi        text,          -- class teacher name (Hindi)
  parent_name     text,
  father_name     text,
  mother_name     text,
  city            text,
  photo_url       text,
  reg_id          text,
  gender          text,
  age             integer,
  dob             date,
  whatsapp        text,
  health_issue    boolean default false,
  health_detail   text,
  pathshala       text,
  prev_shivir     boolean default false,
  kit_given       boolean default false,
  allotted_book   text,
  room_no         text,
  address         text,
  pin_code        text,
  achievements    text,
  total_points    integer default 0,
  day_points      integer[] default array[0,0,0,0,0,0],
  checked_in      boolean default false,
  checked_in_at   timestamptz
);
alter table students disable row level security;

-- ─── VOLUNTEERS (Class Teachers + Mentors) ───────────────────────────────────
create table if not exists volunteers (
  id                    text primary key,
  name                  text not null,
  name_hi               text,
  pin                   text not null,
  mobile                text,
  city                  text,
  availability          text,
  roles                 text[],
  assigned_activity     text,
  assigned_class        text,              -- primary class (new format: 1A, 2B…)
  assigned_classes      text[] default '{}',   -- all classes this teacher covers
  session_classes       jsonb  default '{}'::jsonb, -- {"1":"1A","2":"1B","3":"2A"}
  has_deduction_rights  boolean default false,
  responsibilities      text[]
);
alter table volunteers disable row level security;

-- ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
create table if not exists transactions (
  id              text primary key,
  student_id      text references students(id) on delete set null,
  student_name    text,
  volunteer_id    text,
  volunteer_name  text,
  points          integer default 0,
  coin_count      integer default 0,
  day             integer,
  slot            integer,
  activity        text,
  type            text,
  notes           text,
  timestamp       timestamptz default now(),
  flagged         boolean default false
);
alter table transactions disable row level security;

-- ─── COIN DISTRIBUTIONS ───────────────────────────────────────────────────────
create table if not exists coin_distributions (
  id              text primary key,
  activity        text,
  volunteer_name  text,
  coins_sent      integer,
  day             integer,
  slot            integer,
  timestamp       timestamptz default now()
);
alter table coin_distributions disable row level security;

-- ─── COIN RETURNS ─────────────────────────────────────────────────────────────
create table if not exists coin_returns (
  id              text primary key,
  slot            integer,
  volunteer_name  text,
  coins_returned  integer,
  day             integer,
  timestamp       timestamptz default now()
);
alter table coin_returns disable row level security;

-- ─── ATTENDANCE ───────────────────────────────────────────────────────────────
create table if not exists attendance (
  id              text primary key,  -- att_{date}_{class_num}_{student_id}
  student_id      text references students(id) on delete cascade,
  student_name    text,
  class_num       integer,
  date            date,
  status          text default 'unmarked',  -- present / absent / late / unmarked
  teacher_id      text,
  teacher_name    text,
  day             integer,
  timestamp       timestamptz default now()
);
alter table attendance disable row level security;
create index if not exists idx_attendance_date_class on attendance (date, class_num);
create index if not exists idx_attendance_student    on attendance (student_id);

-- ─── ATTENDANCE SUBMISSIONS ───────────────────────────────────────────────────
create table if not exists attendance_submissions (
  id              text primary key,  -- sub_{date}_{class_num}
  class_num       integer,
  date            date,
  submitted_at    timestamptz default now(),
  teacher_id      text,
  teacher_name    text,
  points_awarded  boolean default false
);
alter table attendance_submissions disable row level security;
create unique index if not exists idx_attendance_submissions_unique
  on attendance_submissions (class_num, date);

-- ─── EVENTS ───────────────────────────────────────────────────────────────────
create table if not exists events (
  id                  text primary key,
  name                text not null,
  time_slot           text,
  event_type          text,
  applicable_gender   text default 'Both',
  coin_pool_boys      integer default 0,
  coin_pool_girls     integer default 0,
  points_per_coin     integer default 1,
  responsible_role    text,
  notes               text,
  is_active           boolean default true,
  sort_order          integer default 0
);
alter table events disable row level security;

-- ─── EVENT RESPONSIBILITIES ───────────────────────────────────────────────────
create table if not exists event_responsibilities (
  id                  text primary key,
  event_id            text references events(id) on delete cascade,
  responsibility_text text,
  applies_to_role     text,
  sort_order          integer default 0
);
alter table event_responsibilities disable row level security;

-- ─── MENTOR EVENT ASSIGNMENTS ─────────────────────────────────────────────────
create table if not exists mentor_event_assignments (
  id          text primary key,
  mentor_id   text references volunteers(id) on delete cascade,
  event_id    text references events(id)     on delete cascade
);
alter table mentor_event_assignments disable row level security;

-- ─── GOOD BEHAVIOUR TYPES ─────────────────────────────────────────────────────
create table if not exists good_behaviour_types (
  id          text primary key,
  label       text not null,
  points      integer default 1,
  daily_cap   integer default 4,
  sort_order  integer default 0
);
alter table good_behaviour_types disable row level security;

-- ─── GOOD BEHAVIOUR LOGS ──────────────────────────────────────────────────────
create table if not exists good_behaviour_logs (
  id              text primary key,
  student_id      text references students(id) on delete cascade,
  student_name    text,
  mentor_id       text references volunteers(id) on delete set null,
  mentor_name     text,
  behaviour_type  text,
  points          integer default 1,
  day_number      integer,
  timestamp       timestamptz default now()
);
alter table good_behaviour_logs disable row level security;

-- ─── COIN COLLECTION LOGS ─────────────────────────────────────────────────────
create table if not exists coin_collection_logs (
  id              text primary key,
  student_id      text references students(id) on delete cascade,
  student_name    text,
  mentor_id       text references volunteers(id) on delete set null,
  mentor_name     text,
  coins_collected integer default 0,
  day_number      integer,
  timestamp       timestamptz default now()
);
alter table coin_collection_logs disable row level security;

-- ─── NEGATIVE MARKINGS ────────────────────────────────────────────────────────
create table if not exists negative_markings (
  id              text primary key,
  student_id      text references students(id) on delete cascade,
  student_name    text,
  mentor_id       text references volunteers(id) on delete set null,
  mentor_name     text,
  reason          text,
  points          integer default 0,
  day_number      integer,
  timestamp       timestamptz default now()
);
alter table negative_markings disable row level security;

-- ─── ROOM DISCIPLINE LOGS ─────────────────────────────────────────────────────
create table if not exists room_discipline_logs (
  id                    text primary key,
  room_number           text,
  gender                text,
  mentor_id             text references volunteers(id) on delete set null,
  mentor_name           text,
  day_number            integer,
  points_awarded        integer default 0,
  mentor_prize_awarded  boolean default false,
  timestamp             timestamptz default now()
);
alter table room_discipline_logs disable row level security;

-- ─── ROOM WAKEUP ASSIGNMENTS ──────────────────────────────────────────────────
create table if not exists room_wakeup_assignments (
  id          text primary key,
  room_number text,
  mentor_id   text references volunteers(id) on delete set null,
  mentor_name text,
  day_number  integer,
  timestamp   timestamptz default now()
);
alter table room_wakeup_assignments disable row level security;

-- ─── SHIVIR CONFIG ────────────────────────────────────────────────────────────
create table if not exists shivir_config (
  key   text primary key,
  value text
);
alter table shivir_config disable row level security;

-- ─── HELPER VIEWS ─────────────────────────────────────────────────────────────
create or replace view attendance_daily_summary as
  select
    date,
    class_num,
    count(*) filter (where status = 'present') as present_count,
    count(*) filter (where status = 'absent')  as absent_count,
    count(*) filter (where status = 'late')    as late_count,
    count(*)                                   as total_count
  from attendance
  group by date, class_num;

create or replace view student_attendance_history as
  select
    a.student_id,
    s.name  as student_name,
    s.class as student_class,
    a.date,
    a.class_num,
    a.status,
    a.teacher_name,
    a.day
  from attendance a
  join students s on s.id = a.student_id;


-- =============================================
-- ALTER STATEMENTS
-- Run these if the tables already exist.
-- Every statement uses IF NOT EXISTS — safe to re-run.
-- =============================================

-- students: columns added after initial creation
alter table students add column if not exists name_hi         text;
alter table students add column if not exists father_name     text;
alter table students add column if not exists mother_name     text;
alter table students add column if not exists reg_id          text;
alter table students add column if not exists gender          text;
alter table students add column if not exists age             integer;
alter table students add column if not exists dob             date;
alter table students add column if not exists whatsapp        text;
alter table students add column if not exists health_issue    boolean default false;
alter table students add column if not exists health_detail   text;
alter table students add column if not exists pathshala       text;
alter table students add column if not exists prev_shivir     boolean default false;
alter table students add column if not exists kit_given       boolean default false;
alter table students add column if not exists allotted_book   text;
alter table students add column if not exists room_no         text;
alter table students add column if not exists group_hi        text;
alter table students add column if not exists checked_in_at   timestamptz;
alter table students add column if not exists address         text;
alter table students add column if not exists pin_code        text;
alter table students add column if not exists achievements    text;

-- volunteers: columns added after initial creation
alter table volunteers add column if not exists name_hi             text;
alter table volunteers add column if not exists city                text;
alter table volunteers add column if not exists availability        text;
alter table volunteers add column if not exists assigned_class      text;
alter table volunteers add column if not exists assigned_classes    text[]  default '{}';
alter table volunteers add column if not exists session_classes     jsonb   default '{}'::jsonb;
alter table volunteers add column if not exists has_deduction_rights boolean default false;
alter table volunteers add column if not exists responsibilities    text[];

-- transactions: columns added after initial creation
alter table transactions add column if not exists coin_count integer default 0;
alter table transactions add column if not exists type       text;
alter table transactions add column if not exists notes      text;
