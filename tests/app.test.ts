import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyForm, OTHER } from '../src/types.ts';
import type { FormState } from '../src/types.ts';
import { buildMessage, buildWhatsAppUrl } from '../src/utils/whatsapp.ts';
import { serialsIdentical, validateAll, validateStep } from '../src/utils/validation.ts';
import { normaliseSerial } from '../src/utils/serial.ts';
import { formatNominatim, mapsLink, stripCountry } from '../src/utils/address.ts';

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
    technician: 'Osama', comments: 'Installation completed successfully.',
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
  assert.match(m, /Technician:\nOsama/);
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

test('technician is required and must be one of the dropdown names', () => {
  assert.ok(validateStep('installation', { ...complete(), technician: '' }).technician);
  assert.ok(validateStep('installation', { ...complete(), technician: 'Owais' }).technician, 'old free-text names are rejected');
  for (const n of ['Osama', 'Waathiq', 'Donnovan', 'Bashir', 'Team Osama']) {
    assert.equal(validateStep('installation', { ...complete(), technician: n }).technician, undefined, n);
  }
});

test('address helpers: pin link, search link, Nominatim formatting', () => {
  assert.equal(mapsLink('x', { lat: -29.85, lng: 31.02 }), 'https://www.google.com/maps?q=-29.850000,31.020000');
  assert.equal(mapsLink(' 12 Main Rd, Durban ', null), 'https://www.google.com/maps/search/?api=1&query=12%20Main%20Rd%2C%20Durban');
  assert.equal(stripCountry('12 Main Rd, Durban, 4001, South Africa'), '12 Main Rd, Durban, 4001');
  assert.equal(
    formatNominatim({ address: { house_number: '12', road: 'Main Road', suburb: 'Umbilo', city: 'Durban', postcode: '4001', country: 'South Africa' } }),
    '12 Main Road, Umbilo, Durban, 4001',
  );
  assert.equal(formatNominatim({ display_name: 'Somewhere, South Africa' }), 'Somewhere');
});

test('message carries a Google Maps link for the address', () => {
  const pin = buildMessage({ ...complete(), location: { lat: -29.85, lng: 31.02 } });
  assert.match(pin, /Address:\n123 Example Street & Co\nMap: https:\/\/www\.google\.com\/maps\?q=-29\.850000,31\.020000/);
  assert.match(buildMessage(complete()), /Map: https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=123%20Example/);
});

test('address formatting skips municipal ward labels', () => {
  assert.equal(
    formatNominatim({ address: { house_number: '380', road: 'Doctor Pixley Kaseme Street', suburb: 'eThekwini Ward 28', city: 'Durban', postcode: '4001' } }),
    '380 Doctor Pixley Kaseme Street, Durban, 4001',
  );
  assert.equal(
    formatNominatim({ address: { road: 'Sambane Crescent', suburb: 'eThekwini Ward 45', town: 'KwaMashu', postcode: '4360' } }),
    'Sambane Crescent, KwaMashu, 4360',
  );
});
