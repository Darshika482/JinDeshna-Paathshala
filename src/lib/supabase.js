import { createClient } from '@supabase/supabase-js';

function readStoredSupabase() {
  try {
    const raw = localStorage.getItem('shiviros-config');
    if (!raw) return {};
    const state = JSON.parse(raw)?.state || {};
    return { url: state.supabaseUrl || '', key: state.supabaseAnonKey || '' };
  } catch { return {}; }
}

const stored = readStoredSupabase();
const SUPABASE_URL = stored.url || '';
const SUPABASE_KEY = stored.key || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
// Provide placeholder to avoid createClient throwing on empty strings
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.placeholder'
);
