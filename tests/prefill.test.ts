import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyForm, OTHER } from '../src/types.ts';
import { applyPrefill, hasPrefill } from '../src/utils/prefill.ts';

const q = (o: Record<string, string>) => '?' + new URLSearchParams(o).toString();

test('GOLDNET Radio values fill the CPE, signal, location and notes', () => {
  const f = applyPrefill(emptyForm('Osama'), q({ cpe: 'G1TEST000001', cpe_model: 'Reyee AIRMETRO460F', signal: '-58 dBm (expected -56)',
    speedtest: '312.4 / 118.9 Mbps (link test)', lat: '-33.95', lon: '25.55', notes: 'Sector GN-RY-TEST-1' }));
  assert.equal(f.cpeSerial, 'G1TEST000001');
  assert.equal(f.cpeSerialSource, 'manual');
  assert.deepEqual(f.cpeModel.selected, ['Reyee 460F']);
  assert.equal(f.signal, '-58 dBm (expected -56)');
  assert.equal(f.speedtest, '312.4 / 118.9 Mbps (link test)');
  assert.deepEqual(f.location, { lat: -33.95, lng: 25.55 });
  assert.equal(f.comments, 'Sector GN-RY-TEST-1');
  assert.equal(f.technician, 'Osama');
});

test('an unknown model becomes Other; notes are added once; an existing location and speed test are kept', () => {
  const base = { ...emptyForm(), comments: 'Roof mount', location: { lat: 1, lng: 2 }, speedtest: '50' };
  const once = applyPrefill(base, q({ cpe_model: 'Ubiquiti LiteBeam 5AC Gen2', notes: 'Signal -60', lat: '-33', lon: '25', speedtest: '9' }));
  assert.deepEqual(once.cpeModel, { selected: [OTHER], other: 'Ubiquiti LiteBeam 5AC Gen2' });
  assert.equal(once.comments, 'Roof mount\nSignal -60');
  assert.deepEqual(once.location, { lat: 1, lng: 2 });
  assert.equal(once.speedtest, '50');
  assert.equal(applyPrefill(once, q({ notes: 'Signal -60' })).comments, 'Roof mount\nSignal -60');
});

test('no parameters: nothing to apply', () => {
  assert.equal(hasPrefill(''), false);
  assert.equal(hasPrefill('?cpe=X'), true);
  assert.deepEqual(applyPrefill(emptyForm(), ''), emptyForm());
});
