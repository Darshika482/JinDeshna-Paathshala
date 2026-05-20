-- Atomic student point increment RPC.
-- Replaces the client-side SET approach that caused race conditions when
-- multiple devices award points to the same student concurrently.
-- Safe to re-run (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION add_student_points(
  p_student_id text,
  p_delta       integer,
  p_day         integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_arr integer[];
  v_len integer;
BEGIN
  -- Lock the row so concurrent calls are serialised per student.
  SELECT day_points INTO v_arr
  FROM   students
  WHERE  id = p_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_arr IS NULL THEN
    v_arr := '{}';
  END IF;

  v_len := COALESCE(array_length(v_arr, 1), 0);

  -- Extend array if p_day is beyond current length.
  WHILE v_len < p_day LOOP
    v_arr := array_append(v_arr, 0);
    v_len := v_len + 1;
  END LOOP;

  v_arr[p_day] := COALESCE(v_arr[p_day], 0) + p_delta;

  UPDATE students
  SET    total_points = total_points + p_delta,
         day_points   = v_arr
  WHERE  id = p_student_id;
END;
$$;
