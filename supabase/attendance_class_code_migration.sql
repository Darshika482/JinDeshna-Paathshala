-- =============================================================================
-- Per-class attendance fix.
--
-- Why: previously `attendance` and `attendance_submissions` were unique on
-- (student_id, class_num, date) and (class_num, date) respectively, where
-- `class_num` is just the session number 1/2/3. Two different student
-- classes (e.g. 1A and 1B) running in the same session collided on a single
-- submission row, which made one teacher's submit appear as "submitted" on
-- every other teacher's dashboard and skipped the +5 attendance points
-- award for the second class.
--
-- This migration adds a `class_code` column ('1A', '2B', ...) and rebuilds
-- the unique keys so each (date, session, class) is independent.
--
-- Safe to re-run.
-- =============================================================================

alter table attendance
  add column if not exists class_code text not null default '';

alter table attendance_submissions
  add column if not exists class_code text not null default '';

-- Drop any pre-existing unique constraints / indexes that did not include
-- class_code. Names can vary depending on how the table was originally
-- created, so we look up and drop them dynamically.
do $$
declare
  r record;
begin
  for r in
    select conname
      from pg_constraint
     where conrelid = 'public.attendance'::regclass
       and contype = 'u'
       and pg_get_constraintdef(oid) like '%(student_id, class_num, date)%'
  loop
    execute format('alter table public.attendance drop constraint %I', r.conname);
  end loop;

  for r in
    select conname
      from pg_constraint
     where conrelid = 'public.attendance_submissions'::regclass
       and contype = 'u'
       and pg_get_constraintdef(oid) like '%(class_num, date)%'
  loop
    execute format('alter table public.attendance_submissions drop constraint %I', r.conname);
  end loop;
end $$;

-- Add the class_code-aware unique indexes used by the upsert calls.
create unique index if not exists attendance_student_session_class_date_uniq
  on public.attendance (student_id, class_num, class_code, date);

create unique index if not exists attendance_submissions_session_class_date_uniq
  on public.attendance_submissions (class_num, class_code, date);

-- Best-effort backfill of class_code on existing rows from the assigned
-- teacher's session_classes map. Rows whose teacher is missing or unmapped
-- are left as '' and continue to behave like a single shared class — which
-- is the behaviour they had before this migration anyway.
update public.attendance a
   set class_code = coalesce(
         (volunteers.session_classes ->> a.class_num::text), ''
       )
  from public.volunteers
 where a.class_code = ''
   and volunteers.id = a.teacher_id
   and volunteers.session_classes is not null;

update public.attendance_submissions s
   set class_code = coalesce(
         (volunteers.session_classes ->> s.class_num::text), ''
       )
  from public.volunteers
 where s.class_code = ''
   and volunteers.id = s.teacher_id
   and volunteers.session_classes is not null;
