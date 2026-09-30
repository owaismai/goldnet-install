import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyForm, OTHER } from '../src/types.ts';
import type { FormState } from '../src/types.ts';
import { buildMessage, buildWhatsAppUrl } from '../src/utils/whatsapp.ts';
import { serialsIdentical, validateAll, validateStep } from '../src/utils/validation.ts';
import { normaliseSerial } from '../src/utils/serial.ts';

function complete(): FormState {
  return {
    ...emptyForm(),
    fullName: 'John Smith', phone: '0821234567', streetAddress: '123 Example Street & Co',
    cpeModel: { selected: ['Reyee 460G'], other: '' },
    routerModel: { selected: ['M1300 AC'], other: '' },
    internetService: { selected: ['20mbps - R350pm'], other: '' },
    installFee: { selected: ['R250'], other: '' },
    routerSite: { selected: ['Sidwell'], other: '' },
    cashCollected: { selected: [OTHER], other: 'Paid by EFT' },
    cpeSerial: '4859301847291', cpeSerialSource: 'barcode', cpePhoto: true,
    routerSerial: 'ABC123456789', routerSerialSource: 'barcode', routerPhoto: true,
    signal: '62', speedtest: '48', clientType: 'New',
    photosTaken: { selected: ['CPE'], other: '' },
    wifiName: 'Smith-Home', wifiPassword: 'P@ss w0rd&1',
    technician: 'Owais', comments: 'Installation completed successfully.',
  };
}

test('complete form passes validation', () => {
  assert.deepEqual(validateAll(complete()), {});
});

test('empty form reports every required step', () => {
  const v = validateAll(emptyForm());
  assert.deepEqual(Object.keys(v), ['customer', 'installation', 'cpe', 'router', 'additional']);
});

test('CPE step blocks without serial or photo', () => {
  const f = { ...complete(), cpeSerial: '', cpePhoto: false };
  const e = validateStep('cpe', f);
  assert.ok(e.cpeSerial && e.cpePhoto);
  assert.deepEqual(validateStep('cpe', { ...complete(), cpePhoto: false }), { cpePhoto: 'Take and confirm the CPE photo' });
});

test('router step blocks without photo', () => {
  assert.ok(validateStep('router', { ...complete(), routerPhoto: false }).routerPhoto);
});

test('"Other" needs text', () => {
  const f = { ...complete(), cpeModel: { selected: [OTHER], other: ' ' } };
  assert.ok(validateStep('installation', f).cpeModel);
});

test('duplicate serial detection (does not block submit)', () => {
  const f = { ...complete(), routerSerial: '4859301847291' };
  assert.equal(serialsIdentical(f), true);
  assert.deepEqual(validateAll(f), {});
  assert.match(buildMessage(f), /serial numbers are identical/);
});

test('message contains serials, sources and notes', () => {
  const m = buildMessage(complete());
  assert.match(m, /^NEW GOLDNET INSTALLATION\n\nCustomer:\nJohn Smith\nContact:\n0821234567/);
  assert.match(m, /CPE\nSerial Number: 4859301847291\nSerial Source: BARCODE/);
  assert.match(m, /Router\nSerial Number: ABC123456789\nSerial Source: BARCODE/);
  assert.match(m, /Model: Reyee 460G/);
  assert.match(m, /Cash Collected: Paid by EFT/);
  assert.match(m, /Signal: -62 dBm/);
  assert.match(m, /Customer Wi-Fi:\nWi-Fi Name: Smith-Home\nWi-Fi Password: P@ss w0rd&1/);
  assert.match(m, /Technician:\nOwais/);
  assert.match(m, /Notes:\nInstallation completed successfully\./);
});

test('WhatsApp URL: recipient 27689197093, correctly encoded, round-trips', () => {
  const msg = buildMessage(complete());
  const url = buildWhatsAppUrl('27689197093', msg);
  assert.ok(url.startsWith('https://wa.me/27689197093?text='));
  assert.ok(!url.includes('+27689197093'));
  const text = url.slice(url.indexOf('?text=') + 6);
  assert.ok(!/[\s&#]/.test(text), 'no raw space, & or # in the query');
  assert.ok(text.includes('%0A'), 'newlines encoded');
  assert.ok(text.includes('%26'), '& encoded');
  assert.equal(new URL(url).searchParams.get('text'), msg);
});

test('normaliseSerial strips whitespace and control chars only', () => {
  assert.equal(normaliseSerial('  G1UH44N009260\r\n'), 'G1UH44N009260');
});
