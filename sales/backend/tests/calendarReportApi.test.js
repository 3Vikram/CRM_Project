process.env.JWT_SECRET = 'calendar-report-api-test-only-secret';
process.env.MONGO_URI = '';
process.env.PORT = '0';
process.env.CAMPAIGN_SCHEDULER_ENABLED = 'false';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const jwt = require('jsonwebtoken');
const test = require('node:test');
const { startServer } = require('../server');
const Activity = require('../models/Activity');
const Contact = require('../models/Contact');
const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const MailCampaign = require('../models/MailCampaign');
const OPF = require('../models/OPF');
const Supplier = require('../models/Supplier');
const Employee = require('../models/Employee');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { db } = require('../utils/salesDatabase');

const startApi = async (t) => {
  const server = startServer();
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  return `http://127.0.0.1:${server.address().port}/api`;
};

const makeRequest = (baseUrl, token) => (route, options = {}) => fetch(`${baseUrl}${route}`, {
  ...options,
  headers: {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  },
});

test('Calendar SQLite API lists and updates every supported module without MongoDB', async (t) => {
  const api = await startApi(t);
  const adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET);
  const noPermissionToken = jwt.sign({ role: 'sales' }, JWT_SECRET);
  const request = makeRequest(api, adminToken);
  const today = new Date().toISOString().slice(0, 10);
  const marker = `Calendar${randomUUID().replaceAll('-', '')}`;
  const lead = Lead.create({
    companyName: `${marker} Lead`,
    contactPerson: 'Lead Contact',
    createdBy: marker,
    followUpDate: today,
    followUpTime: '10:15',
    demoDate: today,
    demoTime: '11:30',
    meetingDate: today,
    meetingTime: '12:00',
    callbackDate: today,
    callbackTime: '13:00',
    nextActionDate: today,
    nextActionTime: '14:00',
  });
  const customer = Customer.create({
    companyName: `${marker} Customer`,
    createdBy: marker,
    meetingDate: today,
    meetingTime: '09:15',
    renewalDate: today,
    renewalTime: '09:30',
    contractExpiryDate: today,
    contractExpiryTime: '09:45',
    visitDate: today,
    visitTime: '10:00',
    nextActionDate: today,
    nextActionTime: '10:15',
    contacts: [{ name: 'Customer Contact', email: `${marker.toLowerCase()}@example.test`, phone: '555-0123' }],
  });
  const contact = Contact.create({
    customerId: customer._id,
    customerName: customer.companyName,
    contactName: `${marker} Contact`,
    contactNumber: '555-0124',
    email: `${marker.toLowerCase()}-contact@example.test`,
    meetingDate: today,
    meetingTime: '11:00',
    callReminderDate: today,
    callReminderTime: '11:15',
    birthday: today,
    anniversary: today,
    nextActionDate: today,
    nextActionTime: '11:30',
  });
  const supplier = Supplier.create({
    supplierName: `${marker} Supplier`,
    category: 'Technology',
    paymentTerms: 'Net 30',
    addressLine1: '1 Test Road',
    country: 'US',
    state: 'CA',
    createdBy: marker,
    deliveryDate: today,
    deliveryTime: '12:00',
    paymentReminderDate: today,
    paymentReminderTime: '12:15',
    followUpDate: today,
    followUpTime: '12:30',
  });
  const campaign = MailCampaign.create({
    campaignName: `${marker} Campaign`,
    subject: 'Calendar migration test',
    createdBy: marker,
    status: 'Scheduled',
    scheduledDate: today,
    scheduledTime: '13:45',
  });
  const activity = Activity.create({
    activityType: 'Call',
    activityDate: today,
    followUpDate: today,
    customerName: `${marker} Activity`,
    contactPerson: 'Activity Contact',
    createdBy: marker,
    status: 'Open',
  });
  const activityId = String(activity.id);

  try {
    assert.equal(process.env.MONGO_URI, '');
    assert.equal((await request('/calendar/events', { headers: { Authorization: `Bearer ${noPermissionToken}` } })).status, 403);
    const eventResponse = await request('/calendar/events');
    assert.equal(eventResponse.status, 200);
    const events = (await eventResponse.json()).data;
    const ownEvents = events.filter((event) => event.customerName.includes(marker) || event.contactName.includes(marker) || event.title.includes(marker));
    assert.ok(ownEvents.length >= 17, `expected all module events, got ${ownEvents.length}`);
    assert.ok(ownEvents.some((event) => event.referenceId === lead._id && event.sourceField === 'demoDate' && event.time === '11:30'));
    assert.ok(ownEvents.some((event) => event.referenceId === customer._id && event.sourceField === 'renewalDate'));
    assert.ok(ownEvents.some((event) => event.referenceId === contact._id && event.sourceField === 'birthday'));
    assert.ok(ownEvents.some((event) => event.referenceId === supplier._id && event.sourceField === 'paymentReminderDate'));
    assert.ok(ownEvents.some((event) => event.referenceId === campaign._id && event.sourceField === 'scheduledDate'));
    assert.ok(ownEvents.some((event) => event.referenceId === activityId && event.module === 'Activities'));

    for (const [module, id] of [
      ['Leads', lead._id],
      ['Customers', customer._id],
      ['Contacts', contact._id],
      ['Suppliers', supplier._id],
      ['Mail Campaigns', campaign._id],
      ['Activities', activityId],
    ]) {
      const complete = await request(`/calendar/events/${encodeURIComponent(module)}/${encodeURIComponent(id)}/complete`, { method: 'PATCH' });
      assert.equal(complete.status, 200, `${module} completion`);
    }
    assert.equal(Lead.findById(lead._id).calendarStatus, 'Completed');
    assert.equal(Customer.findById(customer._id).calendarStatus, 'Completed');
    assert.equal(Contact.findById(contact._id).calendarStatus, 'Completed');
    assert.equal(Supplier.getById(supplier._id).calendarStatus, 'Completed');
    assert.equal(MailCampaign.getById(campaign._id).calendarStatus, 'Completed');
    assert.equal(Activity.findById(activityId).status, 'Completed');

    for (const [module, id, sourceField] of [
      ['Leads', lead._id, 'demoDate'],
      ['Customers', customer._id, 'renewalDate'],
      ['Contacts', contact._id, 'birthday'],
      ['Suppliers', supplier._id, 'paymentReminderDate'],
      ['Mail Campaigns', campaign._id, 'scheduledDate'],
      ['Activities', activityId, 'activityDate'],
    ]) {
      const deletion = await request(`/calendar/events/${encodeURIComponent(module)}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        body: JSON.stringify({ sourceField }),
      });
      assert.equal(deletion.status, 200, `${module} event deletion`);
    }
    assert.equal(Lead.findById(lead._id).demoDate, '');
    assert.equal(Customer.findById(customer._id).renewalDate, '');
    assert.equal(Contact.findById(contact._id).birthday, '');
    assert.equal(Supplier.getById(supplier._id).paymentReminderDate, '');
    assert.equal(MailCampaign.getById(campaign._id).scheduledDate, '');
    assert.equal(Activity.findById(activityId), undefined);

    const unsupported = await request('/calendar/events/Unknown/123', {
      method: 'DELETE',
      body: JSON.stringify({ sourceField: 'activityDate' }),
    });
    assert.equal(unsupported.status, 400);
    assert.match((await unsupported.json()).message, /Unsupported calendar event module/);
  } finally {
    db.prepare('DELETE FROM activities WHERE id = ?').run(activityId);
    db.prepare('DELETE FROM mail_campaigns WHERE id = ?').run(campaign._id);
    Supplier.deleteById(supplier._id);
    db.prepare('DELETE FROM contacts WHERE id = ?').run(contact._id);
    Customer.deleteById(customer._id);
    db.prepare('DELETE FROM leads WHERE id = ?').run(lead._id);
  }
});

test('Reports SQLite APIs preserve filters, aggregations, pagination, options, and funnel/usage calculations', async (t) => {
  const api = await startApi(t);
  const adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET);
  const noPermissionToken = jwt.sign({ role: 'sales' }, JWT_SECRET);
  const request = makeRequest(api, adminToken);
  const marker = `Report${randomUUID().replaceAll('-', '')}`;
  const workerName = `${marker} Employee`;
  const today = new Date().toISOString().slice(0, 10);
  const employee = Employee.create({
    employeeName: workerName,
    email: `${marker.toLowerCase()}@example.test`,
    role: 'Sales Executive',
    status: 'Active',
  });
  const customer = Customer.create({
    companyName: `${marker} Customer`,
    createdBy: workerName,
    contacts: [{ name: 'Report Contact', email: `contact-${marker.toLowerCase()}@example.test`, phone: '555-0999' }],
  });
  const contact = Contact.create({
    customerId: customer._id,
    customerName: customer.companyName,
    contactName: 'Report Contact',
    contactNumber: '555-0998',
    email: `contact-two-${marker.toLowerCase()}@example.test`,
    employeeId: employee._id,
  });
  const opf1 = OPF.create({
    quotationNumber: `${marker}-Q1`,
    customerName: customer.companyName,
    supplierName: `${marker} Supplier`,
    product: `${marker} Product`,
    quantity: 2,
    unitPrice: 500,
    vendorPrice: 300,
    createdBy: workerName,
    createdDate: new Date().toISOString(),
  }, `${marker}-OPF-`);
  const opf2 = OPF.create({
    quotationNumber: `${marker}-Q2`,
    customerName: customer.companyName,
    supplierName: `${marker} Supplier`,
    product: `${marker} Product`,
    quantity: 1,
    unitPrice: 400,
    vendorPrice: 250,
    createdBy: workerName,
    createdDate: new Date().toISOString(),
  }, `${marker}-OPF-`);
  const lead = Lead.create({
    companyName: customer.companyName,
    contactPerson: 'Report Contact',
    email: `lead-${marker.toLowerCase()}@example.test`,
    createdBy: workerName,
    createdDate: new Date().toISOString(),
    leadStatus: 'Qualified',
    products: [{ productName: `${marker} Product`, quantity: 2, unitPrice: 500 }],
  });
  const activity = Activity.create({
    activityType: 'Call',
    activityDate: today,
    customerName: customer.companyName,
    createdBy: workerName,
    status: 'Open',
  });

  try {
    assert.equal(process.env.MONGO_URI, '');
    assert.equal((await request('/reports/top-products', { headers: { Authorization: `Bearer ${noPermissionToken}` } })).status, 403);

    const topCustomersResponse = await request(`/reports/top-customers?createdBy=${encodeURIComponent(workerName)}&createdDate=${today}&customerName=${encodeURIComponent(customer.companyName)}&product=${encodeURIComponent(`${marker} Product`)}&page=1&limit=1`);
    assert.equal(topCustomersResponse.status, 200);
    const topCustomers = await topCustomersResponse.json();
    assert.equal(topCustomers.pagination.total, 1);
    assert.equal(topCustomers.pagination.limit, 1);
    assert.equal(topCustomers.data[0].customer, customer.companyName);
    assert.equal(topCustomers.data[0].orders, 2);
    assert.equal(topCustomers.data[0].quantity, 3);
    assert.equal(topCustomers.data[0].revenue, 1400);
    assert.equal(topCustomers.data[0].cost, 850);
    assert.equal(topCustomers.data[0].profit, 550);
    assert.ok(topCustomers.options.createdBy.includes(workerName));
    assert.ok(topCustomers.options.customerNames.includes(customer.companyName));
    assert.ok(topCustomers.options.products.includes(`${marker} Product`));

    const topEmployees = await (await request(`/reports/top-employees?createdBy=${encodeURIComponent(workerName)}`)).json();
    assert.ok(topEmployees.data.some((row) => row.employee === workerName && row.orders === 2));
    const productAnalysis = await (await request(`/reports/product-analysis?product=${encodeURIComponent(`${marker} Product`)}`)).json();
    assert.ok(productAnalysis.data.some((row) => row.product === `${marker} Product` && row.revenue === 1400));

    const marginResponse = await request(`/reports/revenue-margin?search=${encodeURIComponent(marker)}&page=1&limit=2`);
    assert.equal(marginResponse.status, 200);
    const margin = await marginResponse.json();
    assert.equal(margin.pagination.total, 2);
    assert.equal(margin.data.length, 2);
    assert.deepEqual(margin.data.map((row) => row.revenue).sort((a, b) => a - b), [400, 1000]);
    assert.deepEqual(margin.data.map((row) => row.cost).sort((a, b) => a - b), [250, 600]);
    assert.deepEqual(margin.data.map((row) => row.profit).sort((a, b) => a - b), [150, 400]);

    const funnelResponse = await request(`/reports/funnel-analysis?createdBy=${encodeURIComponent(workerName)}&createdDate=${today}`);
    assert.equal(funnelResponse.status, 200);
    const funnel = await funnelResponse.json();
    const qualified = funnel.data.find((row) => row.stage === 'Qualified');
    assert.equal(qualified.count, 1);
    assert.equal(qualified.amount, 1000);
    assert.equal(qualified.conversionPercent, 100);

    const usageResponse = await request(`/reports/usages?createdBy=${encodeURIComponent(workerName)}&createdDate=${today}`);
    assert.equal(usageResponse.status, 200);
    const usage = await usageResponse.json();
    const employeeUsage = usage.data.find((row) => row.employee === workerName);
    assert.equal(employeeUsage.customersCreated, 1);
    assert.equal(employeeUsage.quotations, 1);
    assert.equal(employeeUsage.sales, 2);
    assert.equal(employeeUsage.activities, 1);
    const usageAlias = await request(`/reports/usage?createdBy=${encodeURIComponent(workerName)}&createdDate=${today}`);
    assert.equal(usageAlias.status, 200);
    const teamAnalysis = await request('/reports/team-analysis');
    const teamData = await teamAnalysis.json();
    assert.equal(teamAnalysis.status, 200);
    assert.equal(teamData.unavailable, true);

    const unknown = await request('/reports/not-a-report');
    assert.equal(unknown.status, 400);
  } finally {
    db.prepare('DELETE FROM activities WHERE id = ?').run(String(activity.id));
    db.prepare('DELETE FROM leads WHERE id = ?').run(lead._id);
    db.prepare('DELETE FROM opfs WHERE id IN (?, ?)').run(opf1._id, opf2._id);
    db.prepare('DELETE FROM contacts WHERE id = ?').run(contact._id);
    Customer.deleteById(customer._id);
    db.prepare('DELETE FROM employees WHERE id = ?').run(employee._id);
  }
});
