import tsNode from 'ts-node';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

tsNode.register({
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS', moduleResolution: 'node' },
});
const require = createRequire(import.meta.url);
const { getPayCycleStatus, localCalendarDate } = require('../src/lib/payCycleDates.ts');

test('UTC midnight does not reset a Winnipeg cycle before payday', () => {
  const anchor = '2026-10-09';
  for (const instant of ['2026-10-22T23:59:59Z', '2026-10-23T00:00:00Z', '2026-10-23T04:59:59.999Z']) {
    const cycle = getPayCycleStatus(anchor, new Date(instant));
    assert.equal(localCalendarDate(new Date(instant)), '2026-10-22');
    assert.equal(cycle.cycle_start, '2026-10-09');
    assert.equal(cycle.cycle_end, '2026-10-22');
    assert.equal(cycle.next_pay_date, '2026-10-23');
  }
  assert.equal(getPayCycleStatus(anchor, new Date('2026-10-23T05:00:00Z')).cycle_start, '2026-10-23');
});

test('winter midnight and DST changes use calendar days instead of 24-hour durations', () => {
  for (const [anchor, payday, midnight] of [
    ['2026-12-04', '2026-12-18', '2026-12-18T06:00:00Z'],
    ['2026-10-23', '2026-11-06', '2026-11-06T06:00:00Z'],
    ['2026-03-06', '2026-03-20', '2026-03-20T05:00:00Z'],
  ]) {
    assert.equal(getPayCycleStatus(anchor, new Date(Date.parse(midnight) - 1)).cycle_start, anchor);
    assert.equal(getPayCycleStatus(anchor, new Date(midnight)).cycle_start, payday);
  }
});

test('cross-month and future anchors keep the full 14-day window until payday', () => {
  const cycle = getPayCycleStatus('2026-11-06', new Date('2026-11-01T02:00:00Z'));
  assert.equal(cycle.cycle_start, '2026-10-23');
  assert.equal(cycle.cycle_end, '2026-11-05');
  assert.equal(cycle.next_pay_date, '2026-11-06');
});

test('a missing or invalid anchor falls back to the Winnipeg calendar month', () => {
  for (const anchor of [null, undefined, '', 'invalid', '2026-02-30']) {
    const cycle = getPayCycleStatus(anchor, new Date('2026-11-01T02:00:00Z'));
    assert.equal(cycle.cycle_start, '2026-10-01');
    assert.equal(cycle.cycle_end, '2026-10-31');
    assert.equal(cycle.is_configured, false);
  }
});

test('Magic Months count scheduled paydays in the local month', () => {
  const cycle = getPayCycleStatus('2026-01-02', new Date('2026-02-01T02:00:00Z'));
  assert.equal(cycle.paydays_this_month, 3);
  assert.equal(cycle.is_magic_month, true);
  assert.equal(getPayCycleStatus('2026-01-02', new Date('2026-02-01T06:00:00Z')).is_magic_month, false);
});

test('server timezone does not change dates or cycle boundaries', () => {
  const originalTimeZone = process.env.TZ;
  try {
    for (const timeZone of ['UTC', 'Asia/Colombo', 'America/Vancouver']) {
      process.env.TZ = timeZone;
      assert.equal(localCalendarDate(new Date('2026-10-23T02:00:00Z')), '2026-10-22');
      assert.equal(getPayCycleStatus('2026-10-09', new Date('2026-10-23T02:00:00Z')).cycle_start, '2026-10-09');
    }
  } finally {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  }
});
