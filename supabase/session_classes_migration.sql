-- =============================================================================
-- Per-session class assignment for Class Teachers.
-- Adds a jsonb map: { "1": "BA1", "2": "BB1", "3": "BA2" }
-- Run in Supabase SQL Editor. Safe to re-run.
-- =============================================================================

alter table volunteers
  add column if not exists session_classes jsonb default '{}'::jsonb;

-- Backfill: for any existing teacher with assigned_class / assigned_classes
-- but no session_classes set yet, default every session to their primary class.
update volunteers
   set session_classes = jsonb_build_object(
         '1', coalesce(assigned_classes[1], assigned_class, ''),
         '2', coalesce(assigned_classes[1], assigned_class, ''),
         '3', coalesce(assigned_classes[1], assigned_class, '')
       )
 where (session_classes is null or session_classes = '{}'::jsonb)
   and ('Class Teacher' = any(coalesce(roles, array[]::text[])))
   and (
     coalesce(assigned_class, '') <> ''
     or coalesce(array_length(assigned_classes, 1), 0) > 0
   );
