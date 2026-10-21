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

test('the screenshot reset date is November 14, never October 31 or November 1', () => {
  for (const instant of ['2026-10-21T02:00:00Z', '2026-10-31T18:00:00Z', '2026-11-01T18:00:00Z', '2026-11-14T05:59:59.999Z']) {
    const cycle = getPayCycleStatus('2026-11-14', new Date(instant));
    assert.equal(cycle.cycle_start, '2026-10-14');
    assert.equal(cycle.cycle_end, '2026-11-13');
    assert.equal(cycle.next_pay_date, '2026-11-14');
    assert.equal(cycle.is_magic_month, false);
  }
  const reset = getPayCycleStatus('2026-11-14', new Date('2026-11-14T06:00:00Z'), '2026-10-14');
  assert.equal(reset.cycle_start, '2026-11-14');
  assert.equal(reset.next_pay_date, null, 'Wait for the next date the user chooses');
});

test('the exact chosen day starts at Winnipeg midnight in winter and daylight saving time', () => {
  for (const [resetDate, midnight] of [
    ['2026-07-14', '2026-07-14T05:00:00Z'],
    ['2026-11-14', '2026-11-14T06:00:00Z'],
    ['2027-01-14', '2027-01-14T06:00:00Z'],
    ['2027-03-14', '2027-03-14T06:00:00Z'],
  ]) {
    assert.equal(getPayCycleStatus(resetDate, new Date(Date.parse(midnight) - 1)).next_pay_date, resetDate);
    assert.equal(getPayCycleStatus(resetDate, new Date(midnight)).cycle_start, resetDate);
  }
});

test('rescheduling the next date preserves the saved current cycle start', () => {
  for (const resetDate of ['2026-11-21', '2026-12-05', '2027-02-28']) {
    const cycle = getPayCycleStatus(resetDate, new Date('2026-10-21T02:00:00Z'), '2026-10-14');
    assert.equal(cycle.cycle_start, '2026-10-14');
    assert.equal(cycle.next_pay_date, resetDate);
  }
});

test('after the selected reset, no additional resets occur without another date being chosen', () => {
  for (const instant of ['2026-11-28T18:00:00Z', '2026-12-14T18:00:00Z', '2027-02-01T18:00:00Z']) {
    const cycle = getPayCycleStatus('2026-11-14', new Date(instant), '2026-10-14');
    assert.equal(cycle.cycle_start, '2026-11-14');
    assert.equal(cycle.next_pay_date, null);
  }
});

test('a missing date preserves a saved start rather than resetting at a new calendar month', () => {
  for (const anchor of [null, undefined, '', 'invalid', '2026-02-30']) {
    const cycle = getPayCycleStatus(anchor, new Date('2026-11-02T02:00:00Z'), '2026-10-01');
    assert.equal(cycle.cycle_start, '2026-10-01');
    assert.equal(cycle.next_pay_date, null);
    assert.equal(cycle.is_configured, false);
  }
});

test('legacy month-end configurations bootstrap correctly in leap years and short months', () => {
  assert.equal(getPayCycleStatus('2028-03-31', new Date('2028-03-01T18:00:00Z')).cycle_start, '2028-02-29');
  assert.equal(getPayCycleStatus('2027-03-31', new Date('2027-03-01T18:00:00Z')).cycle_start, '2027-02-28');
});

test('server timezone does not change dates or cycle boundaries', () => {
  const originalTimeZone = process.env.TZ;
  try {
    for (const timeZone of ['UTC', 'Asia/Colombo', 'America/Vancouver']) {
      process.env.TZ = timeZone;
      assert.equal(localCalendarDate(new Date('2026-10-23T02:00:00Z')), '2026-10-22');
      assert.equal(getPayCycleStatus('2026-11-14', new Date('2026-10-23T02:00:00Z')).next_pay_date, '2026-11-14');
    }
  } finally {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  }
});
