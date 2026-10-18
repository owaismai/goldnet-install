// Added by the 18 Oct 2026 review: serial plausibility, phone validation, service-worker update checks, URL length.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PACKAGE, emptyForm, OTHER } from '../src/types.ts';
import type { FormState } from '../src/types.ts';
import { buildMessage, buildWhatsAppUrl } from '../src/utils/whatsapp.ts';
import { validateStep } from '../src/utils/validation.ts';
import { normaliseSerial, serialProblem, CPE_SERIAL, ROUTER_SERIAL } from '../src/utils/serial.ts';
import { phoneProblem } from '../src/utils/validation.ts';
import { scheduleUpdateChecks } from '../src/utils/swUpdate.ts';

function complete(): FormState {
  return {
    ...emptyForm(),
    fullName: 'John Smith', phone: '0821234567', streetAddress: '123 Example Street',
    cpeModel: { selected: ['Reyee 460G'], other: '' }, routerModel: { selected: ['M1300 AC'], other: '' },
    internetService: { selected: [DEFAULT_PACKAGE], other: '' }, installFee: { selected: ['R250'], other: '' },
    routerSite: { selected: ['Sidwell'], other: '' }, cashCollected: { selected: [OTHER], other: 'EFT' },
    cpeSerial: 'G1UH44N009260', cpeSerialSource: 'barcode', cpePhoto: true,
    routerSerial: 'M1300245300245', routerSerialSource: 'barcode', routerPhoto: true,
    signal: '62', speedtest: '48', clientType: 'New', photosTaken: { selected: ['CPE'], other: '' },
    technician: 'Osama',
  };
}

test('normaliseSerial drops a printed SN prefix but keeps the serial itself', () => {
  assert.equal(normaliseSerial('SN:G1UH44N009260'), 'G1UH44N009260');
  assert.equal(normaliseSerial('S/N G1UH44N009260\n'), 'G1UH44N009260');
  assert.equal(normaliseSerial('Serial No. M1300245300245'), 'M1300245300245');
  assert.equal(normaliseSerial('G1UH44N009260'), 'G1UH44N009260');
  assert.equal(normaliseSerial('SNOWMAN123'), 'SNOWMAN123', 'a serial that merely starts with SN is untouched');
});

test('serialProblem: real serials pass, QR links / Wi-Fi codes / MACs / junk are refused', () => {
  for (const s of ['G1UH44N009260', 'M1300245300245', 'HE50A1B2C3D4', '4859301847291', 'ABC12345']) assert.equal(serialProblem(s), null, s);
  assert.match(serialProblem('http://192.168.10.1')!, /link/i);
  assert.match(serialProblem('https://www.reyee.com/dl?sn=G1UH44N009260')!, /link/i);
  assert.match(serialProblem('WIFI:S:Reyee-1234;T:WPA;P:12345678;;')!, /Wi-Fi/i);
  assert.ok(serialProblem('1C:2A:3B:4C:5D:6E'), 'a MAC address is not a serial');
  assert.ok(serialProblem('G1UH 44N0 09260'), 'spaces inside');
  assert.ok(serialProblem('12345'), 'too short');
  assert.ok(serialProblem('A'.repeat(33)), 'too long');
  assert.equal(serialProblem(''), null, 'empty is for the required check, not this one');
});

test('CPE serial follows the install bot rule (8-20 letters/digits); router allows 6-32', () => {
  assert.equal(serialProblem('ABCDEFGH', CPE_SERIAL), null);
  assert.ok(serialProblem('ABCDEFG', CPE_SERIAL), '7 chars refused for a CPE');
  assert.ok(serialProblem('A'.repeat(21), CPE_SERIAL), '21 chars refused for a CPE');
  assert.equal(serialProblem('ABCDEF', ROUTER_SERIAL), null);
  assert.equal(serialProblem('A'.repeat(32), ROUTER_SERIAL), null);
});

test('validation refuses a scanned QR link or a malformed serial on the CPE and router steps', () => {
  assert.deepEqual(validateStep('cpe', complete()), {});
  assert.deepEqual(validateStep('router', complete()), {});
  assert.ok(validateStep('cpe', { ...complete(), cpeSerial: 'http://192.168.110.1' }).cpeSerial);
  assert.ok(validateStep('cpe', { ...complete(), cpeSerial: 'G1UH44' }).cpeSerial, 'too short for the bot');
  assert.ok(validateStep('router', { ...complete(), routerSerial: 'WIFI:S:Cudy;P:pass;;' }).routerSerial);
  assert.equal(validateStep('cpe', { ...complete(), cpeSerial: '' }).cpeSerial, 'Scan the CPE barcode (or enter the serial manually)');
});

test('phone: South African cell numbers only', () => {
  for (const p of ['0821234567', '082 123 4567', '082-123-4567', '+27 82 123 4567', '27821234567', '+27821234567']) assert.equal(phoneProblem(p), null, p);
  for (const p of ['082123456', '08212345678', '821234567', '9001015009087', '12345678901', '27 82 123 456']) assert.ok(phoneProblem(p), p);
  assert.ok(validateStep('customer', { ...complete(), phone: '08212345678' }).phone, 'an 11-digit typo is caught');
  assert.equal(validateStep('customer', { ...complete(), phone: '+27 82 123 4567' }).phone, undefined);
});

test('scheduleUpdateChecks asks for a new service worker every interval while online and when the app comes back to the front', () => {
  mock.timers.enable({ apis: ['setInterval', 'Date'] });
  try {
    let updates = 0;
    const reg = { update: async () => { updates += 1; } };
    let online = true;
    const listeners: Record<string, () => void> = {};
    const doc = { visibilityState: 'visible', addEventListener: (n: string, fn: () => void) => { listeners[n] = fn; } };
    const stop = scheduleUpdateChecks(reg, { everyMs: 60_000, minGapMs: 10_000, online: () => online, doc });
    assert.equal(updates, 0);
    mock.timers.tick(60_000);
    assert.equal(updates, 1, 'first periodic check');
    online = false;
    mock.timers.tick(60_000);
    assert.equal(updates, 1, 'offline: no check');
    online = true;
    mock.timers.tick(60_000);
    assert.equal(updates, 2, 'online again: periodic check resumes');
    mock.timers.tick(5_000);
    listeners.visibilitychange();
    assert.equal(updates, 2, 'brought to the front 5 s after a check: no extra check');
    mock.timers.tick(10_000);
    listeners.visibilitychange();
    assert.equal(updates, 3, 'brought to the front later: checks');
    stop();
    mock.timers.tick(600_000);
    assert.equal(updates, 3, 'stopped');
  } finally {
    mock.timers.reset();
  }
});

test('WhatsApp URL for a full form stays well under 2000 characters', () => {
  const f = { ...complete(), email: 'john.smith@example.co.za', idNumber: '9001015009087', location: { lat: -29.85, lng: 31.02 },
    wifiName: 'Smith-Home', wifiPassword: 'P@ss w0rd&1#', cableFrom: '120', cableTo: '175', rating: 5, cashReceipt: 'RC-000123',
    comments: 'Cable run along the ceiling and down behind the TV.', needMore: { selected: ['I need more Cable'], other: '' } };
  const url = buildWhatsAppUrl('27689197093', buildMessage(f));
  assert.ok(url.length < 2000, `url is ${url.length} chars`);
});
