-- =============================================
-- Paathshala Registration Migration
-- Run this in Supabase SQL Editor
-- =============================================

-- ─── PAATHSHALAS ─────────────────────────────────────────────────────────────
create table if not exists paathshalas (
  id                        text primary key,
  paathshala_code           text unique not null,   -- 2-digit sequential: 01, 02, 03...
  paathshala_name           text not null,
  address                   text,
  teacher1_name             text,
  teacher1_mobile           text,
  teacher1_address          text,
  teacher2_name             text,
  teacher2_mobile           text,
  teacher2_address          text,
  mandal_president_name     text,
  mandal_president_mobile   text,
  mandal_secretary_name     text,
  mandal_secretary_mobile   text,
  description               text,
  pathshala_type            text,                   -- Daily / Weekly / Half-Yearly / Summer
  classes_conducted         text[] default '{}',    -- Kids Group / Children Group / Senior Group
  students_2_5              integer default 0,
  students_6_10             integer default 0,
  students_11_15            integer default 0,
  students_15_21            integer default 0,
  other_details             text,
  special_activities        text,
  created_at                timestamptz default now()
);
alter table paathshalas disable row level security;

-- ─── ALTER STUDENTS ───────────────────────────────────────────────────────────
-- Link students to a paathshala via its 2-digit code
alter table students add column if not exists paathshala_code text;

-- Index for fast lookups of students by paathshala
create index if not exists idx_students_paathshala_code on students(paathshala_code);

-- ─── ALTER VOLUNTEERS ─────────────────────────────────────────────────────────
-- Paathshala teachers are auto-added as teacher-only volunteers. These columns
-- let us show their Paathshala name and link them to their students. The fields
-- are optional (event mentors have no Paathshala).
alter table volunteers add column if not exists paathshala       text;
alter table volunteers add column if not exists paathshala_code  text;
create index if not exists idx_volunteers_paathshala_code on volunteers(paathshala_code);
