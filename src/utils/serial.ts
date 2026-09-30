// Kept apart from barcode.ts so the main bundle does not pull in zxing.
/** Serial = exactly what the barcode decoded to, minus surrounding whitespace/control chars. */
export function normaliseSerial(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f]/g, '').trim();
}

