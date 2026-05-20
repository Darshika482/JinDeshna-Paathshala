import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase.js';

// Use LOCAL date (not UTC) so attendance day/date matches the on-ground camp
// date in India. Using toISOString() here shifts early-morning entries to the
// previous day.
const todayDate = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const normalizeClassCode = (code) => String(code || '').trim();
const normalizeSessionNum = (classNum) => {
  const n = Number(classNum);
  // Morning Session 1 + 2 are treated as one continuous attendance block.
  return n === 2 ? 1 : n;
};

// Deterministic IDs match the Supabase unique constraints. We include the
// class_code in the id so two different classes in the same session do NOT
// collide. Without class_code, e.g. teacher of 1A and teacher of 1B would
// share a single Session 1 submission record, which would (a) mark every
// other class as "submitted" the moment one teacher submits, and (b) skip
// points awarding for everyone after the first class. That breaks the +5
// attendance points contract, so we must isolate per class.
const recordId = (date, classNum, classCode, studentId) =>
  `att_${date}_${normalizeSessionNum(classNum)}_${classCode || 'na'}_${studentId}`;
const submissionId = (date, classNum, classCode) =>
  `sub_${date}_${normalizeSessionNum(classNum)}_${classCode || 'na'}`;

const attendanceCacheKey = (date, classNum, classCode, studentId) =>
  `${date}_${normalizeSessionNum(classNum)}_${classCode || 'na'}_${studentId}`;
const submissionCacheKey = (date, classNum, classCode) =>
  `${date}_${normalizeSessionNum(classNum)}_${classCode || 'na'}`;

export const useAttendanceStore = create(
  persist(
    (set, get) => ({
      // Local cache ─────────────────────────────────────────────────────────
      // attendance keys: `${date}_${classNum}_${classCode}_${studentId}`
      attendance: {},
      // submissions keys: `${date}_${classNum}_${classCode}`
      submissions: {},
      sessionLabels: {
        1: 'Morning Session 1',
        2: 'Morning Session 2',
        3: 'Afternoon Session',
      },

      // ── Fetch today's data from Supabase on page load ─────────────────────
      fetchAttendance: async () => {
        const date = todayDate();
        try {
          const [{ data: records }, { data: subs }] = await Promise.all([
            supabase.from('attendance').select('*').eq('date', date),
            supabase.from('attendance_submissions').select('*').eq('date', date),
          ]);

          if (records) {
            const attendance = {};
            records.forEach(r => {
              const code = normalizeClassCode(r.class_code);
              const key = attendanceCacheKey(r.date, r.class_num, code, r.student_id);
              const normalizedClassNum = normalizeSessionNum(r.class_num);
              const existing = attendance[key];
              const existingTs = existing?.timestamp ? new Date(existing.timestamp).getTime() : 0;
              const incomingTs = r.timestamp ? new Date(r.timestamp).getTime() : 0;
              if (existing && incomingTs < existingTs) return;
              attendance[key] = {
                student_id: r.student_id,
                class_num:  normalizedClassNum,
                class_code: code,
                date:       r.date,
                status:     r.status,
                timestamp:  r.timestamp,
                teacher_id: r.teacher_id,
              };
            });
            set(state => {
              const kept = Object.fromEntries(
                Object.entries(state.attendance).filter(([k]) => !k.startsWith(`${date}_`))
              );
              return { attendance: { ...kept, ...attendance } };
            });
          }

          if (subs) {
            const submissions = {};
            subs.forEach(s => {
              const code = normalizeClassCode(s.class_code);
              const key = submissionCacheKey(s.date, s.class_num, code);
              const normalizedClassNum = normalizeSessionNum(s.class_num);
              const existing = submissions[key];
              const existingTs = existing?.submittedAt ? new Date(existing.submittedAt).getTime() : 0;
              const incomingTs = s.submitted_at ? new Date(s.submitted_at).getTime() : 0;
              if (existing && incomingTs < existingTs) return;
              submissions[key] = {
                submittedAt:   s.submitted_at,
                teacherId:     s.teacher_id,
                pointsAwarded: s.points_awarded,
                classCode:     code,
                classNum:      normalizedClassNum,
              };
            });
            set(state => {
              const kept = Object.fromEntries(
                Object.entries(state.submissions).filter(([k]) => !k.startsWith(`${date}_`))
              );
              return { submissions: { ...kept, ...submissions } };
            });
          }
        } catch {
          // offline — local cache from persist middleware is used
        }
      },

      // ── Mark a single student's status ────────────────────────────────────
      // class_code lets two different classes in the same session keep
      // independent attendance state. Status updates respect the per-class
      // grace-period lock, not a session-wide one.
      setStatus: async (
        studentId,
        studentName,
        classNum,
        classCode,
        status,
        teacherId,
        teacherName,
        day
      ) => {
        const code = normalizeClassCode(classCode);
        const normalizedClassNum = normalizeSessionNum(classNum);
        const date = todayDate();
        const submission = get().submissions[submissionCacheKey(date, normalizedClassNum, code)];

        // Respect grace-period lock for this specific (session, class) pair.
        if (submission) {
          const GRACE_MS = 30 * 60 * 1000;
          if (Date.now() - new Date(submission.submittedAt).getTime() >= GRACE_MS) return false;
        }

        const record = {
          id:           recordId(date, classNum, code, studentId),
          student_id:   studentId,
          student_name: studentName,
          class_num:    normalizedClassNum,
          class_code:   code,
          date,
          status,
          teacher_id:   teacherId,
          teacher_name: teacherName,
          day,
          timestamp:    new Date().toISOString(),
        };

        // Optimistic local update keyed by class_code.
        set(state => ({
          attendance: {
            ...state.attendance,
            [attendanceCacheKey(date, classNum, code, studentId)]: {
              student_id: studentId,
              class_num:  normalizedClassNum,
              class_code: code,
              date,
              status,
              timestamp:  record.timestamp,
              teacher_id: teacherId,
            },
          },
        }));

        // Persist to Supabase (upsert is safe — id is deterministic and the
        // unique index on (student_id, class_num, class_code, date) keeps
        // sibling classes from colliding).
        try {
          await supabase
            .from('attendance')
            .upsert(record, { onConflict: 'student_id,class_num,class_code,date' });
        } catch {
          // stays in localStorage until connectivity returns
        }

        return true;
      },

      getStatus: (studentId, classNum, classCode) => {
        const code = normalizeClassCode(classCode);
        const normalizedClassNum = normalizeSessionNum(classNum);
        const date = todayDate();
        return (
          get().attendance[attendanceCacheKey(date, normalizedClassNum, code, studentId)]?.status
          || 'present'
        );
      },

      hasRecord: (studentId, classNum, classCode) => {
        const code = normalizeClassCode(classCode);
        const normalizedClassNum = normalizeSessionNum(classNum);
        const date = todayDate();
        return !!get().attendance[attendanceCacheKey(date, normalizedClassNum, code, studentId)];
      },

      // ── Submit a class session ────────────────────────────────────────────
      // Submission is per (date, sessionNum, classCode). Awarding +5 points
      // for present students is tied to THIS class's submission, so other
      // classes in the same session still receive their points independently.
      submitClass: async (classNum, classCode, teacherId, teacherName) => {
        const code = normalizeClassCode(classCode);
        const normalizedClassNum = normalizeSessionNum(classNum);
        const date = todayDate();
        const key = submissionCacheKey(date, normalizedClassNum, code);
        const existing = get().submissions[key];
        const pointsAwarded = existing?.pointsAwarded || false;
        const now = new Date().toISOString();

        // Optimistic local update
        set(state => ({
          submissions: {
            ...state.submissions,
            [key]: { submittedAt: now, teacherId, pointsAwarded, classCode: code },
          },
        }));

        // Persist to Supabase
        try {
          await supabase.from('attendance_submissions').upsert({
            id:             submissionId(date, classNum, code),
            class_num:      normalizedClassNum,
            class_code:     code,
            date,
            submitted_at:   now,
            teacher_id:     teacherId,
            teacher_name:   teacherName,
            points_awarded: pointsAwarded,
          }, { onConflict: 'class_num,class_code,date' });
        } catch {
          // stays in localStorage
        }

        return { wasAlreadySubmitted: !!existing, pointsAwarded };
      },

      // ── Mark points as awarded (called after awarding loop completes) ─────
      markPointsAwarded: async (classNum, classCode) => {
        const code = normalizeClassCode(classCode);
        const normalizedClassNum = normalizeSessionNum(classNum);
        const date = todayDate();
        const key = submissionCacheKey(date, normalizedClassNum, code);

        set(state => ({
          submissions: {
            ...state.submissions,
            [key]: { ...state.submissions[key], pointsAwarded: true, classCode: code },
          },
        }));

        try {
          await supabase
            .from('attendance_submissions')
            .update({ points_awarded: true })
            .eq('id', submissionId(date, normalizedClassNum, code));
        } catch {
          // local flag still set; will sync on next load
        }
      },

      // ── Helpers ───────────────────────────────────────────────────────────
      getSubmission: (classNum, classCode) => {
        const code = normalizeClassCode(classCode);
        const date = todayDate();
        return get().submissions[submissionCacheKey(date, classNum, code)] || null;
      },

      canEdit: (classNum, classCode) => {
        const submission = get().getSubmission(classNum, classCode);
        if (!submission) return true;
        const GRACE_MS = 30 * 60 * 1000;
        return Date.now() - new Date(submission.submittedAt).getTime() < GRACE_MS;
      },

      setSessionLabel: (classNum, label) => {
        set(state => ({
          sessionLabels: { ...state.sessionLabels, [classNum]: label },
        }));
      },

      getStats: (classNum, classCode, students) => {
        const code = normalizeClassCode(classCode);
        const counts = { present: 0, absent: 0, late: 0, excused: 0 };
        students.forEach(s => {
          const status = get().getStatus(s.id, classNum, code);
          counts[status] = (counts[status] || 0) + 1;
        });
        return { ...counts, total: students.length };
      },

      getTodayRecords: () => {
        const date = todayDate();
        return Object.values(get().attendance).filter(r => r.date === date);
      },
    }),
    { name: 'shivir-attendance' }
  )
);
