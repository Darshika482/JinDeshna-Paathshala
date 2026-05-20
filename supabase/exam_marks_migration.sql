-- =============================================================
-- Exam marks column for students.
--
-- Stores the exam score (0–100) directly on the student row so
-- the admin class view can rank students without joining
-- transactions.  The corresponding points are recorded as normal
-- transactions (type = 'exam') so total_points stays accurate.
--
-- Safe to run multiple times.
-- =============================================================

alter table students add column if not exists exam_marks integer;

notify pgrst, 'reload schema';
