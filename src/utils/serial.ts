// Kept apart from barcode.ts so the main bundle does not pull in the decoder.

/**
 * Serial = what the barcode decoded to (or what was typed), minus surrounding whitespace/control chars
 * and a printed "SN:" / "S/N" / "Serial No." prefix some labels encode in front of the serial itself.
 */
export function normaliseSerial(raw: string): string {
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return s.replace(/^(?:S\/?N|SERIAL(?:\s*(?:NO\.?|NUMBER))?)\s*[:#.]?\s+|^(?:S\/?N|SERIAL(?:\s*(?:NO\.?|NUMBER))?)\s*[:#]\s*/i, '').trim();
}

export interface SerialRule {
  min: number;
  max: number;
}

/** The team bot (team_bot/install.py SERIAL_RE) only accepts a CPE serial of 8-20 letters/digits. */
export const CPE_SERIAL: SerialRule = { min: 8, max: 20 };
/** Router serials (Cudy 14, MikroTik 12, ...): a little wider. */
export const ROUTER_SERIAL: SerialRule = { min: 6, max: 32 };

/**
 * Why `serial` cannot be an equipment serial number, or null when it looks right. Labels carry other codes
 * too (a QR code with the setup URL, a Wi-Fi QR code, a MAC address): the scanner reads those just as happily,
 * so every value, scanned or typed, goes through this. Empty is left to the "required" check.
 */
export function serialProblem(serial: string, rule: SerialRule = ROUTER_SERIAL): string | null {
  const s = normaliseSerial(serial);
  if (!s) return null;
  if (/^(?:https?:|www\.|mailto:|tel:)/i.test(s) || s.includes('://')) {
    return 'That code is a web link, not the serial number. Scan the serial-number barcode on the label (or enter the serial manually).';
  }
  if (/^WIFI:/i.test(s)) return 'That is the Wi-Fi QR code, not the serial number. Scan the serial-number barcode on the label.';
  if (!/^[A-Za-z0-9]+$/.test(s)) return 'A serial number has letters and digits only (no spaces, colons or symbols). Check the label and scan or type it again.';
  if (s.length < rule.min || s.length > rule.max) {
    return `A serial number here is ${rule.min}-${rule.max} letters and digits (this one is ${s.length}). Check the label and scan or type it again.`;
  }
  return null;
}
