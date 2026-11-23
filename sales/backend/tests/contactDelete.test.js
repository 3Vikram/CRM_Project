const test = require('node:test');
const assert = require('node:assert/strict');
const Contact = require('../models/Contact');
const { deleteContact } = require('../controllers/contactController');

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

test('admin can delete a contact owned by another employee', async () => {
  const originalFindOneAndDelete = Contact.findOneAndDelete;
  const contactId = '507f1f77bcf86cd799439011';
  let query;
  Contact.findOneAndDelete = async (filter) => {
    query = filter;
    return { _id: contactId };
  };
  const res = makeResponse();

  try {
    await deleteContact({
      params: { id: contactId },
      user: { id: '507f191e810c19729de860ea', role: 'admin' },
    }, res);

    assert.deepEqual(query, { $and: [{ _id: contactId }, {}] });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, 'Contact deleted successfully');
  } finally {
    Contact.findOneAndDelete = originalFindOneAndDelete;
  }
});

test('delete rejects a malformed contact ID without querying the database', async () => {
  const originalFindOneAndDelete = Contact.findOneAndDelete;
  Contact.findOneAndDelete = async () => {
    assert.fail('Invalid contact IDs must not be queried.');
  };
  const res = makeResponse();

  try {
    await deleteContact({
      params: { id: 'not-an-object-id' },
      user: { id: 'employee-1', name: 'Riya Shah', role: 'employee' },
    }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Invalid contact ID.');
  } finally {
    Contact.findOneAndDelete = originalFindOneAndDelete;
  }
});

test('delete returns a meaningful not-found response', async () => {
  const originalFindOneAndDelete = Contact.findOneAndDelete;
  Contact.findOneAndDelete = async () => null;
  const res = makeResponse();

  try {
    await deleteContact({
      params: { id: '507f1f77bcf86cd799439011' },
      user: { id: '507f191e810c19729de860ea', role: 'admin' },
    }, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Contact not found');
  } finally {
    Contact.findOneAndDelete = originalFindOneAndDelete;
  }
});
