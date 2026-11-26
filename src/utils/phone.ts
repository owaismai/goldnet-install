// South African cell numbers for the customer's Contact field (owner, 26 Nov 2026: "make the cell number required on the
// form and it must be the correct amount of digits (have it automatically format no matter the way it's typed, like
// 0681746016 or +27681746016 or 068 174 6016 or 27681746016)"). The bot sends the customer's welcome WhatsApp to it.

/** The digits as a local number: +27 / 27 / 0027 become a leading 0, and a number typed without its 0 gets one. */
function localDigits(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('0027')) d = '0' + d.slice(4);
  else if (d.startsWith('27') && d.length > 9) d = '0' + d.slice(2);
  else if (/^[6-8]/.test(d) && d.length === 9) d = '0' + d;
  return d;
}

/** "0681746016" from any way of typing it, or null when it isn't a complete SA cell number (06x, 07x, 08x + 7 digits). */
export function normalizeCell(raw: string): string | null {
  const d = localDigits(raw);
  return /^0[6-8]\d{8}$/.test(d) ? d : null;
}

/** "068 174 6016": how a complete number is shown in the field. */
export function prettyCell(cell: string): string {
  return `${cell.slice(0, 3)} ${cell.slice(3, 6)} ${cell.slice(6)}`;
}

/** What the field keeps while typing: a complete number is tidied at once, anything else is left as typed. */
export function tidyCell(raw: string): string {
  const cell = normalizeCell(raw);
  return cell ? prettyCell(cell) : raw;
}

/** The error to show, or null when the number is a valid cell. */
export function cellError(raw: string): string | null {
  if (!raw.trim()) return 'The customer\'s cell number is required';
  if (normalizeCell(raw)) return null;
  const d = localDigits(raw);
  if (d.length && !/^0[6-8]/.test(d)) return 'Use a cell number (starts with 06, 07 or 08)';
  return `${d.length} digits: a cell number has 10 (e.g. 068 174 6016)`;
}
