const test = require('node:test');
const assert = require('node:assert/strict');
const Lead = require('../models/Lead');
const Activity = require('../models/Activity');
const Employee = require('../models/Employee');
const {
  _buildLeadAnalytics,
  _parseLeadAnalyticsRange,
  _getPipelineValue,
  getLeadAnalytics,
} = require('../controllers/leadAnalyticsController');

const range = { start: '2026-03-01', end: '2026-03-31' };
const today = '2026-03-31';

test('lead analytics validates date range and defaults to the current year', () => {
  assert.deepEqual(_parseLeadAnalyticsRange({ startDate: '2026-03-01', endDate: '2026-03-31' }), range);
  assert.equal(_parseLeadAnalyticsRange({ startDate: '2026-02-30', endDate: '2026-03-31' }), null);
  assert.equal(_parseLeadAnalyticsRange({ startDate: '2026-04-01', endDate: '2026-03-31' }), null);
  const defaultRange = _parseLeadAnalyticsRange({}, new Date('2026-03-31T12:00:00.000Z'));
  assert.deepEqual(defaultRange, { start: '2026-01-01', end: '2026-03-31' });
});

test('lead pipeline value uses only saved CRM quotation and product values', () => {
  assert.equal(_getPipelineValue({ quotationDetails: { value: '1250' } }), 1250);
  assert.equal(_getPipelineValue({ products: [{ quantity: '2', unitPrice: '50' }] }), 100);
  assert.equal(_getPipelineValue({ products: [{ quantity: '2' }] }), null);
  assert.equal(_getPipelineValue({}), null);
});

test('lead analytics calculates KPIs, linked conversions, aging, stages, and product groups', () => {
  const leads = [
    {
      _id: 'lead-a',
      leadId: 'LD-1',
      leadStatus: 'Qualified',
      sourceOfLead: 'Website',
      assignedTo: 'Alex',
      assignedToId: 'employee-a',
      createdDate: new Date('2026-03-25T05:00:00.000Z'),
      followUpDate: '2026-04-02',
      quotationDetails: { value: 1000, sbu: 'Cloud' },
      products: [{ productName: 'CRM', quantity: 1, unitPrice: 1000 }],
      timeline: [{ title: 'Moved to funnel' }, { title: 'Quotation generated' }],
    },
    {
      _id: 'lead-b',
      leadId: 'LD-2',
      leadStatus: 'New',
      source: 'Referral',
      assignedTo: 'Morgan',
      assignedToId: 'employee-c',
      createdDate: new Date('2026-03-01T05:00:00.000Z'),
      followUpDate: '2026-03-30',
      quotationDetails: {},
      products: [],
      timeline: [],
    },
    {
      _id: 'lead-c',
      leadId: 'LD-3',
      leadStatus: 'Won',
      isConverted: true,
      assignedTo: 'Riya',
      assignedToId: 'employee-b',
      createdDate: new Date('2026-03-10T05:00:00.000Z'),
      followUpDate: '',
      products: [{ productName: 'CRM' }],
      timeline: [],
    },
    {
      _id: 'lead-old',
      leadId: 'LD-OLD',
      leadStatus: 'New',
      assignedTo: 'Alex',
      assignedToId: 'employee-a',
      createdDate: new Date('2025-01-01T05:00:00.000Z'),
      followUpDate: '',
    },
  ];
  const result = _buildLeadAnalytics({
    leads,
    activities: [{ leadId: 'LD-1' }, { leadId: 'LD-1' }, { leadId: 'lead-c' }],
    employees: new Map([['employee-a', 'Alex'], ['employee-b', 'Riya']]),
    filters: { status: 'All', source: 'All', employeeId: '', employeeName: '' },
    range,
    today,
  });

  assert.deepEqual(result.kpis, {
    totalLeads: 3,
    openLeads: 2,
    conversionRate: 33.3,
    expiringFollowUps: 1,
    leadsThisMonth: 3,
    convertedToActivity: 2,
    convertedToFunnel: 1,
    convertedToQuotation: 1,
    leadsScrapped: 0,
    monthlyFollowUps: 1,
  });
  assert.deepEqual(result.charts.leadsBySource, [
    { source: 'Not recorded', count: 1 },
    { source: 'Referral', count: 1 },
    { source: 'Website', count: 1 },
  ]);
  assert.equal(result.charts.topEmployees[0].employee, 'Alex');
  assert.equal(result.charts.topEmployees[0].pipelineValue, 1000);
  assert.equal(result.charts.leadFunnel.find((item) => item.stage === 'Qualified').percent, 33.3);
  assert.equal(result.charts.followUpAnalysis.overdue, 1);
  assert.equal(result.charts.followUpAnalysis.unscheduled, 0);
  assert.equal(result.charts.leadAging.totalOpenLeads, 2);
  assert.equal(result.charts.productAnalysis.find((item) => item.name === 'CRM').total, 2);
  assert.equal(result.charts.productAvailable, true);
});

test('lead analytics filter selected leads without double-counting activity links', () => {
  const result = _buildLeadAnalytics({
    leads: [
      { _id: 'lead-a', leadId: 'LD-1', leadStatus: 'Qualified', source: 'Website', assignedTo: 'Alex', assignedToId: 'e1', createdDate: new Date('2026-03-05T05:00:00Z'), followUpDate: '2026-03-20' },
      { _id: 'lead-b', leadId: 'LD-2', leadStatus: 'New', source: 'Referral', assignedTo: 'Riya', assignedToId: 'e2', createdDate: new Date('2026-03-05T05:00:00Z'), followUpDate: '' },
    ],
    activities: [{ leadId: 'LD-1' }, { leadId: 'lead-a' }],
    employees: new Map(),
    filters: { status: 'Qualified', source: 'Website', employeeId: 'e1', employeeName: 'Alex' },
    range,
    today,
  });

  assert.equal(result.kpis.totalLeads, 1);
  assert.equal(result.kpis.convertedToActivity, 1);
  assert.equal(result.kpis.openLeads, 1);
});

test('lead analytics endpoint applies authorization and selected date window', async () => {
  const originalFinds = { lead: Lead.find, activity: Activity.find, employee: Employee.find };
  const queries = {};
  Lead.find = (query) => {
    queries.lead = query;
    return {
      select() { return this; },
      lean: async () => [{
        _id: 'lead-1',
        leadId: 'LD-1',
        leadStatus: 'New',
        source: 'Website',
        sourceOfLead: 'Website',
        assignedTo: 'Alex',
        assignedToId: '0123456789abcdef01234567',
        createdDate: new Date('2026-03-05T05:00:00Z'),
        followUpDate: '',
        timeline: [],
      }],
    };
  };
  Activity.find = (query) => {
    queries.activity = query;
    return { select() { return this; }, lean: async () => [{ leadId: 'LD-1' }] };
  };
  Employee.find = (query) => {
    queries.employee = query;
    return { select() { return this; }, lean: async () => [{ _id: '0123456789abcdef01234567', employeeName: 'Alex' }] };
  };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  try {
    await getLeadAnalytics({
      query: {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        status: 'All',
        source: 'All',
      },
      user: { id: 'employee-1', name: 'Alex', role: 'employee' },
      leadResourceFilter: {},
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.kpis.totalLeads, 1);
    assert.match(JSON.stringify(queries.lead), /createdById/);
    assert.match(JSON.stringify(queries.lead), /2026-02-28T18:30:00\.000Z/);
    assert.match(JSON.stringify(queries.lead), /2026-03-31T18:30:00\.000Z/);
    assert.match(JSON.stringify(queries.activity), /deletedAt/);
  } finally {
    Lead.find = originalFinds.lead;
    Activity.find = originalFinds.activity;
    Employee.find = originalFinds.employee;
  }
});

test('lead analytics rejects unsupported status filters', async () => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await getLeadAnalytics({ query: { status: 'Unreal Stage' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});
