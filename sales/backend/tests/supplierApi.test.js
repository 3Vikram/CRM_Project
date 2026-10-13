process.env.JWT_SECRET = 'supplier-api-test-only-secret';
process.env.MONGO_URI = '';
process.env.PORT = '0';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const test = require('node:test');
const { startServer } = require('../server');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const Supplier = require('../models/Supplier');
const { db } = require('../utils/salesDatabase');

test('Supplier API provides SQLite CRUD, validation, filtering, permissions, and works without MongoDB', async (t) => {
  const server = startServer();
  await once(server, 'listening');
  const supplierIds = [];
  const previousSupplierCounter = db.prepare("SELECT value, updated_at FROM counters WHERE name = 'supplier-id'").get() || null;
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  t.after(() => {
    supplierIds.forEach((id) => db.prepare('DELETE FROM suppliers WHERE id = ?').run(id));
    if (previousSupplierCounter) {
      db.prepare("UPDATE counters SET value = ?, updated_at = ? WHERE name = 'supplier-id'")
        .run(previousSupplierCounter.value, previousSupplierCounter.updated_at);
    } else {
      db.prepare("DELETE FROM counters WHERE name = 'supplier-id'").run();
    }
  });

  const marker = randomUUID();
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET);
  const readOnlyToken = jwt.sign({
    role: 'sales',
    permissions: { suppliers: { view: true, create: false, edit: false, delete: false } },
  }, JWT_SECRET);
  const request = (route, { token = adminToken, ...options } = {}) => fetch(`${baseUrl}${route}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const supplierPayload = (overrides = {}) => ({
    createdBy: `Supplier Tester ${marker}`,
    supplierName: `Supplier ${marker}`,
    gstNumber: 'GST-123',
    category: 'Hardware',
    paymentTerms: 'Net 30',
    addressLine1: '1 Test Street',
    country: 'India',
    state: 'Karnataka',
    city: 'Bengaluru',
    pinCode: '560001',
    bankName: 'Test Bank',
    bankAddress: '2 Bank Street',
    accountHolder: 'Test Holder',
    accountNumber: '123456',
    ifscCode: 'TEST0001',
    loginEmailId: 'supplier-login@example.test',
    loginPassword: 'preserved-secret',
    contactType: 'Primary',
    contactName: 'Test Contact',
    designation: 'Sales',
    emailId: '  SUPPLIER@example.test ',
    contactNumber: '9876543210',
    product: 'Networking',
    ...overrides,
  });
  const validSupplierRecipientCount = Supplier.countDocuments({ emailId: { $regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/i } });

  assert.equal(process.env.MONGO_URI, '');
  assert.equal((await request('/health')).status, 200);
  assert.equal((await request('/suppliers', { token: '' })).status, 401);
  assert.equal((await request('/suppliers', { token: readOnlyToken, method: 'POST', body: JSON.stringify({}) })).status, 403);

  const invalid = await request('/suppliers', {
    method: 'POST',
    body: JSON.stringify({ supplierName: 'Incomplete supplier' }),
  });
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).message, /Category, Payment Terms/i);

  const createdResponse = await request('/suppliers', {
    method: 'POST',
    body: JSON.stringify(supplierPayload()),
  });
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).data;
  supplierIds.push(created._id);
  assert.match(created._id, /^[0-9a-f-]{36}$/i);
  assert.match(created.supplierId, /^SL-\d+$/);
  assert.equal(created.emailId, 'supplier@example.test');
  assert.equal(created.loginPassword, 'preserved-secret');
  assert.equal(created.bankAddress, '2 Bank Street');
  assert.equal(Supplier.countDocuments({ emailId: { $regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/i } }), validSupplierRecipientCount + 1);
  assert.equal(Supplier.find({ emailId: { $regex: /supplier@example\.test/i } }).select('emailId').lean()[0].emailId, 'supplier@example.test');
  const calendarUpdate = Supplier.findOneAndUpdate(
    { _id: created._id, deletedAt: null },
    { $set: { calendarStatus: 'Completed' } },
    { new: true },
  );
  assert.equal(calendarUpdate.calendarStatus, 'Completed');

  const listResponse = await request(`/suppliers?search=${encodeURIComponent(marker)}&createdBy=${encodeURIComponent(`Supplier Tester ${marker}`)}&product=Networking&page=1&limit=1`);
  assert.equal(listResponse.status, 200);
  const listed = await listResponse.json();
  assert.equal(listed.pagination.total, 1);
  assert.equal(listed.data[0]._id, created._id);
  assert.equal(listed.data[0].category, 'Hardware');
  const noMatches = await request(`/suppliers?product=Missing-${marker}`);
  assert.equal((await noMatches.json()).pagination.total, 0);

  const detailResponse = await request(`/suppliers/${created._id}`);
  assert.equal(detailResponse.status, 200);
  const detail = (await detailResponse.json()).data;
  assert.equal(detail.accountNumber, '123456');
  assert.equal(detail.loginEmailId, 'supplier-login@example.test');

  const updatedResponse = await request(`/suppliers/${created._id}`, {
    method: 'PUT',
    body: JSON.stringify(supplierPayload({ supplierName: `Updated ${marker}`, product: 'Services' })),
  });
  assert.equal(updatedResponse.status, 200);
  assert.equal((await updatedResponse.json()).data.supplierName, `Updated ${marker}`);

  const missingRequired = await request(`/suppliers/${created._id}`, {
    method: 'PUT',
    body: JSON.stringify({ supplierName: 'No other required fields' }),
  });
  assert.equal(missingRequired.status, 400);
  assert.equal((await request(`/suppliers/${created._id}`, { token: readOnlyToken, method: 'DELETE' })).status, 403);

  const deletedResponse = await request(`/suppliers/${created._id}`, { method: 'DELETE' });
  assert.equal(deletedResponse.status, 200);
  assert.equal((await request(`/suppliers/${created._id}`)).status, 404);
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(created._id);
  supplierIds.splice(supplierIds.indexOf(created._id), 1);
});
