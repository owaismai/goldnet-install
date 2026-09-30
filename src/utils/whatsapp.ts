// WhatsApp submission. There is NO backend in version 1: we only build a
// click-to-chat link (https://wa.me/<number>?text=<message>). The technician
// still has to press Send inside WhatsApp.
//
// Photos are NOT part of the message (no files/base64 in a URL). They only live
// on the phone during this form session. Permanent photo storage needs a
// backend/storage service in a future version.

import type { FormState } from '../types.ts';
import { choiceText } from '../types.ts';

const line = (label: string, value: string) => `${label}: ${value || '-'}`;

function last4(serial: string): string {
  return serial.trim().slice(-4);
}

export function buildMessage(f: FormState): string {
  const src = (s: string | null) => (s ? s.toUpperCase() : '-');
  const out: string[] = [
    'NEW GOLDNET INSTALLATION',
    '',
    'Customer:',
    f.fullName.trim(),
    'Contact:',
    f.phone.trim(),
    ...(f.email.trim() ? ['Email:', f.email.trim()] : []),
    ...(f.idNumber.trim() ? ['ID Number:', f.idNumber.trim()] : []),
    'Address:',
    f.streetAddress.trim(),
    '',
    line('Internet Service', choiceText(f.internetService)),
    line('Start Date', f.startDate),
    line('Installation fee', choiceText(f.installFee)),
    line('Router site', choiceText(f.routerSite)),
    line('Cash Collected', choiceText(f.cashCollected)),
    ...(f.cashReceipt.trim() ? [line('Cash Receipt Number', f.cashReceipt.trim())] : []),
    '',
    'CPE',
    line('Serial Number', f.cpeSerial.trim()),
    line('Serial Source', src(f.cpeSerialSource)),
    line('Last 4 digits', last4(f.cpeSerial)),
    line('Model', choiceText(f.cpeModel)),
    line('Photo', f.cpePhoto ? 'taken' : 'NOT taken'),
    '',
    'Router',
    line('Serial Number', f.routerSerial.trim()),
    line('Serial Source', src(f.routerSerialSource)),
    line('Last 4 digits', last4(f.routerSerial)),
    line('Model', choiceText(f.routerModel)),
    line('Photo', f.routerPhoto ? 'taken' : 'NOT taken'),
  ];

  if (f.cpeSerial.trim() && f.cpeSerial.trim() === f.routerSerial.trim()) {
    out.push('', 'WARNING: CPE and Router serial numbers are identical.');
  }

  if (f.cableFrom.trim() || f.cableTo.trim()) {
    out.push('', line('Cable used', `${f.cableFrom.trim() || '?'} to ${f.cableTo.trim() || '?'}`));
  }

  out.push(
    '',
    'Quality Checks:',
    line('Signal', f.signal.trim() ? `-${f.signal.trim()} dBm` : ''),
    line('Speedtest', f.speedtest.trim() ? `${f.speedtest.trim()} mbps` : ''),
    line('Client', f.clientType),
    line('Photos taken', choiceText(f.photosTaken)),
    ...(f.rating ? [line('Client Satisfaction', `${f.rating}/5`)] : []),
    '',
    'Technician:',
    f.technician.trim() || '-',
    'Installation Date:',
    f.startDate,
    'Notes:',
    f.comments.trim() || '-',
  );

  const more = choiceText(f.needMore);
  if (more) out.push('', `Stock needed: ${more}`);

  return out.join('\n');
}

/** wa.me link. `number` must be digits only (no "+"). */
export function buildWhatsAppUrl(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
