import test from 'node:test';
import assert from 'node:assert/strict';
import { CPE_SERIAL, ROUTER_SERIAL, normaliseSerial, serialProblem } from '../src/utils/serial.ts';
import { validateStep } from '../src/utils/validation.ts';
import { emptyForm } from '../src/types.ts';

test('serialProblem accepts real serials, including a Reyee rj.link QR', () => {
  assert.equal(serialProblem('G1TD4VE00986C', CPE_SERIAL), null);
  assert.equal(serialProblem('http://rj.link/e?s=G1TD4VE00986C&d=RG-AIRMETRO460F&m=C0A476CEB195', CPE_SERIAL), null);
  assert.equal(serialProblem('ABC123456789', ROUTER_SERIAL), null);
  assert.equal(serialProblem('', CPE_SERIAL), null); // left to the required check
});

test('serialProblem refuses a Wi-Fi QR, a setup link without a serial, a MAC and wrong lengths', () => {
  assert.match(serialProblem('WIFI:S:Smith-Home;T:WPA;P:secret123;;', CPE_SERIAL) ?? '', /Wi-Fi QR/);
  assert.match(serialProblem('https://example.com/page?id=7', CPE_SERIAL) ?? '', /web link/);
  assert.match(serialProblem('http://rj.link/e?d=RG-AIRMETRO460F', CPE_SERIAL) ?? '', /web link/);
  assert.match(serialProblem('rj.link/e?d=RG-AIRMETRO460F', CPE_SERIAL) ?? '', /web link/);
  assert.match(serialProblem('C0:A4:76:CE:B1:95', CPE_SERIAL) ?? '', /letters and digits only/);
  assert.match(serialProblem('G1TD4VE', CPE_SERIAL) ?? '', /8-20/);
  assert.match(serialProblem('G1TD4VE00986C123456789', CPE_SERIAL) ?? '', /8-20/);
  assert.equal(serialProblem('ABC123', ROUTER_SERIAL), null); // routers allow 6-32
});

test('the CPE and router steps block an implausible serial', () => {
  const f = { ...emptyForm(), cpeSerial: 'WIFI:S:x;;', cpePhoto: true, routerSerial: 'C0:A4:76:CE:B1:95', routerPhoto: true };
  assert.match(validateStep('cpe', f).cpeSerial ?? '', /Wi-Fi QR/);
  assert.match(validateStep('router', f).routerSerial ?? '', /letters and digits only/);
  const ok = { ...f, cpeSerial: 'rj.link/e?s=G1TD4VE00986C', routerSerial: 'ABC123456789' };
  assert.equal(validateStep('cpe', ok).cpeSerial, undefined);
  assert.equal(validateStep('router', ok).routerSerial, undefined);
});

test('normaliseSerial drops a printed SN prefix but keeps the serial itself', () => {
  assert.equal(normaliseSerial('SN:G1UH44N009260'), 'G1UH44N009260');
  assert.equal(normaliseSerial('S/N G1UH44N009260\n'), 'G1UH44N009260');
  assert.equal(normaliseSerial('Serial No. G1UH44N009260'), 'G1UH44N009260');
  assert.equal(normaliseSerial('SNOWMAN123'), 'SNOWMAN123', 'a serial that merely starts with SN is untouched');
  assert.equal(serialProblem('SN:G1UH44N009260', CPE_SERIAL), null);
  assert.equal(validateStep('cpe', { ...emptyForm(), cpeSerial: 'S/N G1UH44N009260', cpePhoto: true }).cpeSerial, undefined);
});
