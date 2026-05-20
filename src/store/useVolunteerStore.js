import { create } from 'zustand';
import { supabase } from '../lib/supabase.js';

export const useVolunteerStore = create((set, get) => ({
  volunteers: [],
  loading: true,

  fetchVolunteers: async () => {
    set({ loading: true });
    const { data, error } = await supabase.from('volunteers').select('*').order('name');
    if (!error) set({ volunteers: data || [] });
    set({ loading: false });
  },

  addVolunteer: async (v) => {
    const newV = { ...v, id: `v${Date.now()}` };
    const { error } = await supabase.from('volunteers').insert(newV);
    if (!error) set(state => ({ volunteers: [...state.volunteers, newV] }));
  },

  importFromCSV: async (rows) => {
    const newVolunteers = rows
      .filter(row => (row.Name || row.name || '').trim())
      .map((row, i) => {
        const rolesRaw = row.Roles || row.roles || row.Role || row.role || '';
        const roles = rolesRaw.split(/[;,]/).map(r => r.trim()).filter(Boolean);
        const classesRaw = row['Assigned Classes'] || row['Assigned Class'] || row.assigned_classes || row.assigned_class || '';
        const assigned_classes = classesRaw.split(/[;,]/).map(c => c.trim().toUpperCase()).filter(Boolean);
        return {
          id: `v${Date.now()}_${i}`,
          name: (row.Name || row.name || '').trim(),
          pin: String(row.PIN || row.Pin || row.pin || '').trim(),
          mobile: (row.Mobile || row.mobile || '').replace(/[^0-9]/g, '').slice(0, 15),
          city: (row.City || row.city || '').trim(),
          availability: (row.Availability || row.availability || '').trim(),
          roles,
          assigned_class: assigned_classes[0] || '',
          assigned_classes,
          has_deduction_rights: (row['Has Deduction Rights'] || row['Deduction Rights'] || '').toLowerCase() === 'yes',
          session_classes: {},
          responsibilities: [],
        };
      });
    if (!newVolunteers.length) return { success: false, error: 'No valid rows found.' };
    const { error } = await supabase.from('volunteers').insert(newVolunteers);
    if (!error) set(state => ({ volunteers: [...state.volunteers, ...newVolunteers] }));
    return { success: !error, count: newVolunteers.length, error: error?.message };
  },

  updateVolunteer: async (id, updates) => {
    const { error } = await supabase.from('volunteers').update(updates).eq('id', id);
    if (!error) set(state => ({
      volunteers: state.volunteers.map(v => v.id === id ? { ...v, ...updates } : v)
    }));
  },

  deleteVolunteer: async (id) => {
    const { error } = await supabase.from('volunteers').delete().eq('id', id);
    if (!error) set(state => ({ volunteers: state.volunteers.filter(v => v.id !== id) }));
  },

  getByPin: (pin) => get().volunteers.find(v => v.pin === pin),
}));
