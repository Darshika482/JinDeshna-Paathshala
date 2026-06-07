// Configure camp dates in .env (VITE_CAMP_START_DATE, VITE_CAMP_END_DATE, VITE_CAMP_TOTAL_DAYS)
// or via Admin Settings / setup wizard (stored in localStorage under shiviros-config).

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseLocalDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date(NaN);
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

function startOfLocalDay(date) {
  const d = date instanceof Date ? new Date(date) : parseLocalDate(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function deriveTotalDays(startDate, endDate, fallback = 7) {
  const start = startOfLocalDay(startDate);
  const end = startOfLocalDay(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return fallback;
  }
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1);
}

function readCampConfig() {
  try {
    const raw = localStorage.getItem('shiviros-config');
    const state = raw ? JSON.parse(raw)?.state || {} : {};
    const campStartDate = state.campStartDate || import.meta.env.VITE_CAMP_START_DATE || '2026-05-03';
    const campEndDate = state.campEndDate || import.meta.env.VITE_CAMP_END_DATE || '2026-05-09';
    const storedTotal = Number(state.campTotalDays) || Number(import.meta.env.VITE_CAMP_TOTAL_DAYS) || 0;
    const campTotalDays = deriveTotalDays(
      campStartDate,
      campEndDate,
      storedTotal || 7
    );
    return { campStartDate, campEndDate, campTotalDays };
  } catch {
    const campStartDate = import.meta.env.VITE_CAMP_START_DATE || '2026-05-03';
    const campEndDate = import.meta.env.VITE_CAMP_END_DATE || '2026-05-09';
    return {
      campStartDate,
      campEndDate,
      campTotalDays: deriveTotalDays(campStartDate, campEndDate, Number(import.meta.env.VITE_CAMP_TOTAL_DAYS) || 7),
    };
  }
}

export function getCampStartDate() {
  return readCampConfig().campStartDate;
}

export function getCampEndDate() {
  return readCampConfig().campEndDate;
}

export function getCampTotalDays() {
  return readCampConfig().campTotalDays;
}

/** @deprecated Use getCampStartDate() — kept for older imports */
export const CAMP_START_DATE = getCampStartDate();
/** @deprecated Use getCampEndDate() */
export const CAMP_END_DATE = getCampEndDate();
/** @deprecated Use getCampTotalDays() */
export const CAMP_TOTAL_DAYS = getCampTotalDays();

export function getCampDayForDate(date = new Date()) {
  const { campTotalDays } = readCampConfig();
  const start = startOfLocalDay(getCampStartDate());
  const today = startOfLocalDay(date);
  const diff = Math.floor((today.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  if (Number.isNaN(diff)) return 1;
  if (diff < 1) return 1;
  return Math.min(diff, campTotalDays);
}

export function isCampActive(date = new Date()) {
  const today = startOfLocalDay(date).getTime();
  const start = startOfLocalDay(getCampStartDate()).getTime();
  const end = startOfLocalDay(getCampEndDate()).getTime();
  return today >= start && today <= end;
}

export function getDateForCampDay(day) {
  const start = startOfLocalDay(getCampStartDate());
  const dayIndex = Number(day) - 1;
  if (!Number.isFinite(dayIndex)) return getCampStartDate();
  const d = new Date(start.getTime() + (dayIndex * MS_PER_DAY));
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toIsoLocal(date) {
  const d = startOfLocalDay(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Calendar date for attendance today — always reports TODAY's real date.
 * `day` is the camp day number only when today actually falls inside the
 * camp window; otherwise it's null so the UI can show "no camp day".
 */
export function getAttendanceDateForToday(date = new Date()) {
  const active = isCampActive(date);
  return {
    iso: toIsoLocal(date),
    day: active ? getCampDayForDate(date) : null,
    active,
  };
}

export function onCampConfigUpdated(callback) {
  const handler = () => callback();
  window.addEventListener('camp-config-updated', handler);
  return () => window.removeEventListener('camp-config-updated', handler);
}

export function notifyCampConfigUpdated() {
  window.dispatchEvent(new Event('camp-config-updated'));
}
