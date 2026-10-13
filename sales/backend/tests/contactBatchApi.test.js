process.env.JWT_SECRET = 'contact-batch-api-test-only-secret';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');
const test = require('node:test');
const contactRoutes = require('../routes/contactRoutes');
const { authMiddleware, requirePermission } = require('../middleware/authMiddleware');
const Employee = require('../models/Employee');
const Customer = require('../models/Customer');
const CustomerBatch = require('../models/CustomerBatch');
const Contact = require('../models/Contact');
const { db, dbPath } = require('../utils/salesDatabase');

test('Contacts and employee batches preserve CRUD, ownership, customer links, and transactional imports in sales.db', async (t) => {
  const path = require('node:path');
  const expectedDbPath = process.env.SALES_DB_PATH
    ? path.resolve(process.env.SALES_DB_PATH)
    : path.resolve(__dirname, '..', '..', '..', 'database', 'sales.db');
  assert.equal(dbPath, expectedDbPath);

  db.exec('SAVEPOINT contact_batch_api_test');
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/contacts', authMiddleware, requirePermission('contacts'), contactRoutes);
  const server = app.listen(0);
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    db.exec('ROLLBACK TO contact_batch_api_test');
    db.exec('RELEASE contact_batch_api_test');
  });

  const marker = randomUUID().replaceAll('-', '');
  const employee = Employee.create({
    employeeName: `Contact Test ${marker}`,
    email: `contact-owner-${marker}@example.test`,
    role: 'Sales Executive',
    status: 'Active',
  });
  const otherEmployee = Employee.create({
    employeeName: `Other Contact Test ${marker}`,
    email: `other-contact-owner-${marker}@example.test`,
    role: 'Sales Executive',
    status: 'Active',
  });
  const customer = Customer.create({
    companyName: `Customer ${marker}`,
    createdBy: 'Contact API test',
    contacts: [{
      contactType: 'Accounts',
      name: `Existing Customer Contact ${marker}`,
      email: `customer-${marker}@example.test`,
      phone: '555-0001',
    }],
  });

  const employeeToken = jwt.sign({
    id: employee._id,
    email: employee.email,
    role: 'employee',
    permissions: { contacts: { view: true, create: true, edit: true, delete: true } },
  }, process.env.JWT_SECRET);
  const noPermissionToken = jwt.sign({
    id: employee._id,
    role: 'employee',
    permissions: { contacts: { view: false, create: false, edit: false, delete: false } },
  }, process.env.JWT_SECRET);
  const adminToken = jwt.sign({ id: 'admin', email: `admin-${marker}@example.test`, role: 'admin' }, process.env.JWT_SECRET);
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/contacts`;
  const request = (route, { token = employeeToken, ...options } = {}) => fetch(`${baseUrl}${route}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const contactPayload = (overrides = {}) => ({
    customerId: customer._id,
    customerName: customer.companyName,
    contactName: `Contact ${marker}`,
    designation: 'Manager',
    mail: 'Preferred',
    contactNumber: `555-${marker.slice(0, 4)}`,
    email: `contact-${marker}@example.test`,
    ...overrides,
  });
  let ownedContactId = '';
  let importedContactId = '';
  let batchId = '';

  assert.equal((await request('/', { token: '' })).status, 401);
  assert.equal((await request('/', { token: noPermissionToken })).status, 403);

  const createResponse = await request('/', {
    method: 'POST',
    body: JSON.stringify(contactPayload()),
  });
  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()).data;
  ownedContactId = created._id;
  assert.equal(created.email, `contact-${marker}@example.test`);
  assert.equal(created.customerId, customer._id);
  assert.equal(created.employeeId, employee._id);

  const invalidEmailResponse = await request('/', {
    method: 'POST',
    body: JSON.stringify(contactPayload({ email: 'invalid-email' })),
  });
  assert.equal(invalidEmailResponse.status, 400);

  const adminContactResponse = await request('/', {
    token: adminToken,
    method: 'POST',
    body: JSON.stringify(contactPayload({
      customerId: '',
      customerName: `Admin-owned ${marker}`,
      contactName: `Admin Contact ${marker}`,
      email: `admin-contact-${marker}@example.test`,
      contactNumber: `556-${marker.slice(0, 4)}`,
    })),
  });
  assert.equal(adminContactResponse.status, 201);

  const listResponse = await request(`/?search=${encodeURIComponent(marker)}&employeeId=${encodeURIComponent(employee._id)}&page=1&limit=1`);
  assert.equal(listResponse.status, 200);
  const list = await listResponse.json();
  assert.equal(list.success, true);
  assert.equal(list.data.length, 1);
  assert.equal(list.data[0]._id, ownedContactId);
  assert.deepEqual(list.pagination, { total: 1, page: 1, limit: 1, totalPages: 1 });
  const adminOwnedListResponse = await request(`/?employeeId=admin&search=${encodeURIComponent(marker)}`);
  const adminOwnedList = await adminOwnedListResponse.json();
  assert.equal(adminOwnedList.pagination.total, 1);
  assert.equal(adminOwnedList.data[0].employeeId, 'admin');
  assert.equal((await request(`/?batchId=missing`)).status, 400);

  const byIdResponse = await request(`/${encodeURIComponent(ownedContactId)}`);
  assert.equal(byIdResponse.status, 200);
  assert.equal((await byIdResponse.json()).data.customerName, customer.companyName);
  assert.equal((await request(`/${encodeURIComponent(ownedContactId)}`, { token: noPermissionToken })).status, 403);
  assert.equal((await request(`/${encodeURIComponent(ownedContactId)}`, {
    token: jwt.sign({ id: otherEmployee._id, role: 'employee', permissions: { contacts: { view: true } } }, process.env.JWT_SECRET),
  })).status, 404);

  const updateResponse = await request(`/${encodeURIComponent(ownedContactId)}`, {
    method: 'PUT',
    body: JSON.stringify(contactPayload({
      contactName: `Updated Contact ${marker}`,
      designation: 'Director',
      email: `updated-${marker}@example.test`,
    })),
  });
  assert.equal(updateResponse.status, 200);
  assert.equal((await updateResponse.json()).data.contactName, `Updated Contact ${marker}`);

  const moveContactResponse = await request('/', {
    method: 'POST',
    body: JSON.stringify(contactPayload({
      customerId: '',
      customerName: `Moved Customer ${marker}`,
      contactName: `Moved Contact ${marker}`,
      email: `moved-${marker}@example.test`,
      contactNumber: `557-${marker.slice(0, 4)}`,
    })),
  });
  assert.equal(moveContactResponse.status, 201);
  const moveContact = (await moveContactResponse.json()).data;
  const moveResponse = await request(`/${encodeURIComponent(moveContact._id)}/move-to-customer`, { method: 'POST' });
  assert.equal(moveResponse.status, 200);
  const moved = (await moveResponse.json()).data;
  assert.equal(moved.contact.customerId, moved.customer._id);
  assert.equal(moved.customer.contacts[0].email, `moved-${marker}@example.test`);

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet([
    {
      'Contact Name': `Imported Contact ${marker}`,
      Designation: 'Buyer',
      'Phone Number': `558-${marker.slice(0, 4)}`,
      Email: `imported-${marker}@example.test`,
      'Customer Name': `Imported Customer ${marker}`,
    },
    {
      'Contact Name': `Duplicate Contact ${marker}`,
      'Phone Number': `558-${marker.slice(0, 4)}`,
      Email: `duplicate-${marker}@example.test`,
    },
    {
      'Contact Name': `Invalid Contact ${marker}`,
      'Phone Number': `559-${marker.slice(0, 4)}`,
      Email: 'invalid-address',
    },
    {
      'Contact Name': `Existing Contact ${marker}`,
      'Phone Number': `560-${marker.slice(0, 4)}`,
      Email: `updated-${marker}@example.test`,
    },
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
  const workbookBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const upload = new FormData();
  upload.set('file', new Blob([workbookBuffer]), `contacts-${marker}.xlsx`);
  const importResponse = await request('/import', {
    method: 'POST',
    body: upload,
  });
  assert.equal(importResponse.status, 201);
  const imported = await importResponse.json();
  assert.equal(imported.success, true);
  assert.equal(imported.imported, 1);
  assert.equal(imported.skipped, 3);
  assert.equal(imported.batchNumber, 1);
  assert.equal(imported.batchName, 'Batch 1');
  importedContactId = Contact.list({ search: `Imported Contact ${marker}`, employeeId: employee._id }).data[0]._id;
  batchId = Contact.findById(importedContactId).batchId;

  const batch = CustomerBatch.findById(batchId);
  assert.equal(batch.employeeId, employee._id);
  assert.equal(batch.customerCount, 1);
  assert.deepEqual(batch.customers, [importedContactId]);

  const batchListResponse = await request(`/?employeeId=${encodeURIComponent(employee._id)}&batchId=${encodeURIComponent(batchId)}`);
  assert.equal(batchListResponse.status, 200);
  const batchList = await batchListResponse.json();
  assert.equal(batchList.pagination.total, 1);
  assert.equal(batchList.batches[0].batchNumber, 1);
  assert.equal(batchList.batches[0].count, 1);
  const employeeGroup = batchList.employeeGroups.find((group) => group.employeeId === employee._id);
  assert.equal(employeeGroup.customerCount, 3);
  assert.equal(employeeGroup.batches[0].customerCount, 1);

  const repeatedUpload = new FormData();
  repeatedUpload.set('file', new Blob([workbookBuffer]), `contacts-${marker}.xlsx`);
  const duplicateImport = await request('/import', { method: 'POST', body: repeatedUpload });
  assert.equal(duplicateImport.status, 200);
  assert.equal((await duplicateImport.json()).imported, 0);
  assert.equal(CustomerBatch.findByEmployeeAndNumber(employee._id, 2), null);

  const deleteImported = await request(`/${encodeURIComponent(importedContactId)}`, { method: 'DELETE' });
  assert.equal(deleteImported.status, 200);
  assert.equal(CustomerBatch.findById(batchId).customerCount, 0);
  assert.equal(CustomerBatch.findById(batchId).customers.length, 0);
  assert.equal((await request(`/${encodeURIComponent(importedContactId)}`)).status, 404);

  const deleteResponse = await request(`/${encodeURIComponent(ownedContactId)}`, { method: 'DELETE' });
  assert.equal(deleteResponse.status, 200);
  assert.equal((await request(`/${encodeURIComponent(ownedContactId)}`)).status, 404);
});
