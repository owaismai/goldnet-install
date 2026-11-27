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

/** Serial = what the barcode decoded to, minus surrounding whitespace/control chars; a QR link gives its serial parameter. */
export function normaliseSerial(raw: string): string {
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return serialFromLink(text) ?? text;
}
