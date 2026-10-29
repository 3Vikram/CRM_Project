import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { inventoryCreatorFields, requireInventoryAuth } from '../src/routes/inventoryAuth.js';
import { InventoryEmployee } from '../src/models/InventoryEmployee.js';

const signToken = (secret, claims) => {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 60_000, ...claims })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

const createResponse = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test('inventory auth attaches authenticated identity and ignores body attribution', async () => {
  const secret = 'a'.repeat(40);
  process.env.INVENTORY_LOGIN_EMAIL = 'admin@example.test';
  process.env.INVENTORY_LOGIN_PASSWORD = 'test-password';
  process.env.INVENTORY_AUTH_SECRET = secret;
  const token = signToken(secret, {
    role: 'admin',
    email: 'admin@example.test',
  });
  const req = {
    body: { createdBy: 'Spoofed user', createdById: 'spoofed-id' },
    get: () => `Bearer ${token}`,
  };
  const response = createResponse();
  let nextCalled = false;

  await requireInventoryAuth(req, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(inventoryCreatorFields(req), { createdBy: 'Admin', createdById: 'admin' });
});

test('Inventory employee attribution uses the verified employee record name', async () => {
  const secret = 'b'.repeat(40);
  process.env.INVENTORY_LOGIN_EMAIL = 'admin@example.test';
  process.env.INVENTORY_LOGIN_PASSWORD = 'test-password';
  process.env.INVENTORY_AUTH_SECRET = secret;
  const originalFindById = InventoryEmployee.findById;
  InventoryEmployee.findById = async (id) => {
    assert.equal(id, 'employee-id');
    return { id, employeeName: 'Maya Nair', email: 'maya@example.test', isActive: true };
  };
  const token = signToken(secret, { role: 'employee', employeeId: 'employee-id' });
  const req = {
    body: { createdBy: 'Spoofed user', createdById: 'spoofed-id' },
    get: () => `Bearer ${token}`,
  };
  const response = createResponse();
  let nextCalled = false;

  try {
    await requireInventoryAuth(req, response, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.deepEqual(inventoryCreatorFields(req), {
      createdBy: 'Maya Nair',
      createdById: 'employee-id',
    });
  } finally {
    InventoryEmployee.findById = originalFindById;
  }
});
