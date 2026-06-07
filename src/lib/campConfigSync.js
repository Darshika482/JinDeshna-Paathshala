import { supabase } from './supabase.js';
import { useConfigStore } from '../store/useConfigStore.js';
import { notifyCampConfigUpdated } from './campDates.js';

const DB_TO_STORE = {
  camp_start_date: 'campStartDate',
  camp_end_date: 'campEndDate',
  camp_name: 'campName',
  camp_city: 'campCity',
  camp_total_days: 'campTotalDays',
  // Legacy key from Operations → Config tab
  start_date: 'campStartDate',
};

const STORE_TO_DB = {
  campStartDate: 'camp_start_date',
  campEndDate: 'camp_end_date',
  campName: 'camp_name',
  campCity: 'camp_city',
  campTotalDays: 'camp_total_days',
};

function deriveTotalDays(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

/** Pull camp calendar from Supabase so all devices share the same dates. */
export async function fetchCampConfigFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('shivir_config')
      .select('key,value')
      .in('key', Object.keys(DB_TO_STORE));

    if (error || !data?.length) return false;

    const patch = {};
    for (const row of data) {
      const storeKey = DB_TO_STORE[row.key];
      if (storeKey && row.value != null && row.value !== '') {
        patch[storeKey] = row.value;
      }
    }

    if (patch.campStartDate && patch.campEndDate && !patch.campTotalDays) {
      patch.campTotalDays = deriveTotalDays(patch.campStartDate, patch.campEndDate);
    }

    if (Object.keys(patch).length === 0) return false;

    useConfigStore.getState().saveCampConfig(patch);
    notifyCampConfigUpdated();
    return true;
  } catch {
    return false;
  }
}

/** Push camp calendar to Supabase when admin saves settings. */
export async function saveCampConfigToSupabase(cfg) {
  const rows = [];
  for (const [storeKey, dbKey] of Object.entries(STORE_TO_DB)) {
    if (cfg[storeKey] != null && cfg[storeKey] !== '') {
      rows.push({ key: dbKey, value: String(cfg[storeKey]) });
    }
  }
  if (rows.length === 0) return { error: null };

  const { error } = await supabase
    .from('shivir_config')
    .upsert(rows, { onConflict: 'key' });

  return { error };
}
