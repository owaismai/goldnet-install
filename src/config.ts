// Build-time configuration. Vite inlines VITE_* values into the public bundle,
// so NOTHING here is secret (the WhatsApp number is visible to anyone).

const raw = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) ?? '27689197093';

/** WhatsApp click-to-chat wants digits only: international format, no "+". */
export const WHATSAPP_NUMBER = raw.replace(/\D/g, '');

export const APP_NAME = 'GOLDNET Installation';
