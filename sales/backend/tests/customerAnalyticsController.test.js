const test = require('node:test');
const assert = require('node:assert/strict');
const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const OPF = require('../models/OPF');
const {
  _buildCustomerAnalytics,
  _parseCustomerAnalyticsRange,
  getCustomerAnalytics,
} = require('../controllers/customerController');

test('customer analytics validates explicit date ranges and defaults to twelve months', () => {
  assert.deepEqual(_parseCustomerAnalyticsRange({
    startDate: '2026-03-01',
    endDate: '2026-03-31',
  }), { start: '2026-03-01', end: '2026-03-31' });
  assert.equal(_parseCustomerAnalyticsRange({ startDate: '2026-02-30', endDate: '2026-03-31' }), null);
  assert.equal(_parseCustomerAnalyticsRange({ startDate: '2026-04-01', endDate: '2026-03-31' }), null);
  assert.equal(_parseCustomerAnalyticsRange({ startDate: '2026-03-01' }), null);

  const defaultRange = _parseCustomerAnalyticsRange({});
  assert.match(defaultRange.start, /^\d{4}-\d{2}-01$/);
  assert.match(defaultRange.end, /^\d{4}-\d{2}-\d{2}$/);
});

test('customer analytics derives customer metrics, conversion, sources and revenue from linked records', () => {
  const customers = [
    { _id: 'customer-1', companyName: 'Northwind', industry: 'Manufacturing', status: 'Active', createdAt: '2026-03-05T05:00:00.000Z', sourceLeadId: 'lead-1' },
    { _id: 'customer-2', companyName: 'Contoso', industry: 'Manufacturing', status: 'Inactive', createdAt: '2026-03-12T05:00:00.000Z' },
    { _id: 'customer-3', companyName: 'Fabrikam', industry: 'Retail', status: 'Active', createdAt: '2026-02-01T05:00:00.000Z' },
  ];
  const leads = [
    { _id: 'lead-1', customerId: 'customer-1', source: 'Referral', sourceOfLead: 'Partner', isConverted: true },
  ];
  const opfs = [
    { customerId: 'customer-1', customerName: 'Northwind', quantity: 2, unitPrice: 100, vendorPrice: 30, serviceCost: 0, freightCost: 0 },
  ];

  const result = _buildCustomerAnalytics({
    customers,
    leads,
    opfs,
    range: { start: '2026-03-01', end: '2026-03-31' },
  });

  assert.equal(result.kpis.totalCustomers, 2);
  assert.equal(result.kpis.totalChangePercent, 100);
  assert.deepEqual(result.kpis.leadingSector, { name: 'Manufacturing', count: 2, changePercent: null });
  assert.deepEqual(result.kpis.leadingIndustryRevenue, { industry: 'Manufacturing', revenue: 200 });
  assert.equal(result.kpis.activeCustomers, 1);
  assert.equal(result.kpis.inactiveCustomers, 1);
  assert.deepEqual(result.charts.growthTrend.map((point) => point.customers), [2]);
  assert.equal(result.charts.topCustomers[0].customer, 'Northwind');
  assert.equal(result.charts.topCustomers[0].marginPercent, 70);
  assert.deepEqual(result.charts.conversionOverview, {
    convertedLeads: 1,
    directCustomers: 1,
    convertedActivitiesAvailable: false,
  });
  assert.deepEqual(result.charts.leadAcquisitionSources, [{ source: 'Partner', count: 1 }]);
});

test('customer analytics does not expose margin percentages without recorded cost data', () => {
  const result = _buildCustomerAnalytics({
    customers: [
      { _id: 'customer-1', companyName: 'Northwind', industry: 'Manufacturing', status: 'Active', createdAt: '2026-03-05T05:00:00.000Z' },
    ],
    leads: [],
    opfs: [
      { customerId: 'customer-1', customerName: 'Northwind', quantity: 2, unitPrice: 100, vendorPrice: 0, serviceCost: 0, freightCost: 0 },
    ],
    range: { start: '2026-03-01', end: '2026-03-31' },
  });

  assert.equal(result.charts.marginAvailable, false);
  assert.equal('marginPercent' in result.charts.topCustomers[0], false);
});

test('customer analytics endpoint scopes customer and revenue queries and applies selected dates', async () => {
  const originals = { customerFind: Customer.find, leadFind: Lead.find, opfFind: OPF.find };
  const captured = {};
  Customer.find = (query) => {
    captured.customer = query;
    return {
      select() { return this; },
      lean: async () => [{
        _id: 'customer-1',
        companyName: 'Northwind',
        industry: 'Manufacturing',
        status: 'Active',
        createdAt: '2026-03-05T05:00:00.000Z',
        sourceLeadId: 'lead-1',
      }],
    };
  };
  Lead.find = (query) => {
    captured.lead = query;
    return {
      select() { return this; },
      lean: async () => [{ _id: 'lead-1', customerId: 'customer-1', sourceOfLead: 'Referral', isConverted: true }],
    };
  };
  OPF.find = (query) => {
    captured.opf = query;
    return {
      select() { return this; },
      lean: async () => [{
        customerId: 'customer-1',
        customerName: 'Northwind',
        createdDate: new Date('2026-03-10T05:00:00.000Z'),
        quantity: 1,
        unitPrice: 500,
      }],
    };
  };

  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  try {
    await getCustomerAnalytics({
      query: { startDate: '2026-03-01', endDate: '2026-03-31' },
      user: { id: 'employee-1', name: 'Alex', role: 'employee' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.kpis.totalCustomers, 1);
    assert.equal(res.body.data.kpis.leadingIndustryRevenue.revenue, 500);
    assert.match(JSON.stringify(captured.customer), /assignedEmployees\.employeeId/);
    assert.match(JSON.stringify(captured.opf), /createdById/);
    assert.match(JSON.stringify(captured.opf), /2026-02-28T18:30:00\.000Z/);
    assert.match(JSON.stringify(captured.opf), /2026-03-31T18:30:00\.000Z/);
  } finally {
    Customer.find = originals.customerFind;
    Lead.find = originals.leadFind;
    OPF.find = originals.opfFind;
  }
});
