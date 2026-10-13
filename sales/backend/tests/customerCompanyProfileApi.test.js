process.env.JWT_SECRET = 'customer-company-api-test-only-secret';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const jwt = require('jsonwebtoken');
const test = require('node:test');
const customerRoutes = require('../routes/customerRoutes');
const companyProfileRoutes = require('../routes/companyProfileRoutes');
const calendarRoutes = require('../routes/calendarRoutes');
const leadRoutes = require('../routes/leadRoutes');
const { authMiddleware, JWT_SECRET, requirePermission } = require('../middleware/authMiddleware');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const CompanyProfile = require('../models/CompanyProfile');
const { db } = require('../utils/salesDatabase');

const profilePayload = (marker) => ({
  directorName: `${marker} Director`,
  directorDesignation: 'Managing Director',
  companyName: `${marker} Company`,
  branchName: 'Main',
  branchCode: 'HQ',
  registeredAddress: '1 Example Road',
  address: '1 Example Road',
  city: 'Example City',
  state: 'Example State',
  pin: '10000',
  country: 'Example Country',
  companyContactNo: '+10000000000',
  website: 'https://example.com',
  email: `${marker.toLowerCase()}@example.com`,
  companyLogo: { fileName: 'logo.png', filePath: '/uploads/logo.png', mimeType: 'image/png' },
  gstNo: 'gst123',
  panNo: 'pan123',
  bankName: 'Example Bank',
  accountHolderName: 'Example Company',
  accountNo: '123456789',
  ifscCode: 'ifsc123',
  swiftCode: 'swift123',
  cin: 'CIN-123',
  iec: 'IEC-123',
  quotationFormat: 'QTEST',
  idNoFormat: 'ID',
  opfFormat: 'OPFTEST',
  poFormat: 'PO',
  piFormat: 'PI',
  invoiceFormat: 'INV',
  prFormat: 'PR',
  enquiryFormat: 'ENQ',
  challanFormat: 'CH',
});

test('SQLite Customer and Company Profile APIs support conversion and quotation generation', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api/customers', authMiddleware, requirePermission('customers'), customerRoutes);
  app.use('/api/company-profiles', authMiddleware, requirePermission('companyProfiles'), companyProfileRoutes);
  app.use('/api/leads', authMiddleware, leadRoutes);
  app.use('/api/calendar', authMiddleware, requirePermission('calendar'), calendarRoutes);
  const server = app.listen(0);
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET);
  const noPermissionToken = jwt.sign({ role: 'sales' }, JWT_SECRET);
  const request = (url, options = {}, token = adminToken) => fetch(`${baseUrl}${url}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const marker = `SQLiteDependency${Date.now()}`;
  const customerIds = new Set();
  const leadIds = new Set();
  const profileIds = new Set();
  try {
    assert.equal((await request('/api/customers', {}, '')).status, 401);
    assert.equal((await request('/api/customers', {}, noPermissionToken)).status, 403);
    assert.equal((await request('/api/company-profiles', {}, '')).status, 401);
    assert.equal((await request('/api/company-profiles', {}, noPermissionToken)).status, 403);

    const invalidCustomer = await request('/api/customers', {
      method: 'POST',
      body: JSON.stringify({ companyName: `${marker} invalid`, createdBy: 'Tester', contacts: [] }),
    });
    assert.equal(invalidCustomer.status, 400);
    assert.match((await invalidCustomer.json()).message, /at least one contact/i);

    const customerResponse = await request('/api/customers', {
      method: 'POST',
      body: JSON.stringify({
        companyName: `${marker} customer`,
        createdBy: 'Tester',
        contacts: [{
          contactType: 'Primary',
          name: `${marker} Contact`,
          email: `${marker.toLowerCase()}-customer@example.com`,
          phone: '+1 555 0100',
          designation: 'Buyer',
        }],
        billToAddress: { addressLine1: '1 Test Road', city: 'Test City' },
        documents: [{ fileName: 'proof.pdf', filePath: '/uploads/proof.pdf', documentType: 'application/pdf' }],
      }),
    });
    assert.equal(customerResponse.status, 201);
    const customer = (await customerResponse.json()).data;
    assert.match(customer.customerId, /^CI-\d+$/);
    assert.equal(customer.email, `${marker.toLowerCase()}-customer@example.com`);
    assert.equal(customer.billToAddress.addressLine1, '1 Test Road');
    customerIds.add(customer._id);
    assert.equal(Customer.findByName(`${marker} customer`)._id, customer._id);
    assert.equal(Customer.addContact(customer._id, {
      contactType: 'Accounts',
      name: `${marker} Accounts`,
      email: `${marker.toLowerCase()}-accounts@example.com`,
      phone: '+1 555 0101',
    }).contacts.length, 2);
    assert.throws(() => Customer.create({
      ...customer,
      _id: `${customer._id}-duplicate`,
      customerId: customer.customerId,
    }), { code: 'SQLITE_CONSTRAINT_UNIQUE' });

    const listedCustomers = await (await request(`/api/customers?search=${encodeURIComponent(marker)}&page=1&limit=1`)).json();
    assert.equal(listedCustomers.pagination.total, 1);
    assert.equal(listedCustomers.data[0]._id, customer._id);
    assert.equal((await (await request(`/api/customers/${customer._id}`)).json()).data._id, customer._id);
    const updateCustomer = await request(`/api/customers/${customer._id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Inactive', notes: 'Updated in SQLite' }),
    });
    assert.equal(updateCustomer.status, 200);
    assert.equal((await updateCustomer.json()).data.status, 'Inactive');
    const customerCalendarComplete = await request(`/api/calendar/events/Customers/${customer._id}/complete`, {
      method: 'PATCH',
    });
    assert.equal(customerCalendarComplete.status, 200);
    assert.equal(Customer.findById(customer._id).calendarStatus, 'Completed');

    const invalidProfile = await request('/api/company-profiles', {
      method: 'POST',
      body: JSON.stringify({ companyName: marker }),
    });
    assert.equal(invalidProfile.status, 400);
    assert.match((await invalidProfile.json()).message, /Director Name is required/i);

    const profileResponse = await request('/api/company-profiles', {
      method: 'POST',
      body: JSON.stringify(profilePayload(marker)),
    });
    assert.equal(profileResponse.status, 201);
    const profile = (await profileResponse.json()).data;
    assert.ok(profile._id);
    assert.equal(profile.companyLogo.filePath, '/uploads/logo.png');
    profileIds.add(profile._id);
    assert.equal(CompanyProfile.findFirst()._id, profile._id);
    assert.equal(CompanyProfile.findWithLogo()._id, profile._id);

    const profileList = await (await request(`/api/company-profiles?search=${encodeURIComponent(marker)}&page=1&limit=5`)).json();
    assert.equal(profileList.pagination.total, 1);
    assert.equal(profileList.data[0]._id, profile._id);
    assert.equal((await (await request(`/api/company-profiles/${profile._id}`)).json()).data._id, profile._id);

    const updatedFormat = `Q${Date.now()}`;
    const profileUpdate = await request(`/api/company-profiles/${profile._id}`, {
      method: 'PUT',
      body: JSON.stringify({ quotationFormat: updatedFormat }),
    });
    assert.equal(profileUpdate.status, 200);
    assert.equal((await profileUpdate.json()).data.quotationFormat, updatedFormat);

    const quotationLeadResponse = await request('/api/leads', {
      method: 'POST',
      body: JSON.stringify({
        companyName: `${marker} quotation lead`,
        email: `${marker.toLowerCase()}-quote@example.com`,
        leadStatus: 'Proposal Sent',
        createdBy: 'Tester',
      }),
    });
    assert.equal(quotationLeadResponse.status, 201);
    const quotationLead = (await quotationLeadResponse.json()).data;
    leadIds.add(quotationLead._id);
    const financialYear = new Date().getMonth() >= 3
      ? `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(-2)}`
      : `${new Date().getFullYear() - 1}-${String(new Date().getFullYear()).slice(-2)}`;
    assert.equal(quotationLead.quotationId, `${updatedFormat}${financialYear}/001`);

    const conversionLeadResponse = await request('/api/leads', {
      method: 'POST',
      body: JSON.stringify({
        companyName: `${marker} conversion lead`,
        contactPerson: `${marker} Buyer`,
        designation: 'Purchasing',
        email: `${marker.toLowerCase()}-convert@example.com`,
        mobile: '+1 555 0200',
        createdBy: 'Tester',
      }),
    });
    assert.equal(conversionLeadResponse.status, 201);
    const conversionLead = (await conversionLeadResponse.json()).data;
    leadIds.add(conversionLead._id);

    const conversionResponse = await request('/api/leads/convert-customer', {
      method: 'POST',
      body: JSON.stringify({ id: conversionLead._id }),
    });
    const conversionPayload = await conversionResponse.json();
    assert.equal(conversionResponse.status, 200, conversionPayload.message);
    const converted = conversionPayload.data;
    assert.equal(converted.lead.customerId, converted.customer._id);
    assert.equal(converted.lead.isConverted, true);
    assert.equal(converted.customer.email, conversionLead.email);
    customerIds.add(converted.customer._id);

    const repeatedConversion = await request('/api/leads/convert-customer', {
      method: 'POST',
      body: JSON.stringify({ id: conversionLead._id }),
    });
    assert.equal(repeatedConversion.status, 200);
    assert.equal((await repeatedConversion.json()).data.customer._id, converted.customer._id);

    const deleteCustomer = await request(`/api/customers/${customer._id}`, { method: 'DELETE' });
    assert.equal(deleteCustomer.status, 200);
    customerIds.delete(customer._id);
    const deleteLead = await request(`/api/leads/${quotationLead._id}`, { method: 'DELETE' });
    assert.equal(deleteLead.status, 200);
    leadIds.delete(quotationLead._id);
    assert.equal((await request(`/api/leads/${quotationLead._id}`)).status, 404);

    const deleteProfile = await request(`/api/company-profiles/${profile._id}`, { method: 'DELETE' });
    assert.equal(deleteProfile.status, 200);
    profileIds.delete(profile._id);
    assert.equal((await request(`/api/company-profiles/${profile._id}`)).status, 404);
  } finally {
    for (const id of customerIds) db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    for (const id of leadIds) db.prepare('DELETE FROM leads WHERE id = ?').run(id);
    for (const id of profileIds) db.prepare('DELETE FROM company_profiles WHERE id = ?').run(id);
    Customer.ensureCustomerIds();
  }
});
