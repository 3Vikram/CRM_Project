const test = require('node:test');
const assert = require('node:assert/strict');
const {
  addDateDays,
  daysBetween,
  getDateOnly,
  getEffectiveStatus,
  getTodayInKolkata,
  matchesEffectiveStatus,
  validateOutcome,
} = require('../utils/activityStatus');

const today = '2026-11-13';

test('calculates the Kolkata calendar date without UTC day shifts', () => {
  assert.equal(getTodayInKolkata(new Date('2026-11-12T19:00:00.000Z')), today);
  assert.equal(getDateOnly('2026-11-13T00:00:00.000Z'), '2026-11-13');
  assert.equal(getDateOnly('2026-11-13T19:00:00.000Z'), '2026-11-14');
});

test('calculates follow-up today and overdue day counts from date-only values', () => {
  assert.equal(getEffectiveStatus({ status: 'Open', followUpDate: today }, today), 'Follow-Up Today');
  assert.equal(getEffectiveStatus({ status: 'Open', followUpDate: '2026-11-10' }, today), 'Overdue - 3d');
  assert.equal(getEffectiveStatus({ status: 'Open', followUpDate: '2026-11-06' }, today), 'Overdue - 7d');
  assert.equal(daysBetween('2026-11-10', today), 3);
});

test('preserves selected follow-up outcomes until due, then calculates temporary due states', () => {
  for (const status of ['Follow-Up Required', 'Awaiting Client', 'Rescheduled / No-Show']) {
    const activity = { status, followUpDate: '2026-11-14' };
    assert.equal(getEffectiveStatus(activity, today), status);
    assert.equal(getEffectiveStatus({ ...activity, followUpDate: today }, today), 'Follow-Up Today');
    assert.equal(getEffectiveStatus({ ...activity, followUpDate: '2026-11-10' }, today), 'Overdue - 3d');
  }
});

test('terminal outcomes override dates and future activities are scheduled', () => {
  assert.equal(getEffectiveStatus({ status: 'Completed', followUpDate: '2026-11-01' }, today), 'Completed');
  assert.equal(getEffectiveStatus({ status: 'Cancelled', followUpDate: '2026-11-01' }, today), 'Cancelled');
  assert.equal(getEffectiveStatus({ status: 'Open', activityDate: '2026-11-14' }, today), 'Upcoming / Scheduled');
});

test('matches overdue bucket filters and increments dates across month boundaries', () => {
  assert.equal(matchesEffectiveStatus('Overdue - 3d', 'Overdue'), true);
  assert.equal(matchesEffectiveStatus('Open', 'Overdue'), false);
  assert.equal(addDateDays('2026-11-30', 1), '2026-12-01');
});

test('requires follow-up dates and outcome reasons on both server-side validation paths', () => {
  assert.match(validateOutcome({ status: 'Follow-Up Required' }), /Follow-Up Date/);
  assert.match(validateOutcome({ status: 'Awaiting Client', followUpDate: today }), /^$/);
  assert.match(validateOutcome({ status: 'Rescheduled / No-Show', followUpDate: today }), /reason in Remarks/);
  assert.match(validateOutcome({ status: 'Cancelled' }), /reason in Remarks/);
  assert.equal(validateOutcome({ status: 'Cancelled', customerRemarks: 'Duplicate activity' }), '');
  assert.match(validateOutcome({ status: 'Follow-Up Today' }), /valid activity status/);
});
