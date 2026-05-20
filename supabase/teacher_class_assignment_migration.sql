-- Allow one teacher to be assigned to multiple classes.
-- Safe to re-run.

alter table volunteers
  add column if not exists assigned_classes text[] default '{}';

-- Optional performance index for overlap/contains queries.
create index if not exists idx_volunteers_assigned_classes_gin
  on volunteers using gin (assigned_classes);

