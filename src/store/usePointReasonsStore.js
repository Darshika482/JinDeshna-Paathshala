import { create } from 'zustand';
import { supabase } from '../lib/supabase.js';

export const usePointReasonsStore = create((set, get) => ({
  categories: [],
  reasons: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    const [catRes, reasonRes] = await Promise.all([
      supabase.from('point_categories').select('*').order('sort_order'),
      supabase.from('point_reasons').select('*').order('sort_order'),
    ]);
    if (catRes.error || reasonRes.error) {
      set({ loading: false, error: (catRes.error || reasonRes.error).message });
      return;
    }
    set({ categories: catRes.data || [], reasons: reasonRes.data || [], loading: false });
  },

  getGiveCategories: () =>
    get().categories.filter(c => c.mode === 'give' && c.is_active),

  getTakeCategory: () =>
    get().categories.find(c => c.mode === 'take' && c.is_active),

  getReasonsForCategory: (catId) =>
    get().reasons.filter(r => r.category_id === catId && r.is_active),

  // Admin CRUD — categories
  addCategory: async (data) => {
    const { data: row, error } = await supabase.from('point_categories').insert(data).select().single();
    if (error) return { success: false, error: error.message };
    set(s => ({ categories: [...s.categories, row].sort((a, b) => a.sort_order - b.sort_order) }));
    return { success: true };
  },

  updateCategory: async (id, data) => {
    const { error } = await supabase.from('point_categories').update(data).eq('id', id);
    if (error) return { success: false, error: error.message };
    set(s => ({ categories: s.categories.map(c => c.id === id ? { ...c, ...data } : c) }));
    return { success: true };
  },

  deleteCategory: async (id) => {
    const { error } = await supabase.from('point_categories').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    set(s => ({
      categories: s.categories.filter(c => c.id !== id),
      reasons: s.reasons.filter(r => r.category_id !== id),
    }));
    return { success: true };
  },

  // Admin CRUD — reasons
  addReason: async (data) => {
    const { data: row, error } = await supabase.from('point_reasons').insert(data).select().single();
    if (error) return { success: false, error: error.message };
    set(s => ({ reasons: [...s.reasons, row].sort((a, b) => a.sort_order - b.sort_order) }));
    return { success: true };
  },

  updateReason: async (id, data) => {
    const { error } = await supabase.from('point_reasons').update(data).eq('id', id);
    if (error) return { success: false, error: error.message };
    set(s => ({ reasons: s.reasons.map(r => r.id === id ? { ...r, ...data } : r) }));
    return { success: true };
  },

  deleteReason: async (id) => {
    const { error } = await supabase.from('point_reasons').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    set(s => ({ reasons: s.reasons.filter(r => r.id !== id) }));
    return { success: true };
  },
}));
