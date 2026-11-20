const test = require('node:test');
const assert = require('node:assert/strict');
const Customer = require('../models/Customer');
const { customerDuplicateConditions, customerIdentityKeys } = require('../utils/customerDuplicates');
const { createCustomer } = require('../controllers/customerController');

const makeResponse = () => ({
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

test('duplicate keys normalize name whitespace, email casing, and phone punctuation', () => {
  const keys = customerIdentityKeys({
    companyName: '  Northstar   Technologies ',
    email: ' SALES@Northstar.example ',
    phone: '+91 (98765) 43210',
  });

  test('duplicate customer names match case-insensitively after trimming', () => {
    for (const name of ['Synov', 'SYNOV', 'synov', 'SyNoV', '  SyNoV  ']) {
      assert.ok(customerIdentityKeys({ companyName: name }).includes('name:synov'));
      const [condition] = customerDuplicateConditions({ companyName: name });
      assert.equal(condition.companyName.test('Synov'), true);
      assert.equal(condition.companyName.test('  sYnOv '), true);
    }
  });

  assert.deepEqual(keys, [
    'name:northstar technologies',
    'email:sales@northstar.example',
    'phone:919876543210',
  ]);
});

test('legacy duplicate lookup checks company/contact names, emails, and phone values', () => {
  const conditions = customerDuplicateConditions({
    companyName: ' Northstar  Technologies ',
    contacts: [{
      name: 'Riya Shah',
      email: ' Riya@Example.com ',
      phone: '+91 98765-43210',
    }],
  });

  assert.ok(conditions.some((condition) => condition.companyName?.test('northstar technologies')));
  assert.ok(conditions.some((condition) => condition['contacts.name']?.test(' Riya   Shah ')));
  assert.ok(conditions.some((condition) => condition['contacts.email']?.test('riya@example.com')));
  assert.ok(conditions.some((condition) => condition['contacts.phone']?.test('+91 98765 43210')));
});

test('customer duplicate keys are protected by a unique database index', () => {
  const duplicateIndex = Customer.schema.indexes().find(([fields, options]) =>
    fields.duplicateKeys === 1 && options.unique && options.sparse
  );
  assert.ok(duplicateIndex);
});

test('customer creation rejects a normalized duplicate and returns visible existing details', async () => {
  const originals = {
    find: Customer.find,
    findOne: Customer.findOne,
    create: Customer.create,
  };
  const existing = {
    _id: 'customer-1',
    customerId: 'CI-1',
    companyName: 'Synov',
    customerName: 'Synov',
  };
  let created = false;
  Customer.find = () => ({
    select() { return this; },
    sort() { return this; },
    lean: async () => [],
  });
  Customer.findOne = () => ({
    select() { return this; },
    lean: async () => existing,
  });
  Customer.create = async () => {
    created = true;
    throw new Error('Duplicate customer should not be inserted.');
  };
  const res = makeResponse();

  try {
    await createCustomer({
      user: { id: 'employee-1', name: 'Riya Shah', role: 'admin' },
      body: {
        companyName: ' sYnOv ',
        customerName: 'SyNoV',
      },
    }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.message, 'This customer is already created.');
    assert.equal(res.body.duplicateCustomer.customerId, 'CI-1');
    assert.equal(created, false);
  } finally {
    Customer.find = originals.find;
    Customer.findOne = originals.findOne;
    Customer.create = originals.create;
  }
});

test('customer creation saves a customer when no duplicate exists', async () => {
  const originals = {
    find: Customer.find,
    findOne: Customer.findOne,
    create: Customer.create,
  };
  let createdPayload;
  Customer.find = () => ({
    select() { return this; },
    sort() { return this; },
    lean: async () => [],
  });
  Customer.findOne = () => ({
    select() { return this; },
    lean: async () => null,
  });
  Customer.create = async (payload) => {
    createdPayload = payload;
    return payload;
  };
  const res = makeResponse();

  try {
    await createCustomer({
      user: { id: 'employee-1', name: 'Riya Shah', role: 'admin' },
      body: {
        companyName: 'Brightline Systems',
        customerName: 'Anaya Patel',
        email: 'anaya@example.com',
        phone: '9876543210',
        sourceLeadId: 'spoofed-lead-id',
        contacts: [{ name: 'Anaya Patel', email: 'anaya@example.com', phone: '9876543210' }],
      },
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(createdPayload.customerId, 'CI-1');
    assert.ok(createdPayload.duplicateKeys.includes('email:anaya@example.com'));
    assert.ok(createdPayload.duplicateKeys.includes('phone:9876543210'));
    assert.equal(createdPayload.sourceLeadId, undefined);
  } finally {
    Customer.find = originals.find;
    Customer.findOne = originals.findOne;
    Customer.create = originals.create;
  }
});
