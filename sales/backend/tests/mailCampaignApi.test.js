process.env.JWT_SECRET = 'mail-campaign-api-test-only-secret';
process.env.MONGO_URI = '';
process.env.PORT = '0';
process.env.CAMPAIGN_SCHEDULER_ENABLED = 'false';
process.env.MAIL_TRACKING_BASE_URL = 'https://tracking.example.test';
process.env.TRACKING_DIAGNOSTICS = 'true';
process.env.EMAIL_USER = 'campaign-test@example.test';
process.env.EMAIL_PASS = 'mock-transport-only';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const jwt = require('jsonwebtoken');
const test = require('node:test');
const path = require('node:path');
const { app, startServer } = require('../server');
const MailCampaign = require('../models/MailCampaign');
const EmailLog = require('../models/EmailLog');
const { processScheduledCampaigns } = require('../controllers/mailCampaignController');
const { db } = require('../utils/salesDatabase');
const { JWT_SECRET } = require('../middleware/authMiddleware');

test('Mail Campaign API persists campaigns, sends through an isolated transport, schedules, and tracks email logs', async (t) => {
  const server = startServer();
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const campaignsUrl = `${baseUrl}/api/mail-campaigns`;
  const adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET);
  const noPermissionToken = jwt.sign({ role: 'sales' }, JWT_SECRET);
  const marker = `MailCampaignTest${Date.now()}`;
  const employeeId = `${marker}-employee`;
  const batchId = `${marker}-batch`;
  const contactId = `${marker}-contact`;
  const createdCampaignIds = [];
  const sentMessages = [];
  const previousTransport = app.locals.mailCampaignTransport;
  app.locals.mailCampaignTransport = {
    verify: async () => true,
    sendMail: async (message) => {
      sentMessages.push(message);
      return {
        accepted: [message.to],
        rejected: [],
        pending: [],
        messageId: `mock-${sentMessages.length}`,
        response: 'mock SMTP accepted',
      };
    },
  };
  const request = (url, options = {}, token = adminToken) => fetch(url, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  db.prepare(`
    INSERT INTO employees (id, employee_name, full_name, email, department, role, status)
    VALUES (?, ?, ?, ?, 'Sales', 'Sales Executive', 'Active')
  `).run(employeeId, `${marker} Employee`, `${marker} Employee`, `${marker.toLowerCase()}@example.test`);
  db.prepare(`
    INSERT INTO customer_batches (
      id, batch_name, batch_number, employee_id, employee_email, employee_name,
      customer_count, created_date
    ) VALUES (?, 'Batch 1', 1, ?, ?, ?, 1, ?)
  `).run(batchId, employeeId, `${marker.toLowerCase()}@example.test`, `${marker} Employee`, yesterday);
  db.prepare(`
    INSERT INTO contacts (
      id, contact_name, contact_number, email, employee_id, employee_email,
      employee_name, batch_name, batch_number, batch_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Batch 1', 1, ?)
  `).run(
    contactId,
    `${marker} Contact`,
    `555${String(Date.now()).slice(-7)}`,
    `${marker.toLowerCase()}@example.test`,
    employeeId,
    `${marker.toLowerCase()}@example.test`,
    `${marker} Employee`,
    batchId,
  );

  try {
    assert.equal((await request(campaignsUrl, {}, '')).status, 401);
    assert.equal((await request(campaignsUrl, {}, noPermissionToken)).status, 403);

    const draftResponse = await request(campaignsUrl, {
      method: 'POST',
      body: JSON.stringify({
        campaignName: `${marker} draft`,
        subject: 'SQLite campaign draft',
        campaignBody: '<p>Draft body</p>',
        status: 'Draft',
      }),
    });
    assert.equal(draftResponse.status, 201);
    const draft = (await draftResponse.json()).data;
    createdCampaignIds.push(draft._id);
    assert.match(draft.campaignId, /^CMP-\d+$/);
    assert.equal(draft.campaignBody, '<p>Draft body</p>');

    const updateResponse = await request(`${campaignsUrl}/${draft._id}`, {
      method: 'PUT',
      body: JSON.stringify({ subject: 'Updated draft subject', tags: ['SQLite'] }),
    });
    assert.equal(updateResponse.status, 200);
    assert.equal((await updateResponse.json()).data.subject, 'Updated draft subject');

    const filteredResponse = await request(`${campaignsUrl}?search=${encodeURIComponent(marker)}&status=Draft&page=1&limit=10`);
    assert.equal(filteredResponse.status, 200);
    const filtered = await filteredResponse.json();
    assert.ok(filtered.data.some((campaign) => campaign._id === draft._id));
    assert.ok(filtered.pagination.total >= 1);

    const scheduleForm = new FormData();
    Object.entries({
      campaignName: `${marker} scheduled`,
      subject: 'Scheduled SQLite campaign',
      campaignBody: '<p>Scheduled test body</p>',
      status: 'Scheduled',
      scheduledDate: yesterday,
      scheduledTime: '00:00',
      batchId,
      employeeId,
      campaignGroups: JSON.stringify([{
        groupName: 'Selected contacts',
        contactIds: [contactId],
        subject: 'Scheduled SQLite campaign',
        message: '<p>Scheduled test body</p>',
      }]),
    }).forEach(([name, value]) => scheduleForm.append(name, value));
    scheduleForm.append('attachments', new Blob(['mock campaign attachment'], { type: 'application/pdf' }), 'mock.pdf');
    const scheduleResponse = await request(campaignsUrl, { method: 'POST', body: scheduleForm });
    assert.equal(scheduleResponse.status, 201);
    const scheduled = (await scheduleResponse.json()).data;
    createdCampaignIds.push(scheduled._id);
    assert.equal(scheduled.recipientCount, 1);
    assert.equal(scheduled.status, 'Scheduled');

    await processScheduledCampaigns(baseUrl);
    const sentCampaign = MailCampaign.getById(scheduled._id);
    assert.equal(sentCampaign.status, 'Sent');
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].to, `${marker.toLowerCase()}@example.test`);
    assert.equal(sentMessages[0].attachments.length, 1);
    assert.equal(fs.existsSync(sentMessages[0].attachments[0].path), true);
    assert.match(sentMessages[0].html, /track\/open\//);

    const emailLog = EmailLog.getByTrackingId(
      db.prepare('SELECT tracking_id FROM email_logs WHERE campaign_id = ?').get(scheduled.campaignId).tracking_id,
    );
    assert.equal(emailLog.status, 'Sent');
    assert.equal(emailLog.recipientEmail, `${marker.toLowerCase()}@example.test`);
    assert.ok(emailLog.trackingId);

    const reportResponse = await request(`${campaignsUrl}/${scheduled._id}/report`);
    assert.equal(reportResponse.status, 200);
    assert.equal((await reportResponse.json()).data[0].sentTo, emailLog.recipientEmail);

    const openResponse = await request(`${campaignsUrl}/track/open/${emailLog.trackingId}`);
    assert.equal(openResponse.status, 200);
    assert.match(openResponse.headers.get('content-type'), /image\/gif/);
    const clickResponse = await request(
      `${campaignsUrl}/tracking/click/${emailLog.trackingId}?url=${encodeURIComponent('https://example.test/landing')}`,
      { redirect: 'manual' },
    );
    assert.equal(clickResponse.status, 302);
    assert.equal(clickResponse.headers.get('location'), 'https://example.test/landing');

    const diagnosticResponse = await request(`${campaignsUrl}/track/diagnostic/${emailLog.trackingId}`);
    assert.equal(diagnosticResponse.status, 200);
    const diagnostic = await diagnosticResponse.json();
    assert.equal(diagnostic.emailLog.openCount, 1);
    assert.equal(diagnostic.emailLog.clickCount, 1);
    assert.equal(diagnostic.campaign.opens, 1);
    assert.equal(diagnostic.campaign.clicks, 1);
    assert.equal(EmailLog.getByTrackingId(emailLog.trackingId).openCount, 1);

    const invalidClick = await request(`${campaignsUrl}/track/click/${emailLog.trackingId}?url=javascript%3Aalert(1)`, {
      redirect: 'manual',
    });
    assert.equal(invalidClick.status, 400);

    const sentDeleteResponse = await request(`${campaignsUrl}/${scheduled._id}`, { method: 'DELETE' });
    assert.equal(sentDeleteResponse.status, 200);
    createdCampaignIds.splice(createdCampaignIds.indexOf(scheduled._id), 1);
    assert.equal(fs.existsSync(sentMessages[0].attachments[0].path), false);

    const deleteResponse = await request(`${campaignsUrl}/${draft._id}`, { method: 'DELETE' });
    assert.equal(deleteResponse.status, 200);
    assert.equal(MailCampaign.getById(draft._id), null);
    createdCampaignIds.splice(createdCampaignIds.indexOf(draft._id), 1);
  } finally {
    for (const id of createdCampaignIds) {
      const campaign = MailCampaign.getById(id);
      if (campaign) {
        const filePaths = [campaign.image, ...(campaign.attachments || [])]
          .filter((filePath) => typeof filePath === 'string' && filePath.startsWith('/uploads/mail-campaigns/'));
        MailCampaign.delete(id);
        filePaths.forEach((filePath) => {
          const absolutePath = path.join(__dirname, '..', filePath.replace(/^\/+/, ''));
          if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
        });
      }
    }
    db.prepare('DELETE FROM contacts WHERE id = ?').run(contactId);
    db.prepare('DELETE FROM customer_batches WHERE id = ?').run(batchId);
    db.prepare('DELETE FROM employees WHERE id = ?').run(employeeId);
    if (previousTransport === undefined) delete app.locals.mailCampaignTransport;
    else app.locals.mailCampaignTransport = previousTransport;
  }
});
