import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase.js';

const TOTAL_POOL = 700;
const LEGACY_DEMO_ALLOCATIONS = {
  'Early Riser': 50,
  'Morning Puja': 80,
  'Class Session': 150,
  'Afternoon Bhakti': 100,
  'Afternoon Class': 100,
  'Games': 80,
  'Evening Program': 80,
  'Special Activity': 60,
};

function isLegacyDemoAllocations(value) {
  if (!value || typeof value !== 'object') return false;
  const keys = Object.keys(LEGACY_DEMO_ALLOCATIONS);
  if (Object.keys(value).length !== keys.length) return false;
  return keys.every(k => Number(value[k]) === Number(LEGACY_DEMO_ALLOCATIONS[k]));
}

export const useCoinStore = create(
  persist(
    (set, get) => ({
      totalPool: TOTAL_POOL,
      distributions: [],
      returns: [],
      slotStatus: { 1: 'open', 2: 'locked', 3: 'locked' },
      currentDay: 1,

      fetchCoins: async () => {
        const [distRes, retRes] = await Promise.all([
          supabase.from('coin_distributions').select('*').order('timestamp', { ascending: false }),
          supabase.from('coin_returns').select('*').order('timestamp', { ascending: false }),
        ]);
        if (!distRes.error) {
          const distributions = distRes.data || [];
          const currentAllocations = get().coinAllocations || {};
          const shouldBackfillAllocations = Object.keys(currentAllocations).length === 0 && distributions.length > 0;
          const derivedAllocations = shouldBackfillAllocations
            ? distributions.reduce((acc, row) => {
                const activity = String(row.activity || '').trim();
                if (!activity) return acc;
                acc[activity] = (acc[activity] || 0) + (Number(row.coins_sent) || 0);
                return acc;
              }, {})
            : currentAllocations;
          set({
            distributions,
            coinAllocations: shouldBackfillAllocations ? derivedAllocations : currentAllocations,
          });
        }
        if (!retRes.error) set({ returns: retRes.data || [] });
      },

      getStats: () => {
        const { distributions, returns } = get();
        const distributed = distributions.reduce((s, d) => s + d.coins_sent, 0);
        const returned = returns.reduce((s, r) => s + r.coins_returned, 0);
        const inCirculation = distributed - returned;
        const availableNow = TOTAL_POOL - inCirculation;
        return { totalPool: TOTAL_POOL, distributed, returned, inCirculation, availableNow };
      },

      distribute: async (activity, volunteerName, coinCount) => {
        const entry = {
          id: `cd${Date.now()}`,
          activity,
          volunteer_name: volunteerName,
          coins_sent: coinCount,
          day: get().currentDay,
          slot: 1,
          timestamp: new Date().toISOString(),
        };
        const { error } = await supabase.from('coin_distributions').insert(entry);
        if (!error) set(state => ({ distributions: [...state.distributions, entry] }));
        return entry;
      },

      recordReturn: async (slot, volunteerName, coinCount) => {
        const entry = {
          id: `cr${Date.now()}`,
          slot,
          volunteer_name: volunteerName,
          coins_returned: coinCount,
          day: get().currentDay,
          timestamp: new Date().toISOString(),
        };
        const { error } = await supabase.from('coin_returns').insert(entry);
        if (!error) set(state => ({ returns: [...state.returns, entry] }));
        return entry;
      },

      closeSlot: (slot) => {
        set(state => {
          const newStatus = { ...state.slotStatus, [slot]: 'closed' };
          if (slot < 3) newStatus[slot + 1] = 'open';
          return { slotStatus: newStatus };
        });
      },

      coinAllocations: {},

      updateAllocation: (activity, coins) => {
        set(state => ({
          coinAllocations: { ...state.coinAllocations, [activity]: coins }
        }));
      },

      getAllocationTotal: () => {
        return Object.values(get().coinAllocations).reduce((s, v) => s + v, 0);
      },
    }),
    {
      name: 'shivir-coins',
      version: 2,
      migrate: (persistedState, version) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState;
        if (version >= 2) return persistedState;
        const next = { ...persistedState };
        if (isLegacyDemoAllocations(next.coinAllocations)) {
          next.coinAllocations = {};
        }
        return next;
      },
      partialize: (s) => ({
        slotStatus: s.slotStatus,
        currentDay: s.currentDay,
        coinAllocations: s.coinAllocations,
      }),
    }
  )
);
