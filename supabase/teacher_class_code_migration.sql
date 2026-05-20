-- =============================================
-- Teacher Class Code Migration
-- Old format: BA1, GA1, BB1, GB1, BC1, GC1, MD1
-- New format: 1A, 1B, 1C … 4A  (matches student.class)
--
-- Run in Supabase SQL Editor. Safe to re-run.
-- =============================================

-- ─── Bhag-1 Boys ─────────────────────────────
-- BA1 → 1A  (Br Prateek Bhaiya)
UPDATE volunteers SET
  assigned_class   = '1A',
  assigned_classes = ARRAY['1A'],
  session_classes  = '{"1":"1A","2":"1A","3":"1A"}'::jsonb
WHERE id = 't01';

-- BA2 → 1B  (Br Himanshu Bhaiya)
UPDATE volunteers SET
  assigned_class   = '1B',
  assigned_classes = ARRAY['1B'],
  session_classes  = '{"1":"1B","2":"1B","3":"1B"}'::jsonb
WHERE id = 't02';

-- BA4 → 1C  (Aman Jain Ji)
UPDATE volunteers SET
  assigned_class   = '1C',
  assigned_classes = ARRAY['1C'],
  session_classes  = '{"1":"1C","2":"1C","3":"1C"}'::jsonb
WHERE id = 't04';

-- BA5 → 1D  (Aniket Jain Ji)
UPDATE volunteers SET
  assigned_class   = '1D',
  assigned_classes = ARRAY['1D'],
  session_classes  = '{"1":"1D","2":"1D","3":"1D"}'::jsonb
WHERE id = 't05';

-- ─── Bhag-1 Girls ─────────────────────────────
-- GA1 → 1E  (Pragya Jain Ji)
UPDATE volunteers SET
  assigned_class   = '1E',
  assigned_classes = ARRAY['1E'],
  session_classes  = '{"1":"1E","2":"1E","3":"1E"}'::jsonb
WHERE id = 't06';

-- GA2 → 1F  (Aditi)
UPDATE volunteers SET
  assigned_class   = '1F',
  assigned_classes = ARRAY['1F'],
  session_classes  = '{"1":"1F","2":"1F","3":"1F"}'::jsonb
WHERE id = 't07';

-- GA3 → 1G  (Lipi Jain Ji)
UPDATE volunteers SET
  assigned_class   = '1G',
  assigned_classes = ARRAY['1G'],
  session_classes  = '{"1":"1G","2":"1G","3":"1G"}'::jsonb
WHERE id = 't08';

-- ─── Bhag-2 ───────────────────────────────────
-- BB1 → 2A  (Gautam Gandhar Pradhan Ji — all boys)
UPDATE volunteers SET
  assigned_class   = '2A',
  assigned_classes = ARRAY['2A'],
  session_classes  = '{"1":"2A","2":"2A","3":"2A"}'::jsonb
WHERE id = 't09';

-- BB2 → 2B  (Br Rajesh Bhaiya Ji — mixed)
UPDATE volunteers SET
  assigned_class   = '2B',
  assigned_classes = ARRAY['2B'],
  session_classes  = '{"1":"2B","2":"2B","3":"2B"}'::jsonb
WHERE id = 't10';

-- GB1 → 2C  (Khushbu Ji — all girls)
UPDATE volunteers SET
  assigned_class   = '2C',
  assigned_classes = ARRAY['2C'],
  session_classes  = '{"1":"2C","2":"2C","3":"2C"}'::jsonb
WHERE id = 't11';

-- ─── Bhag-3 ───────────────────────────────────
-- BC1 → 3A  (Br Shrenik Bhaiya Ji — boys)
UPDATE volunteers SET
  assigned_class   = '3A',
  assigned_classes = ARRAY['3A'],
  session_classes  = '{"1":"3A","2":"3A","3":"3A"}'::jsonb
WHERE id = 't12';

-- GC1 → 3B  (Shrimati Pooja Ji — girls)
UPDATE volunteers SET
  assigned_class   = '3B',
  assigned_classes = ARRAY['3B'],
  session_classes  = '{"1":"3B","2":"3B","3":"3B"}'::jsonb
WHERE id = 't13';

-- ─── Bhag-4 ───────────────────────────────────
-- MD1 → 4A  (Shrimati Alka Ji — mixed)
UPDATE volunteers SET
  assigned_class   = '4A',
  assigned_classes = ARRAY['4A'],
  session_classes  = '{"1":"4A","2":"4A","3":"4A"}'::jsonb
WHERE id = 't14';

-- ─── Verify ───────────────────────────────────
-- Run this SELECT after the updates to confirm all teachers
-- now have the correct new-format class codes.
SELECT id, name, assigned_class, session_classes
FROM volunteers
WHERE roles @> ARRAY['Class Teacher']
ORDER BY assigned_class;
