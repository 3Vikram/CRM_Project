const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAnalytics, parseRange, getRevenue, getMargin } = require('../controllers/funnelAnalyticsController');

const records = [
  {
    _id: 'funnel-won',
    companyName: 'Acme',
    leadStatus: 'Won',
    quotationId: 'Q-100',
    createdBy: 'A Manager',
    createdById: 'employee-a',
    assignedTo: 'A Manager',
    assignedToId: 'employee-a',
    createdDate: '2025-03-03T08:00:00.000Z',
    quotationDetails: {
      stage: 'Won',
      sbu: 'SBU One',
      oem: 'OEM A',
      tagResource: 'Resource A',
      revenue: 1000,
      marginPercent: 10,
      demo: 'Yes',
      expectedClosure: '2025-03-09',
    },
    products: [{ productName: 'Product A', quantity: 1, unitPrice: 1000 }],
    timeline: [{ title: 'Status updated', description: 'Moved to Won', createdAt: '2025-03-09T08:00:00.000Z' }],
  },
  {
    _id: 'funnel-open',
    companyName: 'Beta',
    leadStatus: 'Proposal Sent',
    createdBy: 'B Manager',
    createdById: 'employee-b',
    assignedTo: 'B Manager',
    assignedToId: 'employee-b',
    createdDate: '2025-03-07T08:00:00.000Z',
    quotationDetails: {
      stage: 'Proposal Sent',
      sbu: 'SBU Two',
      oem: 'OEM B',
      tagResource: 'Resource B',
      value: 2000,
      marginPercent: 20,
      expectedClosure: '2025-03-08',
    },
    products: [{ productName: 'Product B', quantity: 1, unitPrice: 2000 }],
    timeline: [{ title: 'Quotation generated' }],
  },
  {
    _id: 'funnel-lost',
    companyName: 'Gamma',
    leadStatus: 'Lost',
    createdBy: 'B Manager',
    createdById: 'employee-b',
    createdDate: '2025-03-08T08:00:00.000Z',
    quotationDetails: { stage: 'Lost', marginPercent: 12 },
    products: [],
    timeline: [],
  },
  {
    _id: 'funnel-previous',
    companyName: 'Earlier',
    leadStatus: 'Qualified',
    createdBy: 'A Manager',
    createdById: 'employee-a',
    createdDate: '2025-02-28T08:00:00.000Z',
    quotationDetails: { stage: 'Qualified', revenue: 500, marginPercent: 5 },
    products: [],
    timeline: [],
  },
];

const employees = [
  { _id: 'employee-a', employeeName: 'A Manager', branchCode: 'BLR' },
  { _id: 'employee-b', employeeName: 'B Manager', branchCode: 'MUM' },
];

const range = { start: '2025-03-01', end: '2025-03-10' };
const emptyFilters = { stage: '', resource: '', accountManager: '', sbu: '', oem: '', branch: '' };

test('parseRange defaults to the current year and rejects invalid date ranges', () => {
  assert.deepEqual(parseRange({}, new Date('2025-03-10T12:00:00.000Z')), {
    start: '2025-01-01',
    end: '2025-03-10',
  });
  assert.equal(parseRange({ startDate: '2025-02-30', endDate: '2025-03-10' }), null);
  assert.equal(parseRange({ startDate: '2025-03-11', endDate: '2025-03-10' }), null);
});

test('calculates current KPIs, real revenue/margin, stages, groups and prior-period trend', () => {
  const data = buildAnalytics({
    records,
    employees,
    filters: emptyFilters,
    range,
    today: new Date('2025-03-10T12:00:00.000Z'),
    granularity: 'weekly',
  });

  assert.equal(data.kpis.totalFunnels, 3);
  assert.equal(data.kpis.openFunnels, 1);
  assert.equal(data.kpis.quotationsGenerated, 2);
  assert.equal(data.kpis.closedFunnels, 1);
  assert.equal(data.kpis.lostFunnels, 1);
  assert.equal(data.kpis.totalRevenue, 3000);
  assert.equal(data.kpis.totalMargin, 500);
  assert.equal(data.kpis.expiredFunnels, 1);
  assert.equal(data.kpis.demoConducted, 1);
  assert.equal(data.kpis.conversionRate, 50);
  assert.equal(data.trend.reduce((total, point) => total + (point.current || 0), 0), 3);
  assert.equal(data.trend.reduce((total, point) => total + (point.previous || 0), 0), 1);
  assert.equal(data.topCustomers[0].customer, 'Beta');
  assert.equal(data.topProducts[0].product, 'Product A');
  assert.equal(data.leaderboard[0].employee, 'B Manager');
  assert.equal(data.stages.find((stage) => stage.stage === 'Won').dropOffPercent, null);
  assert.equal(data.stages.find((stage) => stage.stage === 'Won').averageDaysInStage, 1);
  assert.equal(data.stages.find((stage) => stage.stage === 'Pitching').count, 0);
  assert.equal(data.stages.find((stage) => stage.stage === 'Pitching').revenue, 0);
  assert.equal(data.stages.find((stage) => stage.stage === 'Pitching').averageDaysInStage, null);
  assert.equal(data.revenueByStage.find((stage) => stage.stage === 'Hold').revenue, 0);
});

test('applies account manager, resource, stage, SBU, OEM and branch filters together', () => {
  const data = buildAnalytics({
    records,
    employees,
    filters: {
      stage: 'Won',
      resource: 'Resource A',
      accountManager: 'employee-a',
      sbu: 'SBU One',
      oem: 'OEM A',
      branch: 'BLR',
    },
    range,
    today: new Date('2025-03-10T12:00:00.000Z'),
    granularity: 'daily',
  });

  assert.equal(data.kpis.totalFunnels, 1);
  assert.equal(data.kpis.totalRevenue, 1000);
  assert.equal(data.kpis.totalMargin, 100);
  assert.equal(data.topCustomers[0].customer, 'Acme');
  assert.deepEqual(data.filterOptions.stages.sort(), [
    'Commit',
    'Demo/POC',
    'Hold',
    'Lost',
    'OPF',
    'PO Received',
    'Pitching',
    'Proposal Sent',
    'Qualified',
    'Quotation',
    'Upside',
    'Won',
  ]);
});

test('uses recorded funnel stages and groups sales representatives by assigned account manager', () => {
  const data = buildAnalytics({
    records: [{
      _id: 'funnel-stage',
      companyName: 'Stage account',
      leadStatus: 'Pitching',
      assignedTo: 'Assigned Manager',
      assignedToId: 'employee-a',
      createdBy: 'Creator',
      createdById: 'employee-b',
      createdDate: '2025-03-05T08:00:00.000Z',
      quotationDetails: { stage: 'Demo/POC', revenue: 600, marginPercent: 10, tagResource: 'Resource Name' },
      products: [
        { productName: 'Duplicate Product', quantity: 1, unitPrice: 200 },
        { productName: 'Duplicate Product', quantity: 2, unitPrice: 200 },
      ],
      timeline: [],
    }],
    employees,
    filters: emptyFilters,
    range,
    today: new Date('2025-03-10T12:00:00.000Z'),
    granularity: 'daily',
  });

  assert.equal(data.stages.find((row) => row.stage === 'Demo/POC').count, 1);
  assert.equal(data.stages.find((row) => row.stage === 'Pitching').count, 0);
  assert.equal(data.leaderboard[0].employee, 'Assigned Manager');
  assert.equal(data.leaderboard[0].employeeId, 'employee-a');
  assert.equal(data.topProducts[0].funnelCount, 1);
  assert.equal(data.topProducts[0].revenue, 600);
});

test('does not invent revenue or margin when source values are absent', () => {
  const record = { products: [{ quantity: 2, unitPrice: '' }], quotationDetails: { marginPercent: 10 } };
  assert.equal(getRevenue(record), null);
  assert.equal(getMargin(record, null), null);
  assert.equal(getMargin({ quotationDetails: { marginPercent: 'invalid' } }, 100), null);
  assert.equal(getMargin({ quotationDetails: { marginPercent: '' } }, 100), null);
});
