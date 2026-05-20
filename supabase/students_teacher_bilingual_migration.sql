-- Add Hindi variant for assigned class-teacher name on students.
-- Safe to re-run.

alter table students
  add column if not exists group_hi text;

