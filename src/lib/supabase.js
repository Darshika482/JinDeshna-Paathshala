import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lfnkzwxufdohjxnixikh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxmbmt6d3h1ZmRvaGp4bml4aWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjM5NjgsImV4cCI6MjA5NDgzOTk2OH0.64GMDwI1n30qRCBmK5E0qqbP8qY9qrsSjRc-37oCeLI';

export const isSupabaseConfigured = true;
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
