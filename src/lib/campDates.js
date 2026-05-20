// Configure camp dates in .env (VITE_CAMP_START_DATE, VITE_CAMP_END_DATE, VITE_CAMP_TOTAL_DAYS)
// or via the setup wizard (stored in localStorage under shiviros-config).

function readStoredDates() {
  try {
    const raw = localStorage.getItem('shiviros-config');
    if (!raw) return {};
    return JSON.parse(raw)?.state || {};
  } catch { return {}; }
}

const _stored = readStoredDates();
export const CAMP_START_DATE = _stored.campStartDate || import.meta.env.VITE_CAMP_START_DATE || '2026-05-03';
export const CAMP_END_DATE   = _stored.campEndDate   || import.meta.env.VITE_CAMP_END_DATE   || '2026-05-09';
export const CAMP_TOTAL_DAYS = Number(_stored.campTotalDays) || Number(import.meta.env.VITE_CAMP_TOTAL_DAYS) || 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getCampDayForDate(date = new Date()) {
  const start = startOfLocalDay(CAMP_START_DATE);
  const today = startOfLocalDay(date);
  const diff = Math.floor((today.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  if (Number.isNaN(diff)) return 1;
  // Clamp so before/after the camp we still report a valid day number.
  return Math.min(Math.max(diff, 1), CAMP_TOTAL_DAYS);
}

export function isCampActive(date = new Date()) {
  const today = startOfLocalDay(date).getTime();
  const start = startOfLocalDay(CAMP_START_DATE).getTime();
  const end   = startOfLocalDay(CAMP_END_DATE).getTime();
  return today >= start && today <= end;
}

export function getDateForCampDay(day) {
  const start = startOfLocalDay(CAMP_START_DATE);
  const dayIndex = Number(day) - 1;
  if (!Number.isFinite(dayIndex)) return CAMP_START_DATE;
  const d = new Date(start.getTime() + (dayIndex * MS_PER_DAY));
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
