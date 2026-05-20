// Shared formatting helpers used across admin and other pages.

// Normalizes corrupted / fancy dash characters in age-group strings like
// `11–15 yrs` (en-dash) or `11�15 yrs` (replacement char from a broken
// Windows-1252 -> UTF-8 CSV round-trip) into clean ASCII hyphens.
export function normalizeAgeGroup(value) {
  if (!value) return '';
  return String(value)
    .replace(/[\u2010-\u2015\uFFFD]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
