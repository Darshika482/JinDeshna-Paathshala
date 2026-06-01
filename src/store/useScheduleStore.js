import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function sanitizeSchedule(schedule) {
  if (!schedule || typeof schedule !== 'object') return {};
  const next = {};
  for (const [day, activities] of Object.entries(schedule)) {
    const safeDay = Number(day);
    if (!Number.isFinite(safeDay)) continue;
    const kept = (Array.isArray(activities) ? activities : []).filter((a) => {
      const id = String(a?.id || '');
      // Remove legacy seeded demo records while preserving user-created specials.
      if (a?.type === 'base') return false;
      if (/^sch\d+_d\d+$/i.test(id)) return false;
      if (/^special\d+_d\d+$/i.test(id)) return false;
      return true;
    });
    if (kept.length > 0) next[safeDay] = kept;
  }
  return next;
}

export const useScheduleStore = create(
  persist(
    (set, get) => ({
      schedule: {},
      selectedDay: 1,

      setDay: (day) => set({ selectedDay: day }),

      getActivitiesForDay: (day) => get().schedule[day] || [],

      addSpecialActivity: (day, activity) => {
        const id = `special_${Date.now()}`;
        const newActivity = { ...activity, id, day, type: 'special' };
        set(state => ({
          schedule: {
            ...state.schedule,
            [day]: [...(state.schedule[day] || []), newActivity]
          }
        }));
      },

      updateActivity: (day, id, updates) => {
        set(state => ({
          schedule: {
            ...state.schedule,
            [day]: state.schedule[day].map(a => a.id === id ? { ...a, ...updates } : a)
          }
        }));
      },

      deleteSpecialActivity: (day, id) => {
        set(state => ({
          schedule: {
            ...state.schedule,
            [day]: state.schedule[day].filter(a => a.id !== id || a.type === 'base')
          }
        }));
      },

      // Event plans keyed by activity id
      eventPlans: {},

      updateEventPlan: (activityId, plan) => {
        set(state => ({
          eventPlans: { ...state.eventPlans, [activityId]: plan }
        }));
      },
    }),
    {
      name: 'shivir-schedule',
      version: 4,
      migrate: (persistedState, version) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState;
        const next = { ...persistedState };
        // Strip legacy demo schedule entries during migration.
        next.schedule = sanitizeSchedule(next.schedule);
        return next;
      },
    }
  )
);
