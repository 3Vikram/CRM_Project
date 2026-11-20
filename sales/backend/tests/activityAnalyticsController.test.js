const test = require('node:test');
const assert = require('node:assert/strict');
const Activity = require('../models/Activity');
const {
  _buildActivityAnalytics,
  _dateRangeFor,
  getActivityAnalytics,
} = require('../controllers/activityAnalyticsController');

const today = '2026-11-18';

const response = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test('activity analytics ranges use Kolkata calendar dates and validate custom periods', () => {
  assert.deepEqual(_dateRangeFor('today', today), { start: today, end: today });
  assert.deepEqual(_dateRangeFor('week', today), { start: '2026-11-16', end: '2026-11-22' });
  assert.deepEqual(_dateRangeFor('month', today), { start: '2026-11-01', end: '2026-11-30' });
  assert.deepEqual(_dateRangeFor('year', today), { start: '2026-01-01', end: '2026-12-31' });
  assert.deepEqual(_dateRangeFor('custom', today, '2026-11-01', '2026-11-15'), {
    start: '2026-11-01',
    end: '2026-11-15',
  });
  assert.equal(_dateRangeFor('custom', today, '2026-02-30', '2026-03-01'), null);
  assert.equal(_dateRangeFor('custom', today, '2026-11-19', '2026-11-18'), null);
});

test('activity analytics calculates KPIs and product metrics from actual activity records', () => {
  const activities = [
    { activityDate: '2026-11-17', activityType: 'Demo', status: 'Completed', followUpDate: today, response: 'Positive', leadId: 'L-1', product: 'Laptop', assignedUser: 'Admin' },
    { activityDate: '2026-11-18', activityType: 'Call', status: 'Follow-Up Required', followUpDate: '2026-11-20', response: 'Negative', leadId: 'L-2', product: 'laptop', assignedUser: 'Riya' },
    { activityDate: '2026-11-16', activityType: 'Meeting', status: 'Open', followUpDate: '2026-11-15', response: 'No Response', leadId: 'L-3', product: '', assignedUser: 'Riya' },
    { activityDate: '2026-11-18', activityType: 'Email', status: 'Cancelled', followUpDate: '2026-11-10', response: 'Pending', leadId: 'L-2', product: 'Email Suite', assignedUser: '' },
    { activityDate: '2026-11-18', activityType: 'Call', status: 'Open', followUpDate: today, response: 'Pending', leadId: 'L-4', product: '', assignedUser: 'Riya' },
  ];
  const result = _buildActivityAnalytics({
    activities,
    employeeActivities: activities,
    filters: {
      activityType: 'All',
      dateRange: 'week',
      performanceInterval: 'daily',
      employeeId: '',
      employeeName: '',
    },
    range: { start: '2026-11-16', end: '2026-11-22' },
    today,
    performanceInterval: 'daily',
  });

  assert.deepEqual(result.cards, {
    totalActivities: 5,
    todaysFollowUps: 1,
    pendingFollowUps: 2,
    positiveResponses: 1,
    negativeResponses: 1,
    demos: 1,
    funnelsGenerated: 4,
    missedFollowUps: 1,
    successRate: 33.3,
  });
  assert.deepEqual(result.charts.productAnalysis, [
    { product: 'Laptop', count: 2 },
    { product: 'Email Suite', count: 1 },
  ]);
  assert.equal(result.charts.activityPerformance.length, 7);
  assert.equal(result.charts.weeklyTrend.length, 8);
  assert.equal(result.charts.followUpCompletion.find((group) => group.type === 'Demo').completed, 1);
  assert.equal(result.charts.salesDistribution.available, false);
});

test('activity analytics rejects invalid filters before querying records', async () => {
  const res = response();
  await getActivityAnalytics({ query: { activityType: 'Unrecognized' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /activity type/i);
});

test('activity analytics applies activity, employee, date and owner filters to database reads', async () => {
  const originalFind = Activity.find;
  const capturedQueries = [];
  Activity.find = (query) => {
    capturedQueries.push(query);
    return {
      select() {
        return this;
      },
      lean: async () => capturedQueries.length === 1
        ? [{ activityDate: '2026-11-18', activityType: 'Call', status: 'Open', followUpDate: '', response: 'Positive', leadId: 'L-10', product: 'CRM', assignedUser: 'Riya', assignedUserId: 'employee-10' }]
        : [{ assignedUser: 'Riya', assignedUserId: 'employee-10' }],
    };
  };
  const res = response();
  try {
    await getActivityAnalytics({
      query: {
        activityType: 'Call',
        dateRange: 'custom',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        employeeId: 'employee-10',
        employeeName: 'Riya',
        performanceInterval: 'weekly',
      },
      user: { id: 'user-9', name: 'Owner', role: 'employee' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.cards.totalActivities, 1);
    assert.deepEqual(res.body.data.employees, [{ id: 'employee-10', name: 'Riya' }]);
    assert.equal(res.body.data.timeline.length, 1);
    assert.equal(res.body.data.timeline[0].scheduledTime, null);
    assert.equal(capturedQueries.length, 2);
    const mainQueryText = JSON.stringify(capturedQueries[0]);
    assert.match(mainQueryText, /"deletedAt":null/);
    assert.match(mainQueryText, /"activityType":"Call"/);
    assert.match(mainQueryText, /"assignedUserId":"employee-10"/);
    assert.match(mainQueryText, /"activityDate":\{"\$gte":"2026-04-01","\$lte":"2026-11-30"\}/);
    assert.match(mainQueryText, /"createdById":"user-9"/);
  } finally {
    Activity.find = originalFind;
  }
});
