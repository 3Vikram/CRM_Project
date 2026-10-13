process.env.JWT_SECRET = 'activity-api-test-only-secret';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const jwt = require('jsonwebtoken');
const test = require('node:test');
const path = require('node:path');
const activityRoutes = require('../routes/activityRoutes');
const calendarRoutes = require('../routes/calendarRoutes');
const { authMiddleware, JWT_SECRET, requirePermission } = require('../middleware/authMiddleware');
const Activity = require('../models/Activity');
const Lead = require('../models/Lead');
const { db, dbPath } = require('../utils/salesDatabase');

test('Activity API persists CRUD, filtering, pagination, and soft deletion in sales.db', async (t) => {
  const expectedDbPath = process.env.SALES_DB_PATH
    ? path.resolve(process.env.SALES_DB_PATH)
    : path.resolve(__dirname, '..', '..', '..', 'database', 'sales.db');
  assert.equal(dbPath, expectedDbPath);

  const app = express();
  app.use(express.json());
  app.use('/api/activities', authMiddleware, requirePermission('activities'), activityRoutes);
  app.use('/api/calendar', authMiddleware, requirePermission('calendar'), calendarRoutes);

  const server = app.listen(0);
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  const baseUrl = `http://127.0.0.1:${server.address().port}/api/activities`;
  const adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET);
  const noPermissionToken = jwt.sign({ role: 'sales' }, JWT_SECRET);
  const request = (url, options = {}, token = adminToken) => fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const today = new Date().toISOString().slice(0, 10);
  const marker = `ActivityApiTest${Date.now()}`;
  const linkedLead = Lead.create({ companyName: `${marker} lead` });
  let activityId = '';
  let deleted = false;

  try {
    assert.equal((await request(baseUrl, {}, '')).status, 401);
    assert.equal((await request(baseUrl, {}, noPermissionToken)).status, 403);

    const createResponse = await request(baseUrl, {
      method: 'POST',
      body: JSON.stringify({
        customerName: marker,
        leadId: linkedLead.leadId,
        activityType: 'Call',
        activityDate: today,
        followUpDate: today,
        product: 'SQLite test product',
        email: '  TEST@EXAMPLE.COM ',
        createdBy: marker,
      }),
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.success, true);
    assert.match(created.data.activityId, /^ACT-\d+$/);
    assert.equal(created.data.email, 'test@example.com');
    activityId = created.data._id;
    const updatedLead = Lead.findById(linkedLead._id);
    assert.equal(updatedLead.leadStatus, 'Follow-up Scheduled');
    assert.equal(updatedLead.timeline[0].title, 'Activity Created');

    const listResponse = await request(`${baseUrl}?search=${encodeURIComponent(marker)}&createdBy=${encodeURIComponent(marker)}&followUpPreset=custom-date&customFollowUpDate=${today}&page=1&limit=1`);
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json();
    assert.equal(list.success, true);
    assert.equal(list.data.length, 1);
    assert.equal(list.data[0]._id, activityId);
    assert.deepEqual(list.pagination, { total: 1, page: 1, limit: 1, totalPages: 1 });
    assert.equal(Activity.findActive().some((item) => item._id === activityId), true);
    const usageStart = new Date();
    usageStart.setHours(0, 0, 0, 0);
    const usageEnd = new Date(usageStart);
    usageEnd.setDate(usageEnd.getDate() + 1);
    assert.equal(Activity.findForUsage({
      createdByPattern: `^${marker}$`,
      createdDateStart: usageStart.toISOString(),
      createdDateEnd: usageEnd.toISOString(),
    }).length, 1);

    const readResponse = await request(`${baseUrl}/${encodeURIComponent(activityId)}`);
    assert.equal(readResponse.status, 200);
    assert.equal((await readResponse.json()).data.customerName, marker);

    const updateResponse = await request(`${baseUrl}/${encodeURIComponent(activityId)}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Completed', response: 'Positive' }),
    });
    assert.equal(updateResponse.status, 200);
    const updated = await updateResponse.json();
    assert.equal(updated.data.status, 'Completed');
    assert.equal(updated.data.response, 'Positive');
    assert.equal(updated.data.lastModifiedBy, 'Current User');

    const calendarCompleteResponse = await request(`${baseUrl.replace('/activities', '/calendar/events/Activities')}/${encodeURIComponent(activityId)}/complete`, {
      method: 'PATCH',
    });
    assert.equal(calendarCompleteResponse.status, 200);

    const calendarDeleteResponse = await request(`${baseUrl.replace('/activities', '/calendar/events/Activities')}/${encodeURIComponent(activityId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ sourceField: 'followUpDate' }),
    });
    assert.equal(calendarDeleteResponse.status, 200);
    const calendarUpdatedActivity = await (await request(`${baseUrl}/${encodeURIComponent(activityId)}`)).json();
    assert.equal(calendarUpdatedActivity.data.status, 'Completed');
    assert.equal(calendarUpdatedActivity.data.followUpDate, '');

    const deleteResponse = await request(`${baseUrl}/${encodeURIComponent(activityId)}`, { method: 'DELETE' });
    assert.equal(deleteResponse.status, 200);
    deleted = true;
    assert.equal((await request(`${baseUrl}/${encodeURIComponent(activityId)}`)).status, 404);

    const afterDeleteResponse = await request(`${baseUrl}?createdBy=${encodeURIComponent(marker)}`);
    assert.equal((await afterDeleteResponse.json()).pagination.total, 0);
  } finally {
    if (activityId && !deleted) {
      await request(`${baseUrl}/${encodeURIComponent(activityId)}`, { method: 'DELETE' });
    }
    if (activityId) db.prepare('DELETE FROM activities WHERE id = ?').run(activityId);
    db.prepare('DELETE FROM leads WHERE id = ?').run(linkedLead._id);
  }
});
