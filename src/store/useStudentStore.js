import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase.js';

const buildPointOp = (studentId, points, day) => ({
  id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  studentId,
  points,
  day,
  createdAt: new Date().toISOString(),
});

function withPointDelta(student, points, day) {
  const safeDay = Math.max(1, Number(day) || 1);
  const idx = safeDay - 1;
  const dayPoints = Array.isArray(student.day_points) ? [...student.day_points] : [];
  while (dayPoints.length <= idx) dayPoints.push(0);
  dayPoints[idx] = (Number(dayPoints[idx]) || 0) + points;
  const total_points = (Number(student.total_points) || 0) + points;
  return { ...student, day_points: dayPoints, total_points };
}

function overlayPendingPointOps(students, pendingOps) {
  if (!pendingOps.length) return students;
  const byId = new Map(students.map(s => [s.id, s]));
  for (const op of pendingOps) {
    const current = byId.get(op.studentId);
    if (!current) continue;
    byId.set(op.studentId, withPointDelta(current, op.points, op.day));
  }
  return [...byId.values()];
}

export const useStudentStore = create(
  persist(
    (set, get) => ({
      students: [],
      searchResults: [],
      loading: true,
      pendingPointUpdates: [],
      syncingPointUpdates: false,
      pointAutoSyncReady: false,

      fetchStudents: async () => {
        set({ loading: true });
        const { data, error } = await supabase.from('students').select('*').order('roll_no');
        if (!error) {
          const merged = overlayPendingPointOps(data || [], get().pendingPointUpdates);
          set({ students: merged });
        }
        set({ loading: false });
      },

      search: (query) => {
        if (!query || query.trim().length < 2) { set({ searchResults: [] }); return; }
        const q = query.toLowerCase();
        const results = get().students.filter(s =>
          s.name.toLowerCase().includes(q) ||
          s.roll_no.toLowerCase().includes(q) ||
          (s.mobile && s.mobile.includes(q)) ||
          (s.parent_name && s.parent_name.toLowerCase().includes(q)) ||
          (s.father_name && s.father_name.toLowerCase().includes(q))
        ).slice(0, 8);
        set({ searchResults: results });
      },

      addStudent: async (student) => {
        const newStudent = {
          ...student,
          id: student.roll_no || `s${Date.now()}`,
          total_points: 0,
          day_points: [0, 0, 0, 0, 0, 0, 0],
          checked_in: false,
        };
        const { data, error } = await supabase.from('students').insert(newStudent).select().single();
        if (error) return { success: false, error: error.message };
        set(state => ({ students: [...state.students, data || newStudent] }));
        return { success: true };
      },

      checkIn: async (id) => {
        const student = get().students.find(s => s.id === id);
        if (!student) return;
        const newVal = !student.checked_in;
        const checkedInAt = newVal ? new Date().toISOString() : null;
        const { error } = await supabase
          .from('students')
          .update({ checked_in: newVal, checked_in_at: checkedInAt })
          .eq('id', id);
        if (!error) set(state => ({
          students: state.students.map(s => (
            s.id === id
              ? { ...s, checked_in: newVal, checked_in_at: checkedInAt }
              : s
          ))
        }));
      },

      toggleKitGiven: async (id) => {
        const student = get().students.find(s => s.id === id);
        if (!student) return { success: false, error: 'Student not found' };
        const newVal = !student.kit_given;
        const { error } = await supabase.from('students').update({ kit_given: newVal }).eq('id', id);
        if (error) return { success: false, error: error.message };
        set(state => ({
          students: state.students.map(s => s.id === id ? { ...s, kit_given: newVal } : s)
        }));
        return { success: true };
      },

      setExamMarks: async (id, marks) => {
        const { error } = await supabase.from('students').update({ exam_marks: marks }).eq('id', id);
        if (error) return { success: false, error: error.message };
        set(state => ({
          students: state.students.map(s => s.id === id ? { ...s, exam_marks: marks } : s),
        }));
        return { success: true };
      },

      updateStudent: async (id, updates) => {
        const { error } = await supabase.from('students').update(updates).eq('id', id);
        if (error) return { success: false, error: error.message };
        set(state => ({
          students: state.students.map(s => s.id === id ? { ...s, ...updates } : s)
        }));
        return { success: true };
      },

      deleteStudent: async (id) => {
        const { error } = await supabase.from('students').delete().eq('id', id);
        if (!error) set(state => ({ students: state.students.filter(s => s.id !== id) }));
      },

      applyLocalPoints: (studentId, points, day = 1) => {
        const hasStudent = get().students.some(s => s.id === studentId);
        if (!hasStudent) return false;
        set(state => ({
          students: state.students.map(s => (
            s.id === studentId ? withPointDelta(s, points, day) : s
          )),
        }));
        return true;
      },

      pushPointDeltaToSupabase: async (studentId, points, day = 1) => {
        const safeDay = Math.min(Math.max(Number(day) || 1, 1), 7);
        const { error } = await supabase.rpc('add_student_points', {
          p_student_id: studentId,
          p_delta:      points,
          p_day:        safeDay,
        });
        if (error) throw error;
        // Pull the authoritative recalculated totals back from DB so local
        // state stays in sync with the RPC's sum-from-transactions result.
        const { data } = await supabase
          .from('students')
          .select('id, total_points, day_points')
          .eq('id', studentId)
          .single();
        if (data) {
          set(state => ({
            students: state.students.map(s =>
              s.id === studentId
                ? { ...s, total_points: data.total_points, day_points: data.day_points }
                : s
            ),
          }));
        }
      },

      enqueuePointUpdate: (op) => {
        set(state => {
          if (state.pendingPointUpdates.some(x => x.id === op.id)) return state;
          return { pendingPointUpdates: [...state.pendingPointUpdates, op] };
        });
      },

      addPoints: async (studentId, points, day = 1) => {
        const applied = get().applyLocalPoints(studentId, points, day);
        if (!applied) return { success: false, error: 'Student not found' };

        const op = buildPointOp(studentId, points, day);
        if (!navigator.onLine) {
          get().enqueuePointUpdate(op);
          return { success: true, pending: true };
        }

        try {
          await get().pushPointDeltaToSupabase(studentId, points, day);
          return { success: true, pending: false };
        } catch {
          get().enqueuePointUpdate(op);
          return { success: true, pending: true };
        }
      },

      syncPendingPointUpdates: async () => {
        if (get().syncingPointUpdates || !navigator.onLine) return;
        set({ syncingPointUpdates: true });
        try {
          const queue = [...get().pendingPointUpdates];
          const done = new Set();
          for (const op of queue) {
            try {
              await get().pushPointDeltaToSupabase(op.studentId, op.points, op.day);
              done.add(op.id);
            } catch {
              // Keep remaining unsynced operations.
            }
          }
          if (done.size) {
            set(state => ({
              pendingPointUpdates: state.pendingPointUpdates.filter(op => !done.has(op.id)),
            }));
          }
        } finally {
          set({ syncingPointUpdates: false });
        }
      },

      setupPointAutoSync: () => {
        if (get().pointAutoSyncReady || typeof window === 'undefined') return;
        const onOnline = () => { get().syncPendingPointUpdates(); };
        window.addEventListener('online', onOnline);
        set({ pointAutoSyncReady: true });
      },

      importFromCSV: async (rows) => {
        const newStudents = rows.map((row, i) => {
          const age = row.Age || row.age || '';
          return {
            id: `csv_${Date.now()}_${i}`,
            roll_no: row['Roll Number'] || row.Roll || row.roll_no || '',
            name: row['Child Name'] || row['Name (English)'] || row.Name || row.name || '',
            mobile: (row.Mobile || row.mobile || '').replace(/[^0-9]/g, '').slice(0, 15),
            whatsapp: (row.WhatsApp || row.whatsapp || '').replace(/[^0-9]/g, '').slice(0, 15),
            class: row.Class || row.class || '',
            batch: row['Allotted Book'] || row.Batch || row.batch || '',
            room_no: (row['Room No.'] || row['Room No'] || row['Room Number'] || row.room_no || '').toUpperCase(),
            group: row['Class Teacher'] || row.Group || row.group || '',
            parent_name: row['Father Name'] || row['Parent Name'] || row.parent_name || '',
            mother_name: row['Mother Name'] || row.mother_name || '',
            city: row.City || row.city || '',
            pin_code: row['Pin Code'] || row['Pincode'] || row.pin_code || '',
            address: row.Address || row.address || '',
            pathshala: row.Pathshala || row.pathshala || '',
            achievements: row.Achievements || row.achievements || '',
            reg_id: row['Reg ID'] || row.reg_id || '',
            gender: row.Gender || row.gender || '',
            age: age ? (parseInt(age) || null) : null,
            dob: row.DOB || row.dob || null,
            total_points: 0,
            day_points: [0, 0, 0, 0, 0, 0, 0],
            checked_in: false,
          };
        });
        const { error } = await supabase.from('students').insert(newStudents);
        if (!error) set(state => ({ students: [...state.students, ...newStudents] }));
      },

      getLeaderboard: () => {
        const sorted = [...get().students].sort((a, b) => b.total_points - a.total_points);
        return sorted.map((s, i) => {
          const score = s.total_points;
          const maxScore = sorted[0]?.total_points || 1;
          const pct = score / maxScore;
          const category = pct >= 0.75 ? 'High' : pct >= 0.5 ? 'Mid-High' : pct >= 0.25 ? 'Mid' : 'Low';
          return { ...s, rank: i + 1, category };
        });
      },
    }),
    {
      name: 'shivir-students',
      partialize: (state) => ({
        students: state.students,
        pendingPointUpdates: state.pendingPointUpdates,
      }),
    }
  )
);
