import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase.js';

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

export const usePathshalaStore = create(
  persist(
    (set, get) => ({
      paathshalas: [],
      students: [],    // students with paathshala_code set
      loading: false,

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
        return { success: true, code };
      },

      updatePathshala: async (id, formData) => {
        const { error } = await supabase.from('paathshalas').update(coerceInts(formData)).eq('id', id);
        if (error) return { success: false, error: error.message };
        set(state => ({
          paathshalas: state.paathshalas.map(p => p.id === id ? { ...p, ...formData } : p),
        }));
        return { success: true };
      },

      deletePathshala: async (id, { deleteStudents = false } = {}) => {
        const pathshala = get().paathshalas.find(p => p.id === id);
        if (!pathshala) return { success: false, error: 'Pathshala not found' };

        const code = pathshala.paathshala_code;
        const linked = get().students.filter(s => s.paathshala_code === code);

        if (deleteStudents && linked.length) {
          const { error: studentError } = await supabase
            .from('students')
            .delete()
            .eq('paathshala_code', code);
          if (studentError) return { success: false, error: studentError.message };
        } else if (linked.length) {
          const { error: unlinkError } = await supabase
            .from('students')
            .update({ paathshala_code: null, pathshala: null })
            .eq('paathshala_code', code);
          if (unlinkError) return { success: false, error: unlinkError.message };
        }

        const { error } = await supabase.from('paathshalas').delete().eq('id', id);
        if (error) return { success: false, error: error.message };

        set(state => ({
          paathshalas: state.paathshalas.filter(p => p.id !== id),
          students: state.students.filter(s => s.paathshala_code !== code),
        }));
        return {
          success: true,
          deletedStudents: deleteStudents ? linked.length : 0,
          unlinkedStudents: deleteStudents ? 0 : linked.length,
        };
      },

      addStudentToPathshala: async (pathshala, studentData) => {
        const { students } = get();
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

      importStudentsFromCSV: async (pathshala, rows) => {
        // rows: [{ name, parent_name, mobile }]
        const { students } = get();
        const pp = String(pathshala.paathshala_code).padStart(2, '0');

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
