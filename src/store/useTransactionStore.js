import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase.js';
import { getCampDayForDate } from '../lib/campDates.js';
import { useStudentStore } from './useStudentStore.js';

const TX_PENDING = 'pending';
const TX_SYNCED = 'synced';

function isDuplicateInsertError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return error?.code === '23505' || msg.includes('duplicate key');
}

// Detect Supabase's "schema cache" / "column not found" errors and extract
// the offending column name. Supabase returns messages like:
//   "Could not find the 'coin_count' column of 'transactions' in the schema cache"
// or "column \"notes\" of relation \"transactions\" does not exist".
function extractMissingColumn(error) {
  const msg = String(error?.message || error || '');
  const m1 = msg.match(/(?:'|")([a-zA-Z0-9_]+)(?:'|")\s+column\s+of\s+['"]?transactions/i);
  if (m1) return m1[1];
  const m2 = msg.match(/column\s+['"]([a-zA-Z0-9_]+)['"]\s+of\s+relation\s+['"]transactions['"]/i);
  if (m2) return m2[1];
  const m3 = msg.match(/Could not find the\s+['"]?([a-zA-Z0-9_]+)['"]?\s+column/i);
  if (m3) return m3[1];
  return null;
}

function withSyncStatus(tx, status = TX_PENDING) {
  return { ...tx, sync_status: status };
}

function toRemoteTransactionPayload(tx) {
  const { sync_status, ...payload } = tx || {};
  return payload;
}

// Columns that might be missing on older Supabase schemas. If insert fails
// because of one of these, we retry without it.
const OPTIONAL_TX_COLUMNS = new Set(['coin_count', 'type', 'notes', 'flagged', 'roll_no']);

async function insertTransactionWithFallback(payload) {
  let current = { ...payload };
  // Bounded retry so we can't loop forever on unexpected schema errors.
  for (let i = 0; i < 5; i += 1) {
    const res = await supabase.from('transactions').insert(current);
    if (!res.error) return { error: null, payload: current };
    const missing = extractMissingColumn(res.error);
    if (missing && OPTIONAL_TX_COLUMNS.has(missing) && missing in current) {
      delete current[missing];
      continue;
    }
    return { error: res.error, payload: current };
  }
  return { error: new Error('Too many schema retries'), payload: current };
}

function uniqById(list) {
  const map = new Map();
  for (const item of list) map.set(item.id, item);
  return [...map.values()];
}

export const useTransactionStore = create(
  persist(
    (set, get) => ({
      transactions: [],
      pendingMentorEntries: [],
      syncingPendingMentorEntries: false,
      lastSyncError: null,
      txAutoSyncReady: false,
      // Auto-derive the current camp day from today's calendar date so that
      // attendance points always book against the correct day (May 3 → Day 1,
      // ... May 9 → Day 7) without any manual flipping.
      currentDay: getCampDayForDate(),
      currentSlot: 1,
      loading: true,

      fetchTransactions: async () => {
        set({ loading: true, currentDay: getCampDayForDate() });
        // Supabase PostgREST caps responses at 1000 rows by default.
        // Paginate until we have every row so leaderboard aggregations are correct.
        const PAGE = 1000;
        let allData = [];
        let page = 0;
        let fetchError = null;
        while (true) {
          const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .order('timestamp', { ascending: false })
            .range(page * PAGE, (page + 1) * PAGE - 1);
          if (error) { fetchError = error; break; }
          allData = allData.concat(data || []);
          if ((data || []).length < PAGE) break;
          page += 1;
        }
        if (!fetchError) {
          const remote = allData.map(tx => withSyncStatus(tx, TX_SYNCED));
          const pendingIds = new Set(get().pendingMentorEntries.map(entry => entry.id));
          const pendingLocal = get().transactions.filter(tx => pendingIds.has(tx.id));
          set({ transactions: uniqById([...pendingLocal, ...remote]) });
        }
        set({ loading: false });
      },

      refreshCurrentDay: () => set({ currentDay: getCampDayForDate() }),

      upsertLocalTransaction: (tx) => {
        set(state => {
          const existing = state.transactions.find(t => t.id === tx.id);
          if (existing) {
            return {
              transactions: state.transactions.map(t => t.id === tx.id ? { ...t, ...tx } : t),
            };
          }
          return { transactions: [tx, ...state.transactions] };
        });
      },

      markTransactionSynced: (txId) => {
        set(state => ({
          transactions: state.transactions.map(tx => (
            tx.id === txId ? { ...tx, sync_status: TX_SYNCED } : tx
          )),
        }));
      },

      enqueueMentorEntry: (entry) => {
        set(state => {
          const idx = state.pendingMentorEntries.findIndex(x => x.id === entry.id);
          if (idx === -1) {
            return { pendingMentorEntries: [...state.pendingMentorEntries, entry] };
          }
          const next = [...state.pendingMentorEntries];
          next[idx] = { ...next[idx], ...entry };
          return { pendingMentorEntries: next };
        });
      },

      syncMentorEntryPayload: async (entry) => {
        let transactionInserted = !!entry.transactionInserted;
        if (!transactionInserted) {
          const payload = toRemoteTransactionPayload(entry.tx);
          const ins = await insertTransactionWithFallback(payload);
          if (ins.error) {
            if (isDuplicateInsertError(ins.error)) {
              transactionInserted = true;
            } else {
              console.error('[sync] transactions.insert failed', {
                payload: ins.payload,
                error: ins.error,
              });
              const msg = [ins.error.message, ins.error.details, ins.error.hint]
                .filter(Boolean)
                .join(' — ');
              const err = new Error(msg || 'Failed to insert transaction');
              err.cause = ins.error;
              err.transactionInserted = false;
              err.pointsSynced = !!entry.pointsSynced;
              throw err;
            }
          } else {
            transactionInserted = true;
          }
        }

        if (!entry.pointsSynced) {
          try {
            await useStudentStore.getState().pushPointDeltaToSupabase(
              entry.tx.student_id,
              entry.pointsDelta,
              entry.tx.day
            );
          } catch (pointsErr) {
            console.error('[sync] students points update failed', {
              studentId: entry.tx.student_id,
              pointsDelta: entry.pointsDelta,
              day: entry.tx.day,
              error: pointsErr,
            });
            const msg = [pointsErr?.message, pointsErr?.details, pointsErr?.hint]
              .filter(Boolean)
              .join(' — ');
            const err = new Error(msg || 'Failed to sync points');
            err.cause = pointsErr;
            err.transactionInserted = transactionInserted;
            err.pointsSynced = false;
            throw err;
          }
        }

        return { synced: true, transactionInserted, pointsSynced: true };
      },

      recordMentorEntry: async (txInput, pointsDelta) => {
        const tx = withSyncStatus({
          ...txInput,
          id: txInput.id || `t${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: txInput.timestamp || new Date().toISOString(),
          flagged: !!txInput.flagged,
        }, TX_PENDING);

        const delta = Number(pointsDelta ?? tx.points ?? 0);
        get().upsertLocalTransaction(tx);
        useStudentStore.getState().applyLocalPoints(tx.student_id, delta, tx.day);

        const queueEntry = {
          id: tx.id,
          tx,
          pointsDelta: delta,
          transactionInserted: false,
          pointsSynced: false,
          createdAt: new Date().toISOString(),
        };

        if (!navigator.onLine) {
          get().enqueueMentorEntry(queueEntry);
          return { pending: true, tx };
        }

        try {
          set({ lastSyncError: null });
          const result = await get().syncMentorEntryPayload(queueEntry);
          if (result.synced) get().markTransactionSynced(tx.id);
          return { pending: false, tx };
        } catch (error) {
          get().enqueueMentorEntry({
            ...queueEntry,
            transactionInserted: !!error?.transactionInserted,
            pointsSynced: !!error?.pointsSynced,
          });
          set({ lastSyncError: error?.message || 'Failed to sync entry' });
          return { pending: true, tx };
        }
      },

      addTransaction: async (txInput) => {
        const tx = withSyncStatus({
          ...txInput,
          id: txInput.id || `t${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: txInput.timestamp || new Date().toISOString(),
          flagged: !!txInput.flagged,
        }, TX_PENDING);

        get().upsertLocalTransaction(tx);
        const queueEntry = {
          id: tx.id,
          tx,
          pointsDelta: 0,
          transactionInserted: false,
          pointsSynced: true,
          createdAt: new Date().toISOString(),
        };

        if (!navigator.onLine) {
          get().enqueueMentorEntry(queueEntry);
          return tx;
        }

        try {
          set({ lastSyncError: null });
          const result = await get().syncMentorEntryPayload(queueEntry);
          if (result.synced) get().markTransactionSynced(tx.id);
        } catch (error) {
          get().enqueueMentorEntry({
            ...queueEntry,
            transactionInserted: !!error?.transactionInserted,
            pointsSynced: !!error?.pointsSynced,
          });
          set({ lastSyncError: error?.message || 'Failed to sync entry' });
        }
        return tx;
      },

      syncPendingMentorEntries: async () => {
        if (get().syncingPendingMentorEntries || !navigator.onLine) return;
        set({ syncingPendingMentorEntries: true, lastSyncError: null });
        try {
          const queue = [...get().pendingMentorEntries];
          const done = new Set();
          const nextQueue = [...queue];
          for (const entry of queue) {
            try {
              const result = await get().syncMentorEntryPayload(entry);
              if (result.synced) {
                done.add(entry.id);
              }
            } catch (error) {
              const idx = nextQueue.findIndex(q => q.id === entry.id);
              if (idx !== -1) {
                nextQueue[idx] = {
                  ...nextQueue[idx],
                  transactionInserted: !!error?.transactionInserted,
                  pointsSynced: !!error?.pointsSynced,
                };
              }
              set({ lastSyncError: error?.message || 'Failed to sync pending entries' });
            }
          }

          set({ pendingMentorEntries: nextQueue });
          if (done.size) {
            set(state => ({
              pendingMentorEntries: state.pendingMentorEntries.filter(entry => !done.has(entry.id)),
            }));
            for (const id of done) get().markTransactionSynced(id);
          }
        } finally {
          set({ syncingPendingMentorEntries: false });
        }
      },

      setupTransactionAutoSync: () => {
        if (get().txAutoSyncReady || typeof window === 'undefined') return;
        const onOnline = () => { get().syncPendingMentorEntries(); };
        window.addEventListener('online', onOnline);
        set({ txAutoSyncReady: true });
      },

      clearPendingMentorEntries: () => {
        const pending = get().pendingMentorEntries;
        const pendingIds = new Set(pending.map(e => e.id));
        set(state => ({
          pendingMentorEntries: [],
          transactions: state.transactions.filter(tx => !pendingIds.has(tx.id)),
          lastSyncError: null,
        }));
        return pending.length;
      },

      flagTransaction: async (id) => {
        const tx = get().transactions.find(t => t.id === id);
        if (!tx) return;
        const flagged = !tx.flagged;
        const { error } = await supabase.from('transactions').update({ flagged }).eq('id', id);
        if (!error) set(state => ({
          transactions: state.transactions.map(t => t.id === id ? { ...t, flagged } : t)
        }));
      },

      getByStudent: (studentId) => get().transactions.filter(t => t.student_id === studentId),

      getByVolunteer: (volunteerId) => get().transactions.filter(t => t.volunteer_id === volunteerId),

      getTodayStats: () => {
        const today = get().currentDay;
        const todayTx = get().transactions.filter(t => t.day === today);
        const pointsToday = todayTx.filter(t => t.points > 0).reduce((sum, t) => sum + t.points, 0);
        return { pointsToday, count: todayTx.length };
      },

      // Expose the live-day helper so any UI can compute the day for an arbitrary
      // date if needed (e.g. backfilling missed attendance the next morning).
      getCampDayForDate,

      setDay: (day) => set({ currentDay: day }),
      setSlot: (slot) => set({ currentSlot: slot }),
    }),
    {
      name: 'shivir-transactions',
      version: 2,
      migrate: (persistedState, version) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState;
        if (version >= 2) return persistedState;
        return {
          ...persistedState,
          // Drop legacy persisted rows that could contain old demo transactions.
          // Live data is re-fetched from Supabase on app load.
          transactions: [],
        };
      },
      partialize: (state) => ({
        transactions: state.transactions,
        pendingMentorEntries: state.pendingMentorEntries,
        currentDay: state.currentDay,
        currentSlot: state.currentSlot,
      }),
    }
  )
);
