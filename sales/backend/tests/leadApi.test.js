process.env.JWT_SECRET = 'lead-api-test-only-secret';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const jwt = require('jsonwebtoken');
const test = require('node:test');
const leadRoutes = require('../routes/leadRoutes');
const calendarRoutes = require('../routes/calendarRoutes');
const { authMiddleware, JWT_SECRET, requirePermission } = require('../middleware/authMiddleware');
const Lead = require('../models/Lead');
const { db } = require('../utils/salesDatabase');

test('Lead API and repository preserve validation, CRUD, permissions, and engagement in sales.db', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api/leads', authMiddleware, leadRoutes);
  app.use('/api/calendar', authMiddleware, requirePermission('calendar'), calendarRoutes);
  const server = app.listen(0);
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  const baseUrl = `http://127.0.0.1:${server.address().port}/api/leads`;
  const adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET);
  const leadViewerToken = jwt.sign({
    role: 'sales',
    permissions: { leads: { view: true }, quotations: { view: false } },
  }, JWT_SECRET);
  const quotationViewerToken = jwt.sign({
    role: 'sales',
    permissions: { leads: { view: false }, quotations: { view: true } },
  }, JWT_SECRET);
  const request = (url, options = {}, token = adminToken) => fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const marker = `LeadApiTest${Date.now()}`;
  const createdIds = new Set();
  let importedId = '';
  let quotationPrefix = '';
  let quotationId = '';

  try {
    const invalidResponse = await request(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ companyName: `${marker} invalid`, email: 'not-an-email' }),
    });
    assert.equal(invalidResponse.status, 400);
    assert.match((await invalidResponse.json()).message, /valid email address/i);

    const createdResponse = await request(baseUrl, {
      method: 'POST',
      body: JSON.stringify({
        companyName: `${marker} Alpha`,
        email: '  ALPHA@example.com ',
        leadId: 'CLIENT-SUPPLIED-ID',
        source: 'Manual',
        followUpDate: '2026-10-15',
      }),
    });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()).data;
    assert.match(created._id, /^[0-9a-f-]{36}$/i);
    assert.match(created.leadId, /^LD-\d+$/);
    assert.notEqual(created.leadId, 'CLIENT-SUPPLIED-ID');
    assert.equal(created.email, 'alpha@example.com');
    assert.deepEqual(created.engagement, {
      emailOpens: 0,
      linkClicks: 0,
      brochureDownloads: 0,
      replies: 0,
      websiteVisits: 0,
    });
    createdIds.add(created._id);

    const secondResponse = await request(baseUrl, {
      method: 'POST',
      body: JSON.stringify({
        companyName: `${marker} Beta`,
        email: 'beta@example.com',
        sourceOfLead: 'Referral',
      }),
    });
    assert.equal(secondResponse.status, 201);
    const second = (await secondResponse.json()).data;
    createdIds.add(second._id);
    assert.notEqual(second.leadId, created.leadId);

    const listResponse = await request(`${baseUrl}?search=${encodeURIComponent(marker)}&page=1&limit=1&sortBy=companyName&sortOrder=asc`);
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json();
    assert.equal(list.data.length, 1);
    assert.equal(list.data[0]._id, created._id);
    assert.deepEqual(list.pagination, { total: 2, page: 1, limit: 1, totalPages: 2 });
    const sourceFiltered = await (await request(`${baseUrl}?search=${encodeURIComponent(marker)}&source=Referral`)).json();
    assert.deepEqual(sourceFiltered.data.map((lead) => lead._id), [second._id]);

    const updateResponse = await request(`${baseUrl}/${created._id}`, {
      method: 'PUT',
      body: JSON.stringify({ leadStatus: 'Qualified', notes: [{ message: 'Call back', createdBy: 'Tester' }] }),
    });
    assert.equal(updateResponse.status, 200);
    const updated = (await updateResponse.json()).data;
    assert.equal(updated.leadStatus, 'Qualified');
    assert.equal(updated.timeline[0].title, 'Status updated');
    assert.equal(updated.notes[0].message, 'Call back');

    const calendarComplete = await request(`${baseUrl.replace('/leads', '/calendar/events/Leads')}/${created._id}/complete`, {
      method: 'PATCH',
    });
    assert.equal(calendarComplete.status, 200);
    const calendarDelete = await request(`${baseUrl.replace('/leads', '/calendar/events/Leads')}/${created._id}`, {
      method: 'DELETE',
      body: JSON.stringify({ sourceField: 'followUpDate' }),
    });
    assert.equal(calendarDelete.status, 200);
    const afterCalendar = Lead.findById(created._id);
    assert.equal(afterCalendar.calendarStatus, 'Completed');
    assert.equal(afterCalendar.followUpDate, '');

    const moveResponse = await request(`${baseUrl}/move-activity`, {
      method: 'POST',
      body: JSON.stringify({ id: created._id }),
    });
    assert.equal(moveResponse.status, 200);
    assert.equal((await moveResponse.json()).data.leadStatus, 'Follow-up');

    const funnelResponse = await request(`${baseUrl}/move-funnel`, {
      method: 'POST',
      body: JSON.stringify({ id: created._id }),
    });
    assert.equal(funnelResponse.status, 200);
    assert.equal((await funnelResponse.json()).data.leadStatus, 'Qualified');

    const generatedQuotationResponse = await request(`${baseUrl}/generate-quotation`, {
      method: 'POST',
      body: JSON.stringify({ id: created._id }),
    });
    assert.equal(generatedQuotationResponse.status, 200);
    assert.equal((await generatedQuotationResponse.json()).data.leadStatus, 'Proposal Sent');

    const permissionQuotation = Lead.create({
      companyName: `${marker} Quotation`,
      quotationId: `${marker}/Q/001`,
      leadStatus: 'Proposal Sent',
    });
    quotationId = permissionQuotation._id;
    createdIds.add(quotationId);
    assert.equal((await request(`${baseUrl}/${quotationId}`, {}, leadViewerToken)).status, 403);
    assert.equal((await request(`${baseUrl}/${quotationId}`, {}, quotationViewerToken)).status, 200);
    const leadOnlyList = await (await request(`${baseUrl}?search=${encodeURIComponent(marker)}`, {}, leadViewerToken)).json();
    assert.equal(leadOnlyList.data.some((lead) => lead._id === quotationId), false);
    const quotationOnlyList = await (await request(`${baseUrl}?search=${encodeURIComponent(marker)}`, {}, quotationViewerToken)).json();
    assert.deepEqual(quotationOnlyList.data.map((lead) => lead._id), [quotationId]);

    const mailEmail = `${marker.toLowerCase()}@example.com`;
    let mailLead;
    for (let index = 0; index < 3; index += 1) {
      const eventResponse = await request(`${baseUrl}/mailcampaign/open-event`, {
        method: 'POST',
        body: JSON.stringify({ email: mailEmail, companyName: marker, eventType: 'open' }),
      });
      assert.equal(eventResponse.status, 200);
      mailLead = (await eventResponse.json()).data;
    }
    assert.equal(mailLead.openCount, 3);
    assert.match(mailLead.leadId, /^LD-\d+$/);
    createdIds.add(mailLead._id);
    const persistedMailLead = Lead.findById(mailLead._id);
    assert.equal(persistedMailLead.emailOpenCount, 3);
    assert.equal(persistedMailLead.leadScore, 20);
    assert.equal(Lead.findValidEmailRecipients(/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.source)
      .some((item) => item.email === mailEmail), true);

    quotationPrefix = `${marker}/2026-27/`;
    assert.equal(Lead.nextQuotationId(quotationPrefix), `${quotationPrefix}001`);
    assert.equal(Lead.nextQuotationId(quotationPrefix), `${quotationPrefix}002`);

    const importId = `mongo-copy-${marker}`;
    importedId = importId;
    const importedLeadId = `MONGO-COPY-${Date.now()}`;
    const imported = Lead.importRecord({
      _id: importId,
      leadId: importedLeadId,
      companyName: `${marker} Imported`,
      email: 'imported@example.com',
      createdBy: 'Migration',
      createdDate: new Date('2025-01-02T03:04:05.000Z'),
      engagement: { emailOpens: 4, linkClicks: 2 },
      timeline: [{ title: 'Imported timeline entry', description: 'Preserved', createdAt: new Date() }],
      notes: [{ message: 'Imported note', createdBy: 'Migration' }],
      products: [{ productName: 'Imported product', quantity: 2 }],
      quotationDetails: { subject: 'Imported quote' },
      createdAt: new Date('2025-01-02T03:04:05.000Z'),
    });
    assert.equal(imported.status, 'inserted');
    createdIds.add(importId);
    assert.equal(Lead.findById(importId).products[0].productName, 'Imported product');
    assert.equal(Lead.findById(importId).createdAt, '2025-01-02T03:04:05.000Z');
    assert.equal(Lead.importRecord({
      _id: importId,
      leadId: importedLeadId,
      companyName: `${marker} Imported`,
    }).status, 'exists');
    assert.equal(Lead.inspectImportRecord({
      _id: importId,
      leadId: importedLeadId,
      companyName: `${marker} Changed`,
    }).identical, false);
    assert.equal(Lead.importRecord({
      _id: `${importId}-duplicate`,
      leadId: importedLeadId,
      companyName: `${marker} Duplicate`,
      email: 'duplicate@example.com',
    }).status, 'conflict');

    const reportLeads = Lead.findForReport({
      createdBy: '',
      customerName: `${marker} Imported`,
      product: 'Imported product',
    });
    assert.equal(reportLeads.length, 1);
    assert.equal(reportLeads[0]._id, importId);

    const usageStart = new Date('2025-01-02T00:00:00.000Z');
    const usageEnd = new Date('2025-01-03T00:00:00.000Z');
    assert.equal(Lead.findForUsage({
      createdBy: 'Migration',
      createdDateStart: usageStart.toISOString(),
      createdDateEnd: usageEnd.toISOString(),
    }).length, 1);

    const deleteResponse = await request(`${baseUrl}/${created._id}`, { method: 'DELETE' });
    assert.equal(deleteResponse.status, 200);
    createdIds.delete(created._id);
    assert.equal((await request(`${baseUrl}/${created._id}`)).status, 404);
  } finally {
    for (const id of createdIds) {
      db.prepare('DELETE FROM leads WHERE id = ?').run(id);
    }
    if (importedId) db.prepare('DELETE FROM leads WHERE id = ?').run(importedId);
    if (quotationPrefix) {
      db.prepare('DELETE FROM quotation_sequences WHERE prefix = ?').run(quotationPrefix);
    }
  }
});
