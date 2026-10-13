process.env.JWT_SECRET = 'opf-api-test-only-secret';
process.env.MONGO_URI = '';
process.env.PORT = '0';
process.env.EMAIL_USER = '';
process.env.SMTP_USER = '';
process.env.EMAIL_PASS = '';
process.env.SMTP_PASS = '';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const test = require('node:test');
const { startServer } = require('../server');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const OPF = require('../models/OPF');
const { db } = require('../utils/salesDatabase');

test('OPF API preserves SQLite CRUD, validation, numbering, documents, permissions, and runs without MongoDB', async (t) => {
  const server = startServer();
  await once(server, 'listening');
  const opfIds = [];
  const uploadedPaths = [];
  const now = new Date();
  const financialYear = now.getMonth() + 1 >= 4
    ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(-2)}`
    : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(-2)}`;
  const opfPrefix = `OPF${financialYear}/`;
  const previousSequence = db.prepare('SELECT value FROM opf_sequences WHERE prefix = ?').get(opfPrefix) || null;
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  t.after(() => {
    opfIds.forEach((id) => db.prepare('DELETE FROM opfs WHERE id = ?').run(id));
    if (previousSequence) {
      db.prepare('UPDATE opf_sequences SET value = ? WHERE prefix = ?').run(previousSequence.value, opfPrefix);
    } else {
      db.prepare('DELETE FROM opf_sequences WHERE prefix = ?').run(opfPrefix);
    }
    uploadedPaths.forEach((filePath) => {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    });
  });

  const marker = randomUUID();
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET);
  const readOnlyToken = jwt.sign({
    role: 'sales',
    permissions: { opf: { view: true, create: false, edit: false, delete: false } },
  }, JWT_SECRET);
  const request = (route, { token = adminToken, ...options } = {}) => fetch(`${baseUrl}${route}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const form = (overrides = {}, withFiles = false) => {
    const body = new FormData();
    Object.entries({
      quotationNumber: `QUOTE-${marker}`,
      quotationId: `QID-${marker}`,
      customerId: `CUSTOMER-${marker}`,
      customerName: `Customer ${marker}`,
      contactPerson: 'Test Contact',
      supplierName: 'Test Supplier',
      supplierContactPerson: 'Supplier Contact',
      product: 'Networking',
      description: 'OPF API test',
      quantity: '3',
      unitPrice: '250',
      vendorPrice: '100',
      serviceCost: '5',
      serviceTax: '2',
      freightCost: '7',
      freightTax: '1',
      conversionRate: '1.5',
      approvalStatus: 'Pending',
      createdBy: `OPF Tester ${marker}`,
      renewalDate: '2027-10-13',
      ...overrides,
    }).forEach(([key, value]) => {
      if (value !== null && value !== undefined) body.append(key, String(value));
    });
    if (withFiles) {
      const pdf = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
      body.append('poFile', pdf, `po-${marker}.pdf`);
      body.append('customerPOFile', pdf, `customer-po-${marker}.pdf`);
      body.append('additionalDocument', pdf, `additional-${marker}.pdf`);
      body.append('uploadedDocuments', pdf, `upload-${marker}.pdf`);
    }
    return body;
  };

  assert.equal(process.env.MONGO_URI, '');
  assert.equal((await request('/health')).status, 200);
  assert.equal((await request('/opf', { token: '' })).status, 401);
  assert.equal((await request('/opf', { token: readOnlyToken, method: 'POST', body: form() })).status, 403);

  const invalid = await request('/opf', { method: 'POST', body: form({ quotationNumber: '', product: '' }) });
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).message, /Quotation Number is required/);

  const invalidStatus = await request('/opf', {
    method: 'POST',
    body: form({ approvalStatus: 'Unapproved' }),
  });
  assert.equal(invalidStatus.status, 400);
  assert.match((await invalidStatus.json()).message, /approvalStatus/i);

  const createdResponse = await request('/opf', { method: 'POST', body: form({ approvalStatus: 'Approved' }, true) });
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).data;
  opfIds.push(created._id);
  for (const document of [created.poFile, created.customerPOFile, created.additionalDocument, ...created.uploadedDocuments]) {
    assert.ok(document.filePath.startsWith('/uploads/'));
    uploadedPaths.push(path.join(__dirname, '..', document.filePath.replace(/^\/+/, '')));
  }
  assert.match(created.opfNo, /^OPF\d{4}-\d{2}\/\d{3,}$/);
  assert.equal(created.approvalStatus, 'Approved');
  assert.equal(created.uploadedDocuments.length, 1);
  const reportRows = OPF.find({ createdBy: new RegExp(`^OPF Tester ${marker}$`, 'i') })
    .select('createdBy createdDate customerName product quantity unitPrice vendorPrice revenue margin')
    .sort({ createdDate: -1 })
    .lean();
  assert.ok(reportRows.some((row) => row._id === created._id));

  const secondResponse = await request('/opf', { method: 'POST', body: form() });
  assert.equal(secondResponse.status, 201);
  const second = (await secondResponse.json()).data;
  opfIds.push(second._id);
  assert.notEqual(second.opfNo, created.opfNo);

  const listResponse = await request(`/opf?search=${encodeURIComponent(marker)}&createdBy=${encodeURIComponent(`OPF Tester ${marker}`)}&approvalStatus=Approved&product=Networking&page=1&limit=1`);
  assert.equal(listResponse.status, 200);
  const listed = await listResponse.json();
  assert.equal(listed.pagination.total, 1);
  assert.equal(listed.data[0]._id, created._id);
  assert.equal(listed.data[0].revenue, 750);
  assert.equal(listed.data[0].margin, 450);

  const detailResponse = await request(`/opf/${created._id}`);
  assert.equal(detailResponse.status, 200);
  const detail = (await detailResponse.json()).data;
  assert.equal(detail.customerPOFile.fileName, `customer-po-${marker}.pdf`);
  assert.equal(detail.additionalDocument.mimeType, 'application/pdf');
  const stored = db.prepare('SELECT data_json, uploaded_documents_json FROM opfs WHERE id = ?').get(created._id);
  assert.equal(JSON.parse(stored.data_json).quotationId, `QID-${marker}`);
  assert.equal(JSON.parse(stored.uploaded_documents_json)[0].fileName, `upload-${marker}.pdf`);

  const updatedResponse = await request(`/opf/${created._id}`, {
    method: 'PUT',
    body: form({ quotationNumber: `QUOTE-UPDATED-${marker}`, approvalStatus: 'Under Review', quantity: '4' }),
  });
  assert.equal(updatedResponse.status, 200);
  const updated = (await updatedResponse.json()).data;
  assert.equal(updated.quotationNumber, `QUOTE-UPDATED-${marker}`);
  assert.equal(updated.approvalStatus, 'Under Review');
  assert.equal(updated.poFile.fileName, `po-${marker}.pdf`);
  assert.equal((await request(`/opf/${created._id}`, { token: readOnlyToken, method: 'DELETE' })).status, 403);

  const invalidUpdate = await request(`/opf/${created._id}`, {
    method: 'PUT',
    body: form({ approvalStatus: 'Cancelled' }),
  });
  assert.equal(invalidUpdate.status, 400);

  const invalidPdf = await request(`/opf/${created._id}/send-pdf`, {
    method: 'POST',
    body: JSON.stringify({ recipientEmail: 'invalid', pdfData: 'YWJj' }),
  });
  assert.equal(invalidPdf.status, 400);
  assert.equal((await request(`/opf/${created._id}/send-pdf`, {
    method: 'POST',
    body: JSON.stringify({ recipientEmail: 'valid@example.test' }),
  })).status, 400);

  const deletedResponse = await request(`/opf/${second._id}`, { method: 'DELETE' });
  assert.equal(deletedResponse.status, 200);
  assert.equal((await request(`/opf/${second._id}`)).status, 404);
  db.prepare('DELETE FROM opfs WHERE id = ?').run(second._id);
  opfIds.splice(opfIds.indexOf(second._id), 1);
});
