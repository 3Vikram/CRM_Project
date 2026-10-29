const test = require('node:test');
const assert = require('node:assert/strict');
const { creatorFields } = require('../utils/accessScope');
const Lead = require('../models/Lead');
const leadController = require('../controllers/leadController');

test('creator attribution comes from the authenticated user, not submitted fields', () => {
  const firstUser = creatorFields({
    user: { id: 'employee-1', name: 'Anaya Patel' },
    body: { createdBy: 'Rahul Sharma', createdById: 'employee-2' },
  });
  const secondUser = creatorFields({
    user: { id: 'employee-2', name: 'Rahul Sharma' },
    body: { createdBy: 'Anaya Patel', createdById: 'employee-1' },
  });

  assert.deepEqual(firstUser, { createdBy: 'Anaya Patel', createdById: 'employee-1' });
  assert.deepEqual(secondUser, { createdBy: 'Rahul Sharma', createdById: 'employee-2' });
});

test('Admin creator identity is preserved as the authenticated account', () => {
  assert.deepEqual(
    creatorFields({ user: { id: 'admin', name: 'Admin', role: 'admin' }, body: { createdBy: 'Spoofed' } }),
    { createdBy: 'Admin', createdById: 'admin' }
  );
});

test('creator attribution fails explicitly when the authenticated identity is incomplete', () => {
  assert.throws(
    () => creatorFields({ user: { role: 'employee' }, body: { createdBy: 'Spoofed' } }),
    /Authenticated creator identity is unavailable/
  );
});

test('Lead creation persists the authenticated creator and ignores spoofed request values', async () => {
  const originalFind = Lead.find;
  const originalCreate = Lead.create;
  const createdLeads = [];
  Lead.find = () => ({ lean: async () => [] });
  Lead.create = async (lead) => {
    createdLeads.push(lead);
    return lead;
  };
  const createRequest = (id, name, spoofedId, spoofedName) => ({
    user: { id, name, role: 'employee' },
    body: {
      companyName: 'Test Company',
      contactPerson: 'Test Contact',
      createdBy: spoofedName,
      createdById: spoofedId,
    },
  });
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

  try {
    const firstResponse = createResponse();
    const secondResponse = createResponse();
    await leadController.createLead(
      createRequest('employee-1', 'Anaya Patel', 'employee-2', 'Rahul Sharma'),
      firstResponse
    );
    await leadController.createLead(
      createRequest('employee-2', 'Rahul Sharma', 'employee-1', 'Anaya Patel'),
      secondResponse
    );

    assert.equal(firstResponse.statusCode, 201);
    assert.equal(secondResponse.statusCode, 201);
    assert.deepEqual(
      createdLeads.map(({ createdBy, createdById }) => ({ createdBy, createdById })),
      [
        { createdBy: 'Anaya Patel', createdById: 'employee-1' },
        { createdBy: 'Rahul Sharma', createdById: 'employee-2' },
      ]
    );
  } finally {
    Lead.find = originalFind;
    Lead.create = originalCreate;
  }
});
