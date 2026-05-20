// Helpers for sending login PINs to teachers / mentors via WhatsApp.
//
// The admin clicks a "Send PIN" button next to a volunteer; we build a
// pre-filled wa.me link that opens WhatsApp Web / mobile app with the
// volunteer's number and a friendly message containing the role-specific
// login link and their PIN.

// Public site URL. Override at build time with VITE_APP_URL if the app
// ever moves to a different host.
const APP_URL = (import.meta.env.VITE_APP_URL || 'https://shivir.vercel.app').replace(/\/+$/, '');

// Default country code used when a mobile number is given without one.
// India by default; adjust if/when the camp expands beyond IN numbers.
const DEFAULT_COUNTRY_CODE = '91';

// Normalize a free-form mobile string into the digits-only, country-coded
// format that wa.me expects (no leading +, no spaces, no dashes).
//
// Examples:
//   "+91 98765 43210"  -> "919876543210"
//   "098765-43210"     -> "919876543210"
//   "9876543210"       -> "919876543210"
//   "919876543210"     -> "919876543210"
//   ""                 -> ""
export function normalizePhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D+/g, '');
  if (!digits) return '';

  // Already includes the IN country code.
  if (digits.length === 12 && digits.startsWith(DEFAULT_COUNTRY_CODE)) return digits;

  // Local format with leading 0 (e.g. "098765...").
  if (digits.length === 11 && digits.startsWith('0')) return DEFAULT_COUNTRY_CODE + digits.slice(1);

  // Bare 10-digit Indian mobile.
  if (digits.length === 10) return DEFAULT_COUNTRY_CODE + digits;

  // Anything else (international numbers, short codes, etc.) is left as-is
  // and we trust the admin entered it correctly.
  return digits;
}

// Determine which dashboard / login flow a volunteer should be pointed at,
// based on the roles array stored on the volunteer record.
export function getLoginTarget(volunteer) {
  const roles = volunteer?.roles || (volunteer?.role ? [volunteer.role] : []);
  const has = (r) => roles.includes(r);

  if (has('Class Teacher') || has('Teacher')) {
    return { key: 'teacher',     label: 'Teacher',     path: '/teacher',     loginRole: 'teacher' };
  }
  if (has('Activity Coordinator')) {
    return { key: 'coordinator', label: 'Coordinator', path: '/coordinator', loginRole: 'coordinator' };
  }
  if (has('Collection Mentor') || has('Collection Volunteer')) {
    return { key: 'collection',  label: 'Collection',  path: '/collection',  loginRole: 'collection' };
  }
  // Zone Mentor and any other mentor-style role.
  return { key: 'mentor', label: 'Mentor', path: '/mentor/actions', loginRole: 'mentor' };
}

// Build the WhatsApp message body. Kept short and friendly so it fits in a
// WhatsApp preview, with bold markers (*…*) WhatsApp renders natively.
export function buildPinMessage(volunteer) {
  const { label, loginRole } = getLoginTarget(volunteer);
  const name = (volunteer?.name || '').trim() || 'ji';
  const pin  = String(volunteer?.pin || '').trim();
  // Always send people to login first so they never land directly on a
  // protected dashboard due to an already-active browser session.
  const link = `${APP_URL}/login?role=${encodeURIComponent(loginRole)}`;

  return [
    '🪷 *Bal Sanskar Shivir 2026*',
    '',
    `Namaste ${name} 🙏`,
    '',
    `You have been registered as our *${label}*.`,
    '',
    `🔗 Login: ${link}`,
    `🔑 Your PIN: *${pin}*`,
    '',
    `Open the link, choose "${label}", and enter your 4-digit PIN to log in.`,
    '',
    '— Shivir Team',
  ].join('\n');
}

// Build the wa.me URL that, when opened, launches WhatsApp with the
// volunteer's number and the PIN message pre-filled. Returns null if
// the volunteer has no usable mobile or no PIN to send.
export function buildWhatsAppLink(volunteer) {
  const phone = normalizePhone(volunteer?.mobile);
  const pin   = String(volunteer?.pin || '').trim();
  if (!phone || !pin) return null;

  const text = encodeURIComponent(buildPinMessage(volunteer));
  return `https://wa.me/${phone}?text=${text}`;
}

// Convenience: open the WhatsApp link in a new tab. Returns true on
// success, false if the volunteer is missing a mobile or PIN.
export function openWhatsAppPin(volunteer) {
  const url = buildWhatsAppLink(volunteer);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
