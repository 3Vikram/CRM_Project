process.env.JWT_SECRET = 'employee-auth-api-test-only-secret';
process.env.MONGO_URI = '';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const test = require('node:test');

const testPassword = 'Employee-Test-Password-42!';
const testAdminEmail = `admin-${randomUUID()}@example.test`;
process.env.PORT = '0';

const { app, startServer } = require('../server');
const { authMiddleware, requirePermission } = require('../middleware/authMiddleware');
const { db, dbPath } = require('../utils/salesDatabase');

test('SQLite-backed Sales auth and Employee APIs work with MongoDB disconnected', async (t) => {
  const testAdminId = `admin-auth-test-${randomUUID()}`;
  db.prepare('INSERT INTO admin_users (id, email, password_hash) VALUES (?, ?, ?)')
    .run(testAdminId, testAdminEmail, bcrypt.hashSync(testPassword, 4));
  t.after(() => db.prepare('DELETE FROM admin_users WHERE id = ?').run(testAdminId));

  const server = startServer();
  await new Promise((resolve, reject) => {
    if (server.listening) return resolve();
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  assert.equal(process.env.MONGO_URI, '');
  const expectedDbPath = process.env.SALES_DB_PATH
    ? path.resolve(process.env.SALES_DB_PATH)
    : path.resolve(__dirname, '..', '..', '..', 'database', 'sales.db');
  assert.equal(dbPath, expectedDbPath);
  assert.notEqual(dbPath, path.resolve(__dirname, '..', '..', '..', 'database', 'inventory.db'));

  app.get('/api/__test/permissions/leads', authMiddleware, requirePermission('leads', 'view'), (_req, res) => {
    res.status(200).json({ success: true });
  });
  app.get('/api/__test/permissions/quotations', authMiddleware, requirePermission('quotations', 'view'), (_req, res) => {
    res.status(200).json({ success: true });
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const request = (route, { token, ...options } = {}) => fetch(`${baseUrl}${route}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const createdIds = [];
  const createEmployee = async (overrides = {}) => {
    const response = await request('/employees', {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify({
        employeeName: `SQLite Employee ${marker}`,
        email: `${marker}-${createdIds.length}@example.test`,
        password: testPassword,
        role: 'Sales Executive',
        status: 'Active',
        crudOption: ['View', 'Create', 'Edit'],
        modulesOption: ['Leads'],
        ...overrides,
      }),
    });
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.success, true);
    assert.ok(result.data._id);
    assert.equal(Object.hasOwn(result.data, 'passwordHash'), false);
    createdIds.push(result.data._id);
    return result.data;
  };

  const marker = randomUUID();
  let adminToken;

  try {
    const healthResponse = await request('/health');
    assert.equal(healthResponse.status, 200);

    const adminLoginResponse = await request('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ email: testAdminEmail, password: testPassword }),
    });
    assert.equal(adminLoginResponse.status, 200);
    adminToken = (await adminLoginResponse.json()).token;
    assert.ok(adminToken);

    const invalidAdminLogin = await request('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ email: testAdminEmail, password: 'incorrect-admin-password' }),
    });
    assert.equal(invalidAdminLogin.status, 401);

    const unknownAdminLogin = await request('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ email: 'missing-admin@example.test', password: testPassword }),
    });
    assert.equal(unknownAdminLogin.status, 401);

    const unlinkedAdminProfile = await request('/auth/me', { token: adminToken });
    assert.equal(unlinkedAdminProfile.status, 200);
    assert.equal((await unlinkedAdminProfile.json()).data.canUpdate, false);
    const unlinkedAdminUpdate = await request('/auth/me', {
      method: 'PUT',
      token: adminToken,
      body: new FormData(),
    });
    assert.equal(unlinkedAdminUpdate.status, 404);

    const missingAuthResponse = await request('/employees');
    assert.equal(missingAuthResponse.status, 401);

    const active = await createEmployee();
    const duplicateEmailResponse = await request('/employees', {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify({
        employeeName: 'Duplicate Employee',
        email: active.email,
        password: testPassword,
      }),
    });
    assert.equal(duplicateEmailResponse.status, 409);
    const inactive = await createEmployee({
      email: `${marker}-inactive@example.test`,
      status: 'Inactive',
    });
    assert.ok(inactive._id);

    const employeeListResponse = await request(`/employees?search=${encodeURIComponent(marker)}&page=1&limit=1`, {
      token: adminToken,
    });
    assert.equal(employeeListResponse.status, 200);
    const employeeList = await employeeListResponse.json();
    assert.equal(employeeList.success, true);
    assert.equal(employeeList.data.length, 1);
    assert.equal(employeeList.pagination.total, 2);
    assert.equal(employeeList.pagination.page, 1);
    assert.equal(employeeList.pagination.limit, 1);

    const employeeLoginResponse = await request('/auth/employee-login', {
      method: 'POST',
      body: JSON.stringify({ email: active.email, password: testPassword }),
    });
    assert.equal(employeeLoginResponse.status, 200);
    const employeeSession = await employeeLoginResponse.json();
    const employeeToken = employeeSession.token;
    assert.ok(employeeToken);
    assert.equal(employeeSession.user.permissions.leads.view, true);
    assert.equal(employeeSession.user.permissions.quotations.view, false);

    const wrongPasswordResponse = await request('/auth/employee-login', {
      method: 'POST',
      body: JSON.stringify({ email: active.email, password: 'not-the-password' }),
    });
    assert.equal(wrongPasswordResponse.status, 401);
    const inactiveLoginResponse = await request('/auth/employee-login', {
      method: 'POST',
      body: JSON.stringify({ email: inactive.email, password: testPassword }),
    });
    assert.equal(inactiveLoginResponse.status, 401);

    assert.equal((await request('/__test/permissions/leads', { token: employeeToken })).status, 200);
    assert.equal((await request('/__test/permissions/quotations', { token: employeeToken })).status, 403);
    assert.equal((await request('/employees', { token: employeeToken })).status, 403);

    const profileResponse = await request('/auth/me', { token: employeeToken });
    assert.equal(profileResponse.status, 200);
    assert.equal((await profileResponse.json()).data.email, active.email);

    const profileForm = new FormData();
    profileForm.set('contactNo', '555-0100');
    profileForm.set('dateOfJoin', '2025-03-04');
    profileForm.set('dateOfBirth', '1990-07-08');
    profileForm.set('signature', 'SQLite profile test');
    profileForm.set('password', 'Updated-Employee-Password-43!');
    profileForm.set('confirmPassword', 'Updated-Employee-Password-43!');
    const profileUpdateResponse = await request('/auth/me', {
      method: 'PUT',
      token: employeeToken,
      body: profileForm,
    });
    assert.equal(profileUpdateResponse.status, 200);
    const profileUpdate = (await profileUpdateResponse.json()).data;
    assert.equal(profileUpdate.contactNo, '555-0100');
    assert.match(profileUpdate.dateOfJoin, /^2025-03-04/);
    assert.match(profileUpdate.dateOfBirth, /^1990-07-08/);
    assert.equal(profileUpdate.signature, 'SQLite profile test');

    assert.equal((await request('/auth/employee-login', {
      method: 'POST',
      body: JSON.stringify({ email: active.email, password: testPassword }),
    })).status, 401);
    assert.equal((await request('/auth/employee-login', {
      method: 'POST',
      body: JSON.stringify({ email: active.email, password: 'Updated-Employee-Password-43!' }),
    })).status, 200);

    const employeeUpdateResponse = await request(`/employees/${encodeURIComponent(active._id)}`, {
      method: 'PUT',
      token: adminToken,
      body: JSON.stringify({
        employeeName: active.employeeName,
        email: active.email,
        department: 'Enterprise Sales',
        status: 'On Leave',
        crudOption: ['View'],
        modulesOption: ['Leads'],
      }),
    });
    assert.equal(employeeUpdateResponse.status, 200);
    const employeeUpdate = (await employeeUpdateResponse.json()).data;
    assert.equal(employeeUpdate.department, 'Enterprise Sales');
    assert.equal(employeeUpdate.status, 'On Leave');
    assert.equal(Object.hasOwn(employeeUpdate, 'passwordHash'), false);

    const contactsResponse = await request('/contacts', { token: adminToken });
    assert.equal(contactsResponse.status, 200);
    const contactsBody = await contactsResponse.json();
    assert.equal(contactsBody.success, true);
    assert.ok(Array.isArray(contactsBody.data));

    const deleteResponse = await request(`/employees/${encodeURIComponent(inactive._id)}`, {
      method: 'DELETE',
      token: adminToken,
    });
    assert.equal(deleteResponse.status, 200);
    assert.equal((await request(`/employees/${encodeURIComponent(inactive._id)}`, {
      token: adminToken,
    })).status, 404);
  } finally {
    if (createdIds.length) {
      const placeholders = createdIds.map(() => '?').join(', ');
      db.prepare(`DELETE FROM employees WHERE id IN (${placeholders})`).run(...createdIds);
      assert.equal(
        db.prepare(`SELECT COUNT(*) AS total FROM employees WHERE id IN (${placeholders})`).get(...createdIds).total,
        0,
      );
    }
  }
});
