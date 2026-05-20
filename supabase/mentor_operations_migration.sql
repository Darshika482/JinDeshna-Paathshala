-- ═══════════════════════════════════════════════════════════════════════════
-- Bal Sanskar Shivir — Mentor Operations Migration
-- Run once in Supabase SQL Editor.  Safe to re-run (all statements are
-- idempotent via IF NOT EXISTS / ON CONFLICT DO UPDATE).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. MENTORS ───────────────────────────────────────────────────────────────
-- Extended profile linked to the existing volunteers table.
create table if not exists mentors (
  id                           text primary key,   -- same as volunteers.id
  volunteer_id                 text references volunteers(id) on delete cascade,
  gender                       text not null check (gender in ('male','female')),
  assigned_room_numbers        int[],
  mentee_ids                   text[],             -- students.id values
  good_behaviour_assignment_ids int[],             -- good_behaviour_types.id subset
  is_senior                    boolean default false,
  created_at                   timestamptz default now()
);
alter table mentors disable row level security;

-- ── 2. EVENTS ────────────────────────────────────────────────────────────────
create table if not exists events (
  id                 text primary key,
  name               text not null,
  time_slot          text,
  event_type         text not null check (event_type in ('daily','one-time','two-day')),
  applicable_gender  text not null default 'all' check (applicable_gender in ('all','boys_only','girls_only')),
  coin_pool_boys     int default 0,
  coin_pool_girls    int default 0,
  points_per_coin    int default 5,
  responsible_role   text not null check (responsible_role in ('mentor','teacher','both')),
  notes              text,
  is_active          boolean default true,
  sort_order         int default 0,
  created_at         timestamptz default now()
);
alter table events disable row level security;

-- ── 3. EVENT RESPONSIBILITIES ────────────────────────────────────────────────
create table if not exists event_responsibilities (
  id                 text primary key,
  event_id           text references events(id) on delete cascade,
  responsibility_text text not null,
  applies_to_role    text not null check (applies_to_role in ('mentor','teacher')),
  notes              text,
  sort_order         int default 0,
  created_at         timestamptz default now()
);
alter table event_responsibilities disable row level security;

-- ── 4. MENTOR–EVENT ASSIGNMENTS ──────────────────────────────────────────────
create table if not exists mentor_event_assignments (
  id                   text primary key,
  mentor_id            text references mentors(id) on delete cascade,
  event_id             text references events(id) on delete cascade,
  assigned_at          timestamptz default now(),
  assigned_by_admin_id text,
  unique (mentor_id, event_id)
);
alter table mentor_event_assignments disable row level security;

-- ── 5. GOOD BEHAVIOUR TYPES ──────────────────────────────────────────────────
create table if not exists good_behaviour_types (
  id             int primary key,
  behaviour_name text not null,
  description    text,
  points         int default 5
);
alter table good_behaviour_types disable row level security;

-- ── 6. GOOD BEHAVIOUR LOGS ───────────────────────────────────────────────────
create table if not exists good_behaviour_logs (
  id           text primary key,
  mentor_id    text references mentors(id) on delete set null,
  student_id   text references students(id) on delete set null,
  behaviour_id int references good_behaviour_types(id) on delete set null,
  day_number   int not null check (day_number between 1 and 6),
  timestamp    timestamptz default now(),
  notes        text
);
alter table good_behaviour_logs disable row level security;

-- ── 7. COIN COLLECTION LOGS ──────────────────────────────────────────────────
create table if not exists coin_collection_logs (
  id              text primary key,
  mentor_id       text references mentors(id) on delete set null,
  student_id      text references students(id) on delete set null,
  coins_collected int not null check (coins_collected >= 0),
  points_awarded  int not null,
  day_number      int not null check (day_number between 1 and 6),
  logged_at       timestamptz default now()
);
alter table coin_collection_logs disable row level security;

-- ── 8. ROOM DISCIPLINE LOGS ──────────────────────────────────────────────────
create table if not exists room_discipline_logs (
  id                   text primary key,
  room_number          int not null,
  day_number           int not null check (day_number between 1 and 6),
  gender               text not null check (gender in ('male','female')),
  mentor_id            text references mentors(id) on delete set null,
  is_best_room         boolean default false,
  mentor_prize_awarded boolean default false,
  notes                text,
  checked_at           timestamptz default now(),
  unique (room_number, day_number, gender)
);
alter table room_discipline_logs disable row level security;

-- ── 9. ROOM WAKE-UP ASSIGNMENTS ──────────────────────────────────────────────
create table if not exists room_wakeup_assignments (
  id                    text primary key,
  room_number           int not null unique,
  student_id            text references students(id) on delete set null,
  assigned_by_mentor_id text references mentors(id) on delete set null,
  updated_at            timestamptz default now()
);
alter table room_wakeup_assignments disable row level security;

-- ── 10. NEGATIVE MARKINGS ────────────────────────────────────────────────────
-- Only mentors with is_senior = true may insert.  reason_text is mandatory.
create table if not exists negative_markings (
  id              text primary key,
  mentor_id       text references mentors(id) on delete set null,
  student_id      text references students(id) on delete set null,
  reason_category text not null check (reason_category in
    ('misbehaving','fighting','abusive_language','physical_altercation','other')),
  reason_text     text not null check (length(trim(reason_text)) > 0),
  points_deducted int not null check (points_deducted > 0),
  day_number      int not null check (day_number between 1 and 6),
  logged_at       timestamptz default now()
);
alter table negative_markings disable row level security;

-- ── INDEXES ──────────────────────────────────────────────────────────────────
create index if not exists idx_gbl_student_day   on good_behaviour_logs(student_id, day_number);
create index if not exists idx_gbl_mentor        on good_behaviour_logs(mentor_id);
create index if not exists idx_ccl_mentor_day    on coin_collection_logs(mentor_id, day_number);
create index if not exists idx_rdl_day_gender    on room_discipline_logs(day_number, gender);
create index if not exists idx_mea_mentor        on mentor_event_assignments(mentor_id);
create index if not exists idx_er_event          on event_responsibilities(event_id);
create index if not exists idx_nm_student        on negative_markings(student_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Good Behaviour Types ─────────────────────────────────────────────────────
insert into good_behaviour_types (id, behaviour_name, description, points) values
  (1,  'Self Study',                    'Observed studying voluntarily during free period or rest time', 5),
  (2,  'Helping Behaviour',             'Genuinely helping another student at any time', 5),
  (3,  'Personal Cleanliness',          'Morning check — neatly dressed and ready before sessions', 5),
  (4,  'Meal Discipline',               'Proper queue and behaviour during breakfast, lunch, or dinner', 5),
  (5,  'Morning Routine',               'Bed made, room tidy, bag organised before leaving for first session', 5),
  (6,  'Queue Discipline',              'Standing quietly, not pushing, maintaining line at any time', 5),
  (7,  'First to be Ready',             'Room or group fully assembled first before any session', 5),
  (8,  'Evening Diary Writing',         '3–4 lines of reflection written during wind-down time', 5),
  (9,  'Waking Up Without Being Called','Student woke up on own before mentor arrived for morning round', 5),
  (10, 'Silent Prayer / Meditation',    'Correct posture and genuine stillness during Poojan or Bhakti', 5),
  (11, 'Encouraging Peers',             'Genuinely motivating or supporting another student', 5)
on conflict (id) do update set
  behaviour_name = excluded.behaviour_name,
  description    = excluded.description,
  points         = excluded.points;

-- ── Events ───────────────────────────────────────────────────────────────────
insert into events
  (id, name, time_slot, event_type, applicable_gender,
   coin_pool_boys, coin_pool_girls, points_per_coin,
   responsible_role, notes, is_active, sort_order)
values
  ('wake_up',        'Wake-Up',                    '5:00 AM',                   'daily',    'all',   0,   0,  5, 'mentor',  null, true, 1),
  ('early_riser',    'Early Riser',                'Before 5:00 AM',            'daily',    'all', 100, 100,  5, 'mentor',  'Students earn coin by reaching queue before 5:00 AM up to pool limit', true, 2),
  ('yoga',           'Yoga',                       '5:15–6:00 AM',              'daily',    'all',   8,   8,  5, 'both',    'Q&A pool: 10 per session. Sincerity pool: 6 per session. Max 16 total.', true, 3),
  ('poojan',         'Poojan / Morning Puja',      '7:00–8:30 AM',              'daily',    'all',  25,  25,  5, 'both',    'Sincerity pool: 30. Q&A pool: 20.', true, 4),
  ('meals',          'Meals / Bhojan',             '8:30 AM, 1:30 PM, 6:30 PM', 'daily',    'all',   0,   0,  5, 'mentor',  'No physical coins. Good Behaviour tracking only.', true, 5),
  ('kaksha',         'Kaksha / Classes',           '9:00–10:40 AM',             'daily',    'all',  13,  13,  5, 'both',    'Q&A: 8 coins (+5), Good Question: 4 coins (+5), Sincerity: 1 coin (+10). Teachers award inside class only.', true, 6),
  ('samuhik',        'Samuhik Kaksha',             '10:45–11:30 AM',            'daily',    'all',  11,  11,  5, 'both',    'Q&A pool: 20 total. Sincerity: 1 boy + 1 girl only.', true, 7),
  ('coin_collect',   'Coin Collection',            '12:00–1:00 PM',             'daily',    'all',   0,   0,  5, 'mentor',  'Collect physical coins from mentees. Log digitally. Window: 12:00–1:00 PM only.', true, 8),
  ('competitions',   'Competitions / Creative',    '2:00–3:00 PM',              'daily',    'all',   0,   0,  5, 'both',    'Drawing, story writing, customised programs. Min +5 for all in Drawing/Story.', true, 9),
  ('khojooge',       'Khojooge To Paoge',          '7:30–7:40 PM',              'daily',    'all',   3,   3,  5, 'mentor',  'Total pool: 6 coins (3 boys + 3 girls). Be very selective.', true, 10),
  ('bhakti',         'Bhakti',                     '7:00–7:30 PM',              'daily',    'all',  10,  10,  5, 'mentor',  'Sincerity coin pool: 10 boys + 10 girls per day.', true, 11),
  ('kanth_path',     'Kanth Path',                 'Day 5–6',                   'two-day',  'all',   0,   0,  5, 'mentor',  'Full recitation +20, Half +10. Max 3 counted per student across both days combined.', true, 12),
  ('room_discipline','Room Discipline',            'All day',                   'daily',    'all',   0,   0,  5, 'mentor',  'Best room: all students get +5 each. Winning mentor gets physical prize (admin tracks).', true, 13),
  ('copy_notes',     'Copy / Notes',               'End of shivir',             'one-time', 'all',   0,   0,  5, 'mentor',  'Proper notes +5, with decoration +10. One-time award.', true, 14),
  ('drawing_story',  'Drawing & Story Writing',    '2:00–3:00 PM',              'one-time', 'all',   0,   0,  5, 'both',    '1st +25, 2nd +20, 3rd +15, Consolation +10. Min participation +5.', true, 15),
  ('good_behaviour', 'Good Behaviour Tracking',    'All day',                   'daily',    'all',   0,   0,  5, 'mentor',  'Max 4 Good Behaviour coins per student per day. App enforces cap automatically.', true, 16),
  ('night_rest',     'Night / Rest Time',          '9:00 PM+',                  'daily',    'all',   0,   0,  5, 'mentor',  'Cross-hostel entry strictly prohibited at all times.', true, 17)
on conflict (id) do update set
  name = excluded.name, time_slot = excluded.time_slot,
  event_type = excluded.event_type, applicable_gender = excluded.applicable_gender,
  coin_pool_boys = excluded.coin_pool_boys, coin_pool_girls = excluded.coin_pool_girls,
  points_per_coin = excluded.points_per_coin, responsible_role = excluded.responsible_role,
  notes = excluded.notes, sort_order = excluded.sort_order;

-- ── Event Responsibilities ────────────────────────────────────────────────────
insert into event_responsibilities
  (id, event_id, responsibility_text, applies_to_role, sort_order)
values
  -- WAKE-UP
  ('er_wakeup_m1', 'wake_up', 'Help every mentee wake up on time', 'mentor', 1),
  ('er_wakeup_m2', 'wake_up', 'Ensure no mentee is still in bed after wake-up time', 'mentor', 2),
  ('er_wakeup_m3', 'wake_up', 'Check that students heading to Early Riser queue have left their room', 'mentor', 3),
  ('er_wakeup_m4', 'wake_up', 'Observe and note who woke up without being called (Good Behaviour #9)', 'mentor', 4),
  ('er_wakeup_m5', 'wake_up', 'Female mentors handle girls'' rooms only. Male mentors handle boys'' rooms only.', 'mentor', 5),

  -- EARLY RISER
  ('er_early_m1', 'early_riser', 'Assign one student per room as the room wake-up responsible person (manageable from your dashboard)', 'mentor', 1),
  ('er_early_m2', 'early_riser', 'Maintain separate queues for boys and girls near ground or table', 'mentor', 2),
  ('er_early_m3', 'early_riser', 'Award +5 Early Riser coin to eligible students up to the daily pool limit', 'mentor', 3),
  ('er_early_m4', 'early_riser', 'Do not award coins beyond the pool limit for that day', 'mentor', 4),

  -- YOGA (mentor)
  ('er_yoga_m1', 'yoga', 'Encourage all mentees to reach the yoga venue on time', 'mentor', 1),
  ('er_yoga_m2', 'yoga', 'Help maintain discipline and silence during the session', 'mentor', 2),
  ('er_yoga_m3', 'yoga', 'Observe attentiveness of mentees throughout the session', 'mentor', 3),
  -- YOGA (teacher)
  ('er_yoga_t1', 'yoga', 'Award Sincerity coin (+5) — very selective, maximum 6 coins per session total', 'teacher', 1),
  ('er_yoga_t2', 'yoga', 'Award Q&A coin (+5) — maximum 10 coins per session total', 'teacher', 2),

  -- POOJAN (mentor)
  ('er_poojan_m1', 'poojan', 'Motivate students to reach on time and with enthusiasm', 'mentor', 1),
  ('er_poojan_m2', 'poojan', 'Maintain discipline and proper posture during the session', 'mentor', 2),
  ('er_poojan_m3', 'poojan', 'Observe Silent Prayer / Meditation Posture for Good Behaviour coin (behaviour #10)', 'mentor', 3),
  ('er_poojan_m4', 'poojan', 'Assist organisers as needed during the program', 'mentor', 4),
  -- POOJAN (teacher)
  ('er_poojan_t1', 'poojan', 'Award Sincerity coin (+5) — pool: 30 coins per session', 'teacher', 1),
  ('er_poojan_t2', 'poojan', 'Award Q&A coin (+5) — pool: 20 coins per session', 'teacher', 2),

  -- MEALS (mentor)
  ('er_meals_m1', 'meals', 'Ensure all mentees have eaten their meal', 'mentor', 1),
  ('er_meals_m2', 'meals', 'Observe Meal Discipline for Good Behaviour coin (behaviour #4)', 'mentor', 2),
  ('er_meals_m3', 'meals', 'Address any food-related problems or health concerns of mentees', 'mentor', 3),
  ('er_meals_m4', 'meals', 'Help mentees maintain queue discipline during serving', 'mentor', 4),
  ('er_meals_m5', 'meals', 'Do not serve food yourself — a separate food serving team handles that', 'mentor', 5),

  -- KAKSHA (mentor)
  ('er_kaksha_m1', 'kaksha', 'You are NOT present inside the classroom during sessions', 'mentor', 1),
  ('er_kaksha_m2', 'kaksha', 'Before class: encourage mentees to sit attentively and prepare a good question for the teacher', 'mentor', 2),
  ('er_kaksha_m3', 'kaksha', 'After class: help mentees recall and understand what was taught', 'mentor', 3),
  ('er_kaksha_m4', 'kaksha', 'Apply negative marking for any misbehaviour observed outside the classroom', 'mentor', 4),
  ('er_kaksha_m5', 'kaksha', 'Encourage mentees to ask genuine, thoughtful questions to the teacher', 'mentor', 5),
  -- KAKSHA (teacher)
  ('er_kaksha_t1', 'kaksha', 'Award Q&A participation coin (+5) — 8 coins per class', 'teacher', 1),
  ('er_kaksha_t2', 'kaksha', 'Award Good Question coin (+5) — 4 coins per class', 'teacher', 2),
  ('er_kaksha_t3', 'kaksha', 'Award Sincerity coin (+10) — maximum 1 per class, only for truly extraordinary attention throughout the entire class. Not compulsory. Give only if clearly deserved.', 'teacher', 3),

  -- SAMUHIK KAKSHA (mentor)
  ('er_samuhik_m1', 'samuhik', 'Help maintain discipline in your assigned group', 'mentor', 1),
  ('er_samuhik_m2', 'samuhik', 'Encourage mentees to participate in Q&A', 'mentor', 2),
  ('er_samuhik_m3', 'samuhik', 'Apply negative marking if required (female for girls, male for boys only)', 'mentor', 3),
  -- SAMUHIK KAKSHA (teacher)
  ('er_samuhik_t1', 'samuhik', 'Award Q&A coin (+5) — pool: 20 coins total', 'teacher', 1),
  ('er_samuhik_t2', 'samuhik', 'Award Sincerity coin (+5) — pool: 2 coins only (1 boy + 1 girl)', 'teacher', 2),

  -- COIN COLLECTION (mentor)
  ('er_collect_m1', 'coin_collect', 'Between 12:00 PM and 1:00 PM, collect physical coins from all your mentees', 'mentor', 1),
  ('er_collect_m2', 'coin_collect', 'Count coins carefully for each mentee', 'mentor', 2),
  ('er_collect_m3', 'coin_collect', 'Enter coin count per mentee in the app — points are calculated automatically (coins × 5)', 'mentor', 3),
  ('er_collect_m4', 'coin_collect', 'After logging, physical coins are returned to the daily pool', 'mentor', 4),
  ('er_collect_m5', 'coin_collect', 'Female mentors collect from female mentees only. Male mentors from male mentees only.', 'mentor', 5),

  -- COMPETITIONS (mentor)
  ('er_comp_m1', 'competitions', 'Inform mentees about the competition in advance', 'mentor', 1),
  ('er_comp_m2', 'competitions', 'Motivate and guide their preparation', 'mentor', 2),
  ('er_comp_m3', 'competitions', 'Ensure all mentees participate — minimum +5 guaranteed for everyone in Drawing & Story Writing', 'mentor', 3),
  -- COMPETITIONS (teacher)
  ('er_comp_t1', 'competitions', 'Award Tough Question Answer (+10) and Winner (+20) in Customised Programs', 'teacher', 1),
  ('er_comp_t2', 'competitions', 'Distribute points from fixed session budget of 100–200 points per session', 'teacher', 2),

  -- KHOJOOGE (mentor)
  ('er_khoj_m1', 'khojooge', 'Encourage all mentees to participate enthusiastically', 'mentor', 1),
  ('er_khoj_m2', 'khojooge', 'Award +5 coin to selected students — total pool is only 6 coins, be very selective', 'mentor', 2),
  ('er_khoj_m3', 'khojooge', 'Do not award beyond the pool limit of 6 coins total (3 boys + 3 girls)', 'mentor', 3),

  -- BHAKTI (mentor)
  ('er_bhakti_m1', 'bhakti', 'Motivate students to arrive before the session starts', 'mentor', 1),
  ('er_bhakti_m2', 'bhakti', 'Build enthusiasm and energy during the program', 'mentor', 2),
  ('er_bhakti_m3', 'bhakti', 'Help maintain discipline throughout', 'mentor', 3),
  ('er_bhakti_m4', 'bhakti', 'Observe sincerity and award Sincerity coin (+5) — pool: 10 coins boys, 10 coins girls per day', 'mentor', 4),

  -- KANTH PATH (mentor)
  ('er_kanth_m1', 'kanth_path', 'Inform and motivate mentees to prepare their recitation (Gatha, Paath, or Shlok)', 'mentor', 1),
  ('er_kanth_m2', 'kanth_path', 'Track how many recitations each mentee has completed (maximum 3 per student across both days)', 'mentor', 2),
  ('er_kanth_m3', 'kanth_path', 'Award: Full recitation +20 points, Half recitation +10 points', 'mentor', 3),
  ('er_kanth_m4', 'kanth_path', 'Do not award beyond 3 recitations per student regardless of how many they attempt', 'mentor', 4),

  -- ROOM DISCIPLINE (mentor)
  ('er_room_m1', 'room_discipline', 'Check assigned rooms daily for cleanliness, tidiness, and organisation', 'mentor', 1),
  ('er_room_m2', 'room_discipline', 'Encourage students to collectively maintain the room — no blaming one person', 'mentor', 2),
  ('er_room_m3', 'room_discipline', 'Mark room status in the app each day', 'mentor', 3),
  ('er_room_m4', 'room_discipline', 'If your room is selected as best room: all students in the room receive +5 points each (auto-applied)', 'mentor', 4),
  ('er_room_m5', 'room_discipline', 'If your room wins best room: you receive a separate physical prize from admin (tracked in app)', 'mentor', 5),

  -- COPY/NOTES (mentor)
  ('er_copy_m1', 'copy_notes', 'Remind mentees throughout the shivir to maintain proper notes in class', 'mentor', 1),
  ('er_copy_m2', 'copy_notes', 'At the end of the shivir, check notes quality for each mentee', 'mentor', 2),
  ('er_copy_m3', 'copy_notes', 'Award: Proper Notes = +5, Proper Notes with Decoration = +10 (one-time award per student)', 'mentor', 3),

  -- DRAWING & STORY (mentor)
  ('er_draw_m1', 'drawing_story', 'Ensure all mentees know about the competition and participate', 'mentor', 1),
  -- DRAWING & STORY (teacher)
  ('er_draw_t1', 'drawing_story', 'Award prizes: 1st place +25, 2nd +20, 3rd +15, Consolation +10. Minimum participation +5 for all.', 'teacher', 1),
  ('er_draw_t2', 'drawing_story', 'Distribute prizes fairly within the defined point budget', 'teacher', 2),

  -- GOOD BEHAVIOUR (mentor)
  ('er_gb_m1', 'good_behaviour', 'Observe only the specific behaviours assigned to you (shown in your dashboard)', 'mentor', 1),
  ('er_gb_m2', 'good_behaviour', 'These assignments are fixed for all 6 days — they do not change', 'mentor', 2),
  ('er_gb_m3', 'good_behaviour', 'Award +5 coin each time an assigned behaviour is observed in a mentee', 'mentor', 3),
  ('er_gb_m4', 'good_behaviour', 'App automatically blocks awarding if a student has already received 4 Good Behaviour coins today', 'mentor', 4),
  ('er_gb_m5', 'good_behaviour', 'Do not award Good Behaviour coins for behaviours not in your assigned list', 'mentor', 5),

  -- NIGHT/REST (mentor)
  ('er_night_m1', 'night_rest', 'Ensure all mentees settle down after the final program (around 9:00 PM)', 'mentor', 1),
  ('er_night_m2', 'night_rest', 'Use rest time for light meaningful conversations — life, career, family values, Jain principles', 'mentor', 2),
  ('er_night_m3', 'night_rest', 'Address home-sickness with counselling and emotional reassurance', 'mentor', 3),
  ('er_night_m4', 'night_rest', 'Female mentors remain in girls'' hostel area. Male mentors in boys'' hostel area.', 'mentor', 4),
  ('er_night_m5', 'night_rest', 'Cross-hostel entry is strictly prohibited at all times', 'mentor', 5)

on conflict (id) do update set
  responsibility_text = excluded.responsibility_text,
  applies_to_role     = excluded.applies_to_role,
  sort_order          = excluded.sort_order;


-- ═══════════════════════════════════════════════════════════════════════════
-- SHIVIR CONFIG TABLE  (single-row config the admin can update)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists shivir_config (
  key   text primary key,
  value text
);
alter table shivir_config disable row level security;

-- Default start date — admin updates this from the Operations dashboard
insert into shivir_config (key, value) values
  ('start_date',            '2026-05-01'),
  ('coin_collect_open_hh',  '12'),
  ('coin_collect_close_hh', '13')
on conflict (key) do nothing;
