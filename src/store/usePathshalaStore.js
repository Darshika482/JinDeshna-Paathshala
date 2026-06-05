import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase.js';

function normalizeForDuplicate(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildStudentDuplicateKey(pathshalaCode, studentLike) {
  const code = String(pathshalaCode || '').trim();
  const name = normalizeForDuplicate(studentLike?.name);
  const parent = normalizeForDuplicate(studentLike?.parent_name || studentLike?.father_name);
  const mobile = normalizeForDuplicate(studentLike?.mobile);
  return `${code}|${name}|${parent}|${mobile}`;
}

function isDuplicateInputIncomplete(studentLike) {
  const name = normalizeForDuplicate(studentLike?.name);
  const parent = normalizeForDuplicate(studentLike?.parent_name || studentLike?.father_name);
  const mobile = normalizeForDuplicate(studentLike?.mobile);
  // Name is required separately; duplicate checks only run when at least one
  // additional identifier is present to reduce false positives.
  return !name || (!parent && !mobile);
}

function generatePathshalaCode(existing) {
  const codes = existing.map(p => parseInt(p.paathshala_code, 10)).filter(n => !isNaN(n));
  const max = codes.length ? Math.max(...codes) : 0;
  return String(max + 1).padStart(2, '0');
}

// Roll number format: PPSS — PP = paathshala code, SS = student seq within paathshala
function generateRollNo(pathshalaCode, allStudents) {
  const pp = String(pathshalaCode).padStart(2, '0');
  const siblings = allStudents.filter(s => s.paathshala_code === pathshalaCode);
  const seqs = siblings
    .map(s => parseInt(String(s.roll_no || '').slice(-2), 10))
    .filter(n => !isNaN(n));
  const nextSeq = seqs.length ? Math.max(...seqs) + 1 : 1;
  return `${pp}${String(nextSeq).padStart(2, '0')}`;
}

const INT_FIELDS = ['students_2_5', 'students_6_10', 'students_11_15', 'students_15_21'];
function coerceInts(data) {
  const out = { ...data };
  INT_FIELDS.forEach(k => { out[k] = parseInt(out[k] || 0) || 0; });
  return out;
}

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

// Generate a unique 4-digit PIN not already in the provided set.
function generateUniquePin(usedPins) {
  for (let i = 0; i < 100; i++) {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    if (!usedPins.has(pin)) { usedPins.add(pin); return pin; }
  }
  let n = 1000;
  while (usedPins.has(String(n))) n++;
  usedPins.add(String(n));
  return String(n);
}

const hasTeacherRole = (roles) =>
  (Array.isArray(roles) ? roles : []).some(r => /class\s*teacher|teacher/i.test(String(r || '')));

export const usePathshalaStore = create(
  persist(
    (set, get) => ({
      paathshalas: [],
      students: [],    // students with paathshala_code set
      loading: false,
      _teacherSyncRunning: false,

      fetchPathashalas: async () => {
        set({ loading: true });
        const [pRes, sRes] = await Promise.all([
          supabase.from('paathshalas').select('*').order('paathshala_code'),
          supabase.from('students').select('*').not('paathshala_code', 'is', null).order('roll_no'),
        ]);
        set({
          paathshalas: pRes.data || [],
          students: sRes.data || [],
          loading: false,
        });
      },

      addPathshala: async (formData) => {
        const { paathshalas } = get();
        const code = generatePathshalaCode(paathshalas);
        const newP = {
          ...coerceInts(formData),
          id: `p_${Date.now()}`,
          paathshala_code: code,
          created_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('paathshalas').insert(newP);
        if (error) return { success: false, error: error.message };
        set(state => ({ paathshalas: [...state.paathshalas, newP] }));
        // Auto-register this Paathshala's teacher(s) as teacher-only volunteers.
        await get().syncPaathshalaTeachers(newP);
        return { success: true, code };
      },

      updatePathshala: async (id, formData) => {
        const { error } = await supabase.from('paathshalas').update(coerceInts(formData)).eq('id', id);
        if (error) return { success: false, error: error.message };
        set(state => ({
          paathshalas: state.paathshalas.map(p => p.id === id ? { ...p, ...formData } : p),
        }));
        const updated = get().paathshalas.find(p => p.id === id);
        if (updated) await get().syncPaathshalaTeachers(updated);
        return { success: true };
      },

      // ── Auto-add Paathshala teachers as teacher-only volunteers ────────────
      // Teacher1/Teacher2 of a Paathshala become volunteers with the single
      // "Class Teacher" role (so they can ONLY log into the teacher portal) and
      // carry their Paathshala name. New teachers get an auto-generated PIN.
      // Best-effort: never blocks Paathshala creation if it fails.
      syncPaathshalaTeachers: async (pathshala) => {
        try {
          const teachers = [
            { name: pathshala.teacher1_name, mobile: pathshala.teacher1_mobile },
            { name: pathshala.teacher2_name, mobile: pathshala.teacher2_mobile },
          ].filter(t => String(t.name || '').trim());
          if (!teachers.length) return { success: true, added: 0 };

          // Fetch existing volunteers. Try with paathshala_code, but fall back
          // gracefully if that column hasn't been added to the DB yet.
          let existingRes = await supabase
            .from('volunteers')
            .select('id,name,mobile,pin,roles,paathshala_code');
          if (existingRes.error) {
            existingRes = await supabase
              .from('volunteers')
              .select('id,name,mobile,pin,roles');
          }
          const all = existingRes.data || [];
          const usedPins = new Set(all.map(v => String(v.pin || '')).filter(Boolean));

          let added = 0;
          for (const t of teachers) {
            const tName = String(t.name).trim();
            const tMobile = onlyDigits(t.mobile);

            let match = null;
            if (tMobile) match = all.find(v => onlyDigits(v.mobile) === tMobile);
            // No mobile to match on → fall back to name match so we update an
            // existing same-name teacher instead of creating a duplicate.
            if (!match) {
              match = all.find(v =>
                String(v.name || '').trim().toLowerCase() === tName.toLowerCase()
              );
            }

            if (match) {
              // Don't downgrade existing mentors — just ensure the teacher role
              // is present and attach the Paathshala link.
              const roles = Array.isArray(match.roles) ? match.roles : [];
              const newRoles = hasTeacherRole(roles) ? roles : [...roles, 'Class Teacher'];
              const mobilePatch = match.mobile ? {} : (t.mobile ? { mobile: t.mobile } : {});
              const fullPayload = {
                roles: newRoles,
                paathshala: pathshala.paathshala_name,
                paathshala_code: pathshala.paathshala_code,
                ...mobilePatch,
              };
              let upd = await supabase.from('volunteers').update(fullPayload).eq('id', match.id);
              if (upd.error) {
                // Retry without paathshala columns (not migrated yet).
                await supabase.from('volunteers')
                  .update({ roles: newRoles, ...mobilePatch })
                  .eq('id', match.id);
              }
            } else {
              const pin = generateUniquePin(usedPins);
              const base = {
                id: `vt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                name: tName,
                pin,
                mobile: t.mobile || null,
                roles: ['Class Teacher'],
              };
              const fullV = {
                ...base,
                paathshala: pathshala.paathshala_name,
                paathshala_code: pathshala.paathshala_code,
              };
              let ins = await supabase.from('volunteers').insert(fullV);
              if (ins.error) {
                // Retry without paathshala columns (not migrated yet).
                ins = await supabase.from('volunteers').insert(base);
              }
              if (!ins.error) { all.push(fullV); added++; }
            }
          }
          return { success: true, added };
        } catch (e) {
          return { success: false, error: e?.message };
        }
      },

      // Remove duplicate auto-added teacher volunteers (same mobile, or same
      // name when no mobile). Only touches auto-created teachers (id "vt_…") so
      // real mentors are never deleted. Keeps the row that has a Paathshala set.
      dedupePaathshalaTeachers: async () => {
        try {
          const { data } = await supabase
            .from('volunteers')
            .select('id,name,mobile,pin,roles,paathshala,paathshala_code');
          const autoTeachers = (data || []).filter(v => String(v.id || '').startsWith('vt_'));
          const groups = new Map();
          for (const v of autoTeachers) {
            const key = onlyDigits(v.mobile) || `name:${String(v.name || '').trim().toLowerCase()}`;
            if (!key) continue;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(v);
          }
          const toDelete = [];
          for (const [, list] of groups) {
            if (list.length <= 1) continue;
            const keep = list.find(v => v.paathshala) || list[0];
            for (const v of list) if (v.id !== keep.id) toDelete.push(v.id);
          }
          if (toDelete.length) {
            await supabase.from('volunteers').delete().in('id', toDelete);
          }
          return { removed: toDelete.length };
        } catch (e) {
          return { removed: 0, error: e?.message };
        }
      },

      // Backfill teacher volunteers for every already-registered Paathshala.
      // Guarded so overlapping/duplicate runs (e.g. React re-mounts) can't race
      // and create duplicate teacher rows.
      syncAllPaathshalaTeachers: async () => {
        if (get()._teacherSyncRunning) return { success: false, skipped: true, added: 0 };
        set({ _teacherSyncRunning: true });
        try {
          await get().dedupePaathshalaTeachers();
          const { paathshalas } = get();
          let added = 0;
          for (const p of paathshalas) {
            const r = await get().syncPaathshalaTeachers(p);
            added += r?.added || 0;
          }
          return { success: true, added };
        } finally {
          set({ _teacherSyncRunning: false });
        }
      },

      deletePathshala: async (id) => {
        const pathshala = get().paathshalas.find(p => p.id === id);
        if (!pathshala) return { success: false, error: 'Pathshala not found' };

        const code = pathshala.paathshala_code;
        const linked = get().students.filter(s => s.paathshala_code === code);

        if (linked.length) {
          const { error: studentError } = await supabase
            .from('students')
            .delete()
            .eq('paathshala_code', code);
          if (studentError) return { success: false, error: studentError.message };
        }

        const { error } = await supabase.from('paathshalas').delete().eq('id', id);
        if (error) return { success: false, error: error.message };

        set(state => ({
          paathshalas: state.paathshalas.filter(p => p.id !== id),
          students: state.students.filter(s => s.paathshala_code !== code),
        }));
        return {
          success: true,
          deletedStudents: linked.length,
        };
      },

      addStudentToPathshala: async (pathshala, studentData, options = {}) => {
        const { allowDuplicate = false } = options;
        const { students } = get();
        const duplicateKey = buildStudentDuplicateKey(pathshala.paathshala_code, studentData);
        const hasDuplicate = !isDuplicateInputIncomplete(studentData)
          && students.some(s => buildStudentDuplicateKey(pathshala.paathshala_code, s) === duplicateKey);
        if (hasDuplicate && !allowDuplicate) {
          return {
            success: false,
            duplicateDetected: true,
            duplicateCount: 1,
            duplicates: [{
              name: String(studentData.name || '').trim(),
              parent_name: String(studentData.parent_name || '').trim(),
              mobile: String(studentData.mobile || '').trim(),
            }],
            error: 'Duplicate student detected',
          };
        }

        const rollNo = generateRollNo(pathshala.paathshala_code, students);
        const newStudent = {
          id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          roll_no: rollNo,
          name: studentData.name,
          parent_name: studentData.parent_name,
          father_name: studentData.parent_name,
          mobile: studentData.mobile,
          gender: studentData.gender || null,
          age: studentData.age ? parseInt(studentData.age) : null,
          batch: studentData.age_group || '',
          pathshala: pathshala.paathshala_name,
          paathshala_code: pathshala.paathshala_code,
          group: studentData.class_group || '',
          total_points: 0,
          day_points: [0, 0, 0, 0, 0, 0, 0],
          checked_in: false,
        };
        const { error } = await supabase.from('students').insert(newStudent);
        if (error) return { success: false, error: error.message };
        set(state => ({ students: [...state.students, newStudent] }));
        return { success: true, rollNo };
      },

      importStudentsFromCSV: async (pathshala, rows, options = {}) => {
        const { allowDuplicates = false } = options;
        // rows: [{ name, parent_name, mobile }]
        const { students } = get();
        const pp = String(pathshala.paathshala_code).padStart(2, '0');
        const existingKeys = new Set(
          students
            .filter(s => s.paathshala_code === pathshala.paathshala_code)
            .map(s => buildStudentDuplicateKey(pathshala.paathshala_code, s))
        );
        const fileSeen = new Set();
        const duplicateRows = [];

        rows.forEach((row, rowIndex) => {
          if (isDuplicateInputIncomplete(row)) return;
          const key = buildStudentDuplicateKey(pathshala.paathshala_code, row);
          const duplicateInSystem = existingKeys.has(key);
          const duplicateInFile = fileSeen.has(key);
          if (duplicateInSystem || duplicateInFile) {
            duplicateRows.push({
              rowIndex,
              name: String(row.name || '').trim(),
              parent_name: String(row.parent_name || '').trim(),
              mobile: String(row.mobile || '').trim(),
            });
          }
          fileSeen.add(key);
        });

        if (duplicateRows.length > 0 && !allowDuplicates) {
          return {
            success: false,
            duplicateDetected: true,
            duplicateCount: duplicateRows.length,
            duplicates: duplicateRows,
            error: 'Duplicate students detected',
            count: 0,
          };
        }

        // Find current max seq for this paathshala
        const siblings = students.filter(s => s.paathshala_code === pathshala.paathshala_code);
        const seqs = siblings
          .map(s => parseInt(String(s.roll_no || '').slice(-2), 10))
          .filter(n => !isNaN(n));
        let nextSeq = seqs.length ? Math.max(...seqs) + 1 : 1;

        const newStudents = rows.map(row => {
          const rollNo = `${pp}${String(nextSeq).padStart(2, '0')}`;
          nextSeq++;
          const name = String(row.name || '').trim();
          const parent = String(row.parent_name || '').trim();
          return {
            id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${rollNo}`,
            roll_no: rollNo,
            name,
            parent_name: parent,
            father_name: parent,
            mobile: String(row.mobile || '').trim(),
            gender: String(row.gender || '').trim() || null,
            age: row.age ? parseInt(row.age) : null,
            batch: String(row.age_group || '').trim(),
            pathshala: pathshala.paathshala_name,
            paathshala_code: pathshala.paathshala_code,
            group: String(row.class_group || '').trim(),
            total_points: 0,
            day_points: [0, 0, 0, 0, 0, 0, 0],
            checked_in: false,
          };
        });

        const { error } = await supabase.from('students').insert(newStudents);
        if (error) return { success: false, error: error.message, count: 0 };
        set(state => ({ students: [...state.students, ...newStudents] }));
        return { success: true, count: newStudents.length };
      },

      deleteStudent: async (studentId) => {
        const { error } = await supabase.from('students').delete().eq('id', studentId);
        if (error) return { success: false, error: error.message };
        set(state => ({ students: state.students.filter(s => s.id !== studentId) }));
        return { success: true };
      },

      updateStudent: async (studentId, updates) => {
        const payload = {
          name: updates.name,
          parent_name: updates.parent_name,
          father_name: updates.parent_name,
          mobile: updates.mobile,
          gender: updates.gender || null,
          age: updates.age ? parseInt(updates.age) : null,
          batch: updates.age_group || '',
          group: updates.class_group || '',
        };
        const { error } = await supabase.from('students').update(payload).eq('id', studentId);
        if (error) return { success: false, error: error.message };
        set(state => ({
          students: state.students.map(s => s.id === studentId ? { ...s, ...payload } : s),
        }));
        return { success: true };
      },
    }),
    {
      name: 'pathshala-store',
      partialize: state => ({ paathshalas: state.paathshalas, students: state.students }),
    }
  )
);
