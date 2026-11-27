import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PACKAGE, defaultServiceFor, emptyForm, OTHER, packagesFor } from '../src/types.ts';
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
    internetService: { selected: [DEFAULT_PACKAGE], other: '' },
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

test('normaliseSerial takes the serial out of a Ruijie/Reyee QR link', () => {
  assert.equal(normaliseSerial('http://rj.link/e?s=G1TD4VE00986C&d=RG-AirMetro460F&m=C0A476CEB195'), 'G1TD4VE00986C');
  assert.equal(normaliseSerial('HTTP://RJ.LINK/E?S=G1TD4VE00986C&D=RG-AIRMETRO460F&M=C0A476CEB195\n'), 'G1TD4VE00986C');
  assert.equal(normaliseSerial('rj.link/e?s=G1TD4VE00986C'), 'G1TD4VE00986C');
  assert.equal(normaliseSerial('https://example.com/x?sn=ABC123'), 'ABC123');
  assert.equal(normaliseSerial('https://example.com/page?id=7'), 'https://example.com/page?id=7');
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

test('20mbps R350 is the default plan for Osama\'s installers, nothing is pre-selected for Waathiq / Donnovan', () => {
  for (const t of ['Osama', 'Team Osama', 'Bashir']) assert.deepEqual(emptyForm(t).internetService.selected, ['20mbps NB Promo - R350pm'], t);
  for (const t of ['Waathiq', 'Donnovan', '']) assert.deepEqual(defaultServiceFor(t).selected, [], t);
  assert.deepEqual(emptyForm('Waathiq').internetService.selected, []);
});

test('plans follow the installer; the apartment plan is gone', () => {
  const osama = packagesFor('Team Osama');
  const waathiq = packagesFor('Waathiq');
  assert.deepEqual(packagesFor('Osama'), osama);
  assert.deepEqual(packagesFor('Bashir'), osama);
  assert.deepEqual(packagesFor('Donnovan'), waathiq, 'Donnovan uses the same tariffs as Waathiq');
  assert.deepEqual(osama, ['20mbps NB Promo - R350pm', '50mbps Premium (Gold SLA) - R499pm', '100mbps Premium Business (Platinum SLA) - R2799pm']);
  assert.deepEqual(waathiq, ['15mbps - R350pm', '25mbps Premium (Gold SLA) - R399pm', '50mbps Premium (Gold SLA) - R499pm', '100mbps Premium Business (Platinum SLA) - R2799pm']);
  assert.ok(!waathiq.includes(DEFAULT_PACKAGE), 'Waathiq does not see 20mbps NB Promo');
  assert.ok(!osama.includes('15mbps - R350pm') && !osama.some((p) => p.startsWith('25mbps')), 'Waathiq-only plans are hidden from Osama');
  assert.deepEqual(packagesFor(''), []);
  for (const p of [...osama, ...waathiq]) assert.ok(!/apartment/i.test(p), p);
});

test('a plan the installer is not offered is rejected', () => {
  const f = { ...complete(), technician: 'Osama', internetService: { selected: ['25mbps Premium (Gold SLA) - R399pm'], other: '' } };
  assert.ok(validateStep('installation', f).internetService);
  assert.equal(validateStep('installation', { ...f, technician: 'Waathiq' }).internetService, undefined);
  const nb = { ...f, internetService: { selected: [DEFAULT_PACKAGE], other: '' } };
  assert.equal(validateStep('installation', nb).internetService, undefined);
  assert.ok(validateStep('installation', { ...nb, technician: 'Waathiq' }).internetService, 'a 20mbps NB draft is rejected once the installer is Waathiq');
});

test('Wi-Fi name and password are required (the customer gets them in the welcome WhatsApp)', () => {
  const e = validateStep('additional', { ...complete(), wifiName: ' ', wifiPassword: '' });
  assert.ok(e.wifiName && e.wifiPassword);
  assert.equal(validateStep('additional', { ...complete(), wifiPassword: 'short' }).wifiPassword, 'At least 8 characters');
  assert.deepEqual(validateStep('additional', complete()), {});
});

test('customer cell number: any way it is typed becomes 0XXXXXXXXX, wrong lengths are refused', async () => {
  const { normalizeCell, tidyCell, cellError } = await import('../src/utils/phone.ts');
  for (const raw of ['0681746016', '+27681746016', '068 174 6016', '27681746016', '+27 68 174 6016', '0027681746016', '681746016', '068-174-6016'])
    assert.equal(normalizeCell(raw), '0681746016', raw);
  assert.equal(tidyCell('+27681746016'), '068 174 6016');
  assert.equal(tidyCell('06817'), '06817'); // left alone while typing
  assert.equal(normalizeCell('068663193'), null); // 9 digits starting 0: one is missing
  assert.match(cellError('068663193') ?? '', /9 digits/);
  assert.match(cellError('06816601234') ?? '', /11 digits/);
  assert.match(cellError('0215551234') ?? '', /06, 07 or 08/);
  assert.match(cellError('') ?? '', /required/);
  assert.equal(cellError('068 174 6016'), null);
});

test('the message carries the cell as 10 plain digits and validation needs a full number', () => {
  assert.match(buildMessage({ ...complete(), phone: '+27 82 123 4567' }), /Contact:\n0821234567\n/);
  assert.ok(validateStep('customer', { ...complete(), phone: '082123456' }).phone);
  assert.equal(validateStep('customer', { ...complete(), phone: '27821234567' }).phone, undefined);
});
