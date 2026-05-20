import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase.js';

function getAdminPassword() {
  try {
    const raw = localStorage.getItem('shiviros-config');
    const stored = raw ? JSON.parse(raw)?.state : null;
    return stored?.adminPassword || import.meta.env.VITE_ADMIN_PASSWORD || 'darshika';
  } catch { return import.meta.env.VITE_ADMIN_PASSWORD || 'darshika'; }
}

function getCoinkeeperPin() {
  try {
    const raw = localStorage.getItem('shiviros-config');
    const stored = raw ? JSON.parse(raw)?.state : null;
    return stored?.coinkeeperPin || import.meta.env.VITE_COINKEEPER_PIN || null;
  } catch { return import.meta.env.VITE_COINKEEPER_PIN || null; }
}

/** @returns {string[]} */
function normalizeRolesArray(volunteer) {
  let raw = volunteer?.roles;
  if (raw == null && volunteer?.role != null) raw = [volunteer.role];
  if (!Array.isArray(raw)) {
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (s.startsWith('[')) {
        try {
          const parsed = JSON.parse(s);
          raw = Array.isArray(parsed) ? parsed : [];
        } catch {
          raw = [];
        }
      } else {
        raw = s.split(/[,;]/).map(x => x.trim()).filter(Boolean);
      }
    } else {
      raw = [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(r => String(r || '').trim()).filter(Boolean))];
}

/** True if any role matches one of the canonical labels (case-insensitive). */
function roleMatchesAny(roles, labels) {
  const lower = new Set(roles.map(r => r.toLowerCase()));
  return labels.some(l => lower.has(l.toLowerCase()));
}

function normalizeAssignedClasses(volunteer) {
  const raw = Array.isArray(volunteer?.assigned_classes)
    ? volunteer.assigned_classes
    : [];
  const cleaned = [...new Set(raw.map(v => String(v || '').trim()).filter(Boolean))];
  if (cleaned.length) return cleaned;

  // Backward compatibility: older data had a single assigned_class field.
  const single = String(volunteer?.assigned_class || '').trim();
  // Old "1/2/3" session slots are not classroom codes; ignore those.
  if (!single || ['1', '2', '3'].includes(single)) return [];
  return [single];
}

// Per-session class map: { "1": "BA1", "2": "BB1", "3": "BA2" }.
// Accepts a JSON string (Supabase jsonb arrives as object, but be defensive),
// an object, or a missing value. Always returns a plain object with string keys.
function normalizeSessionClasses(volunteer, fallbackClasses) {
  let raw = volunteer?.session_classes;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { raw = null; }
  }
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      const code = String(v || '').trim();
      if (code) out[String(k)] = code;
    }
  }
  // Fallback: if no per-session map, repeat the primary class for all sessions.
  if (!Object.keys(out).length && fallbackClasses?.length) {
    out['1'] = fallbackClasses[0];
    out['2'] = fallbackClasses[0];
    out['3'] = fallbackClasses[0];
  }
  return out;
}

/**
 * Mentor / volunteer PIN flow: zone mentors always allowed (even with collection, coordinator, etc.).
 * Legacy rows without "Zone Mentor" still work if they have at least one role and no exclusive other-portal role only.
 */
function canUseMentorPortal(roles) {
  if (roleMatchesAny(roles, ['Zone Mentor'])) return true;
  const hasExclusiveOtherPortal = roleMatchesAny(roles, [
    'Activity Coordinator',
    'Teacher',
    'Class Teacher',
    'Collection Mentor',
    'Collection Volunteer',
    'Collection Station',
    'Admin',
  ]);
  if (hasExclusiveOtherPortal) return false;
  return roles.length > 0;
}

function canUsePortal(roles, portalKey) {
  if (roleMatchesAny(roles, ['Admin'])) return true;
  switch (portalKey) {
    case 'mentor':
      return canUseMentorPortal(roles);
    case 'collection':
      return roleMatchesAny(roles, [
        'Collection Mentor',
        'Collection Volunteer',
        'Collection Station',
      ]);
    case 'coordinator':
      return roleMatchesAny(roles, ['Activity Coordinator']);
    case 'teacher':
      return roleMatchesAny(roles, ['Teacher', 'Class Teacher']);
    default:
      return false;
  }
}

function sessionRoleForPortal(portalKey) {
  switch (portalKey) {
    case 'mentor':
      return 'volunteer';
    case 'collection':
      return 'collection';
    case 'coordinator':
      return 'coordinator';
    case 'teacher':
      return 'teacher';
    default:
      return 'volunteer';
  }
}

function normalizePinLoose(pin) {
  const digits = String(pin ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const n = Number(digits);
  return Number.isFinite(n) ? String(n) : digits;
}

export const useAuthStore = create(
  persist(
    (set) => ({
      currentUser: null,
      role: null,
      _hasHydrated: false,

      setHasHydrated: (val) => set({ _hasHydrated: val }),

      /**
       * @param {string} pin
       * @param {'mentor'|'teacher'|'coordinator'|'collection'} portalKey — login tile chosen on the home screen.
       *        When someone has several assignments, session role must match that tile, not a global priority.
       */
      loginVolunteer: async (pin, portalKey) => {
        const pinNorm = String(pin ?? '').trim();
        let volunteer = null;
        try {
          const { data, error } = await supabase
            .from('volunteers')
            .select('*')
            .eq('pin', pinNorm)
            .limit(1);
          const row = Array.isArray(data) && data.length ? data[0] : null;
          volunteer = (!error && row) ? row : null;

          if (!volunteer) {
            // Some datasets accidentally lost PIN leading zeros (e.g., "0010" stored as "10").
            // Do a bounded scan and compare normalized digit forms.
            const loosePin = normalizePinLoose(pinNorm);
            if (loosePin) {
              const scan = await supabase
                .from('volunteers')
                .select('*')
                .limit(1500);
              if (!scan.error && Array.isArray(scan.data)) {
                volunteer = scan.data.find(v => normalizePinLoose(v?.pin) === loosePin) || null;
              }
            }
          }
        } catch { }
        if (!volunteer) return { success: false, error: 'Wrong PIN. Please try again.' };

        const roles = normalizeRolesArray(volunteer);
        const assigned_classes = normalizeAssignedClasses(volunteer);
        const session_classes = normalizeSessionClasses(volunteer, assigned_classes);

        if (!portalKey || !canUsePortal(roles, portalKey)) {
          return {
            success: false,
            error:
              'This PIN does not match this login option, or your profile is not assigned to it. Pick Mentor, Collection, Coordinator, or Teacher according to your duty, or ask the admin to check your roles.',
          };
        }

        const role = roleMatchesAny(roles, ['Admin']) ? 'admin' : sessionRoleForPortal(portalKey);

        set({
          currentUser: {
            ...volunteer,
            roles,
            assigned_classes,
            assigned_class: volunteer.assigned_class || assigned_classes[0] || '',
            session_classes,
          },
          role,
        });
        return { success: true };
      },

      loginAdmin: (password) => {
        if (password !== getAdminPassword()) return { success: false, error: 'Wrong password.' };
        set({ currentUser: { id: 'admin', name: 'Camp Admin', role: 'Admin' }, role: 'admin' });
        return { success: true };
      },

      loginCoinkeeper: (pin) => {
        const expected = getCoinkeeperPin();
        if (!expected) return { success: false, error: 'Coinkeeper PIN not configured. Ask the admin to set it in Admin → Settings.' };
        if (pin !== expected) return { success: false, error: 'Wrong PIN.' };
        set({ currentUser: { id: 'keeper', name: 'Coin Keeper', role: 'Keeper' }, role: 'coinkeeper' });
        return { success: true };
      },

      logout: () => set({ currentUser: null, role: null }),

      refreshCurrentUser: async () => {
        const state = useAuthStore.getState();
        const current = state.currentUser;
        if (!current?.id || current.id === 'admin' || current.id === 'keeper') return { success: false };

        try {
          const { data, error } = await supabase
            .from('volunteers')
            .select('*')
            .eq('id', current.id)
            .single();

          if (error || !data) return { success: false };

          const roles = normalizeRolesArray(data);
          const assigned_classes = normalizeAssignedClasses(data);
          const session_classes = normalizeSessionClasses(data, assigned_classes);

          set({
            currentUser: {
              ...data,
              roles,
              assigned_classes,
              assigned_class: data.assigned_class || assigned_classes[0] || '',
              session_classes,
            },
          });
          return { success: true };
        } catch {
          return { success: false };
        }
      },
    }),
    {
      name: 'shivir-auth',
      // Never persist the hydration flag itself — it must always start false.
      partialize: (state) => ({ currentUser: state.currentUser, role: state.role }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
