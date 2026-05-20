-- =============================================
-- Bal Sanskar Shivir – Attendance Tables
-- Run this in the Supabase SQL Editor
-- =============================================

-- ATTENDANCE RECORDS
-- One row per student per class session per day.
-- id is deterministic: att_{date}_{class_num}_{student_id}
-- so upserts are idempotent (re-marking is safe).
create table if not exists attendance (
  id            text primary key,
  student_id    text references students(id) on delete set null,
  student_name  text not null,
  class_num     integer not null check (class_num in (1, 2, 3)),
  date          date not null,
  status        text not null default 'present'
                  check (status in ('present', 'absent', 'late', 'excused')),
  teacher_id    text references volunteers(id) on delete set null,
  teacher_name  text,
  day           integer,            -- matches currentDay (1–6 for a 6-day camp)
  timestamp     timestamptz default now(),
  unique(student_id, class_num, date)
);
alter table attendance disable row level security;

-- Fast look-ups: all records for a given date & session, or by teacher
create index if not exists attendance_date_class_idx on attendance(date, class_num);
create index if not exists attendance_teacher_date_idx on attendance(teacher_id, date);

-- ATTENDANCE SUBMISSIONS
-- One row per class session per day, written when the teacher hits Submit.
-- Tracks submission time and whether +5 pts have already been awarded.
create table if not exists attendance_submissions (
  id              text primary key,
  class_num       integer not null check (class_num in (1, 2, 3)),
  date            date not null,
  submitted_at    timestamptz not null default now(),
  teacher_id      text references volunteers(id) on delete set null,
  teacher_name    text,
  points_awarded  boolean default false,
  unique(class_num, date)
);
alter table attendance_submissions disable row level security;

-- ── Helpful views ──────────────────────────────────────────────────────────

-- Daily summary: present / absent / late / excused counts per session per day
create or replace view attendance_daily_summary as
select
  date,
  class_num,
  teacher_name,
  count(*) filter (where status = 'present') as present_count,
  count(*) filter (where status = 'absent')  as absent_count,
  count(*) filter (where status = 'late')    as late_count,
  count(*) filter (where status = 'excused') as excused_count,
  count(*) as total_count
from attendance
group by date, class_num, teacher_name;

-- Per-student attendance history (useful for admin reports)
create or replace view student_attendance_history as
select
  a.student_id,
  a.student_name,
  a.date,
  a.class_num,
  a.status,
  a.teacher_name,
  a.day,
  a.timestamp
from attendance a
order by a.date desc, a.class_num, a.student_name;

-- ── Run these if tables already exist (add missing columns) ───────────────
-- alter table attendance add column if not exists day integer;
-- alter table attendance add column if not exists teacher_name text;
-- alter table attendance_submissions add column if not exists points_awarded boolean default false;
