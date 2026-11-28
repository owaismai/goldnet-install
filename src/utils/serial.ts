// Kept apart from barcode.ts so the main bundle does not pull in zxing.

/**
 * Some labels carry a QR code that holds a link, not the bare serial. Ruijie/Reyee radios:
 * `http://rj.link/e?s=G1TD4VE00986C&d=RG-AIRMETRO460F&m=C0A476CEB195` (s = serial, d = model, m = MAC).
 * When the decoded text is such a link, the serial is the `s` / `sn` / `serial` parameter.
 */
function serialFromLink(text: string): string | null {
  if (!/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}\/\S*\?\S*=/i.test(text)) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `http://${text}`);
  } catch {
    return null;
  }
  const q = new Map<string, string>();
  url.searchParams.forEach((v, k) => q.set(k.toLowerCase(), v.trim()));
  for (const key of ['s', 'sn', 'serial', 'serialnumber', 'serial_number']) {
    const v = q.get(key);
    if (v) return v;
  }
  return null;
}

/** A printed "SN:" / "S/N" / "Serial No." prefix some labels encode in front of the serial itself. */
const SERIAL_PREFIX = /^(?:S\/?N|SERIAL(?:\s*(?:NO\.?|NUMBER))?)\s*[:#.]?\s+|^(?:S\/?N|SERIAL(?:\s*(?:NO\.?|NUMBER))?)\s*[:#]\s*/i;

/**
 * Serial = what the barcode decoded to, minus surrounding whitespace/control chars; a QR link gives its serial
 * parameter; a printed "SN:" / "S/N" / "Serial No." prefix is dropped (a serial that merely starts with SN is kept).
 */
export function normaliseSerial(raw: string): string {
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return serialFromLink(text) ?? text.replace(SERIAL_PREFIX, '').trim();
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
 * so every value, scanned or typed, goes through this. A QR link that carries the serial (rj.link ?s=) is
 * turned into the serial first by normaliseSerial. Empty is left to the "required" check.
 */
export function serialProblem(serial: string, rule: SerialRule = ROUTER_SERIAL): string | null {
  const s = normaliseSerial(serial);
  if (!s) return null;
  if (/^(?:https?:|www\.|mailto:|tel:)/i.test(s) || s.includes('://') || /^[a-z0-9.-]+\.[a-z]{2,}\//i.test(s)) {
    return 'That code is a web link, not the serial number. Scan the serial-number barcode on the label (or enter the serial manually).';
  }
  if (/^WIFI:/i.test(s)) return 'That is the Wi-Fi QR code, not the serial number. Scan the serial-number barcode on the label.';
  if (!/^[A-Za-z0-9]+$/.test(s)) {
    return 'A serial number has letters and digits only (no spaces, colons or symbols). Check the label and scan or type it again.';
  }
  if (s.length < rule.min || s.length > rule.max) {
    return `A serial number here is ${rule.min}-${rule.max} letters and digits (this one is ${s.length}). Check the label and scan or type it again.`;
  }
  return null;
}
