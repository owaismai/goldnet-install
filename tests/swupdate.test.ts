import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleUpdateChecks } from '../src/utils/swUpdate.ts';

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

