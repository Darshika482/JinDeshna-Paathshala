// Map each class code to its teacher's name.
// Update this with your actual teacher names, or load dynamically from the DB.
// Format: { 'CLASS_CODE': { en: 'English Name', hi: 'हिंदी नाम' } }

export const CLASS_TEACHER_NAMES = {
  '1A': { en: 'Teacher 1A', hi: 'शिक्षक 1A' },
  '1B': { en: 'Teacher 1B', hi: 'शिक्षक 1B' },
  '1C': { en: 'Teacher 1C', hi: 'शिक्षक 1C' },
  '1D': { en: 'Teacher 1D', hi: 'शिक्षक 1D' },
  '2A': { en: 'Teacher 2A', hi: 'शिक्षक 2A' },
  '2B': { en: 'Teacher 2B', hi: 'शिक्षक 2B' },
  '3A': { en: 'Teacher 3A', hi: 'शिक्षक 3A' },
  '3B': { en: 'Teacher 3B', hi: 'शिक्षक 3B' },
};

export function getTeacherNameForClass(classCode, isHindi = false) {
  const key = String(classCode || '').trim();
  if (!key) return '';
  const entry = CLASS_TEACHER_NAMES[key];
  if (!entry) return '';
  return isHindi ? entry.hi : entry.en;
}
