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

/**
 * GOLDNET ISP Manager: SUBMIT sends the form and photos here (utils/panel.ts). Public by design; the installer's own
 * form key (from their link) is what lets a form in.
 */
export const PANEL_URL = ((import.meta.env.VITE_PANEL_URL as string | undefined) ?? 'https://isp.vcom.co.za').trim();

export const APP_NAME = 'GOLDNET Installation';
