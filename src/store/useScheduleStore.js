import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mockSchedule } from '../data/mockSchedule.js';

export const useScheduleStore = create(
  persist(
    (set, get) => ({
      schedule: mockSchedule,
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
      version: 3,
      migrate: (persistedState, version) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState;
        if (version >= 3) return persistedState;
        const next = { ...persistedState };
        // Re-seed if the stored schedule is empty (e.g. was wiped by a previous migration)
        if (!next.schedule || Object.keys(next.schedule).length === 0) {
          next.schedule = mockSchedule;
        }
        return next;
      },
    }
  )
);
