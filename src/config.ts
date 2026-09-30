// Build-time configuration. Vite inlines VITE_* values into the public bundle,
// so NOTHING here is secret (the WhatsApp number is visible to anyone).

const raw = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) ?? '27689197093';

/** WhatsApp click-to-chat wants digits only: international format, no "+". */
export const WHATSAPP_NUMBER = raw.replace(/\D/g, '');

/**
 * Google Maps key for address search (Maps JavaScript API + Places API (New)). Public by design:
 * restrict it to this site's address and to those two APIs in Google Cloud. Empty = address search off
 * (the "Use my current location" button still works).
 */
export const GOOGLE_MAPS_API_KEY = ((import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? '').trim();

export const APP_NAME = 'GOLDNET Installation';
