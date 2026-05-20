-- =============================================================
-- Transactions optional columns migration.
--
-- Fixes Supabase errors like:
--   "Could not find the 'coin_count' column of 'transactions' in
--    the schema cache"
-- by ensuring the columns used by the mentor UI exist on the
-- live database, and then asking PostgREST to reload its cache so
-- the change is picked up immediately.
--
-- Safe to run multiple times.
-- =============================================================

alter table transactions add column if not exists coin_count integer default 0;
alter table transactions add column if not exists type       text;
alter table transactions add column if not exists notes      text;

-- Ask Supabase's PostgREST to refresh its schema cache right away
-- so clients stop seeing stale-schema errors.
notify pgrst, 'reload schema';
