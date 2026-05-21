import { create } from 'zustand';
import { supabase } from '../lib/supabase.js';

export const useCompetitionsStore = create((set, get) => ({
  competitions: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    const { data } = await supabase.from('competitions').select('*').order('sort_order');
    set({ competitions: data || [], loading: false });
  },

  getActive: () => get().competitions.filter(c => c.is_active),

  add: async (data) => {
    const { data: row, error } = await supabase.from('competitions').insert(data).select().single();
    if (error) return { success: false, error: error.message };
    set(s => ({ competitions: [...s.competitions, row].sort((a, b) => a.sort_order - b.sort_order) }));
    return { success: true };
  },

  update: async (id, data) => {
    const { error } = await supabase.from('competitions').update(data).eq('id', id);
    if (error) return { success: false, error: error.message };
    set(s => ({ competitions: s.competitions.map(c => c.id === id ? { ...c, ...data } : c) }));
    return { success: true };
  },

  remove: async (id) => {
    const { error } = await supabase.from('competitions').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    set(s => ({ competitions: s.competitions.filter(c => c.id !== id) }));
    return { success: true };
  },
}));
