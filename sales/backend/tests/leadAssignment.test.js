const test = require('node:test');
const assert = require('node:assert/strict');
const Lead = require('../models/Lead');
const Activity = require('../models/Activity');
const Customer = require('../models/Customer');
const Employee = require('../models/Employee');
const { convertToCustomer, moveToActivity } = require('../controllers/leadController');
const { _getLinkedConvertedLeads } = require('../controllers/dashboardController');
const { createActivity, updateActivity } = require('../controllers/activityController');
const { LEAD_ASSIGNMENT_REQUIRED_MESSAGE, isLeadAssigned } = require('../utils/leadAssignment');

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

test('lead assignment validation rejects empty and unassigned values', () => {
  for (const value of ['', '  ', 'Unassigned', 'none', 'Select']) {
    assert.equal(isLeadAssigned(value), false);
  }
  assert.equal(isLeadAssigned('Riya Shah'), true);
});

test('move-to-activity API refuses unassigned leads with the required message', async () => {
  const originalFindOne = Lead.findOne;
  Lead.findOne = async () => ({
    assignedTo: 'Unassigned',
    timeline: [],
    save: async () => {},
  });
  const res = makeResponse();

  try {
    await moveToActivity({ body: { id: 'lead-1' }, user: { role: 'admin' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, LEAD_ASSIGNMENT_REQUIRED_MESSAGE);
  } finally {
    Lead.findOne = originalFindOne;
  }
});

test('lead conversion creates and links a customer and is safe to retry', async () => {
  const originals = {
    leadFindOne: Lead.findOne,
    customerFindOne: Customer.findOne,
    customerCreate: Customer.create,
  };
  const lead = {
    _id: 'lead-1',
    leadId: 'LD-1',
    companyName: 'Northstar Ltd',
    contactPerson: 'Riya Shah',
    email: 'riya@example.com',
    mobile: '9876543210',
    timeline: [],
    isConverted: false,
    save: async () => {},
  };
  let createdCustomer;
  Lead.findOne = async () => lead;
  Customer.findOne = async ({ sourceLeadId }) => sourceLeadId === 'lead-1' ? createdCustomer || null : null;
  Customer.create = async (payload) => {
    createdCustomer = { ...payload, _id: 'customer-1', createdAt: new Date('2026-11-16T00:00:00Z') };
    return createdCustomer;
  };
  const req = { body: { id: 'lead-1' }, user: { id: 'admin-1', name: 'Admin', role: 'admin' } };

  try {
    const firstResponse = makeResponse();
    await convertToCustomer(req, firstResponse);
    assert.equal(firstResponse.statusCode, 200);
    assert.equal(createdCustomer.sourceLeadId, 'lead-1');
    assert.equal(lead.customerId, 'customer-1');
    assert.equal(lead.isConverted, true);
    assert.equal(lead.leadStatus, 'Won');
    assert.ok(lead.convertedAt instanceof Date);

    const secondResponse = makeResponse();
    await convertToCustomer(req, secondResponse);
    assert.equal(secondResponse.statusCode, 200);
    assert.equal(secondResponse.body.data.customer._id, 'customer-1');
    assert.equal(lead.timeline.length, 1);
  } finally {
    Lead.findOne = originals.leadFindOne;
    Customer.findOne = originals.customerFindOne;
    Customer.create = originals.customerCreate;
  }
});

test('lead conversion does not mark a lead converted when only a manual duplicate customer exists', async () => {
  const originals = {
    leadFindOne: Lead.findOne,
    customerFindOne: Customer.findOne,
    customerCreate: Customer.create,
  };
  const lead = {
    _id: 'lead-2',
    companyName: 'Existing Ltd',
    contactPerson: 'Existing Contact',
    email: 'existing@example.com',
    mobile: '9876543210',
    timeline: [],
    isConverted: false,
    save: async () => {},
  };
  const manualCustomer = { _id: 'manual-customer', sourceLeadId: undefined };
  let created = false;
  Lead.findOne = async () => lead;
  Customer.findOne = async (filter) => filter.sourceLeadId ? null : manualCustomer;
  Customer.create = async () => { created = true; };
  const res = makeResponse();

  try {
    await convertToCustomer({
      body: { id: 'lead-2' },
      user: { id: 'employee-1', name: 'Riya Shah', role: 'employee' },
    }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(lead.isConverted, false);
    assert.equal(lead.customerId, undefined);
    assert.equal(created, false);
  } finally {
    Lead.findOne = originals.leadFindOne;
    Customer.findOne = originals.customerFindOne;
    Customer.create = originals.customerCreate;
  }
});

test('dashboard converted leads require a matching lead and source-linked customer', async () => {
  const originalFind = Customer.find;
  let query;
  Customer.find = (filter) => {
    query = filter;
    return {
      select() { return this; },
      lean: async () => [{ _id: 'customer-1', sourceLeadId: 'lead-1' }],
    };
  };
  try {
    const converted = await _getLinkedConvertedLeads([
      { _id: 'lead-1', customerId: 'customer-1', isConverted: true },
      { _id: 'lead-2', customerId: 'customer-manual', isConverted: true },
      { _id: 'lead-3', customerId: 'customer-3', isConverted: false },
      { _id: 'lead-4', isConverted: true },
    ]);
    assert.deepEqual(converted.map((lead) => lead._id), ['lead-1']);
    assert.deepEqual(query.sourceLeadId.$in, ['lead-1', 'lead-2']);
  } finally {
    Customer.find = originalFind;
  }
});

test('move-to-activity API continues for an assigned lead', async () => {
  const originalFindOne = Lead.findOne;
  const lead = {
    assignedTo: 'Riya Shah',
    leadStatus: 'New',
    timeline: [],
    save: async () => {},
  };
  Lead.findOne = async () => lead;
  const res = makeResponse();

  try {
    await moveToActivity({ body: { id: 'lead-1' }, user: { role: 'admin' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(lead.leadStatus, 'Follow-up');
  } finally {
    Lead.findOne = originalFindOne;
  }
});

test('activity creation API requires an employee selection for an unassigned linked lead', async () => {
  const originals = {
    leadFindOne: Lead.findOne,
    employeeFindOne: Employee.findOne,
    activityFindOne: Activity.findOne,
    activityCreate: Activity.create,
  };
  let created = false;
  Lead.findOne = async () => ({ assignedTo: '' });
  Employee.findOne = () => ({ lean: async () => null });
  Activity.findOne = () => {
    throw new Error('Activity duplicate lookup should not run without an assigned employee.');
  };
  Activity.create = async () => { created = true; };
  const res = makeResponse();

  try {
    await createActivity({
      user: { id: 'admin-id', name: 'Admin', role: 'admin' },
      body: {
        leadId: 'LD-1',
        customerName: 'Northstar Ltd',
        activityType: 'Call',
        activityDate: '2026-11-13',
        product: 'Sensor',
      },
    }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Please select an active Sales employee for Assigned To.');
    assert.equal(created, false);
  } finally {
    Lead.findOne = originals.leadFindOne;
    Employee.findOne = originals.employeeFindOne;
    Activity.findOne = originals.activityFindOne;
    Activity.create = originals.activityCreate;
  }
});

test('activity creation accepts a selected Sales employee for an unassigned lead', async () => {
  const originals = {
    leadFindOne: Lead.findOne,
    employeeFindOne: Employee.findOne,
    activityFindOne: Activity.findOne,
    activityFind: Activity.find,
    activityCreate: Activity.create,
  };
  const assignedUserId = '507f1f77bcf86cd799439011';
  const employee = { _id: assignedUserId, employeeName: 'Riya Shah', email: 'riya@example.com' };
  const lead = { assignedTo: 'Unassigned', leadStatus: 'New', timeline: [], save: async () => {} };
  let createdPayload;
  Lead.findOne = async () => lead;
  Employee.findOne = (query) => ({
    lean: async () => query._id ? employee : null,
  });
  Activity.findOne = () => ({ select() { return this; }, lean: async () => null });
  Activity.find = () => ({ lean: async () => [] });
  Activity.create = async (payload) => {
    createdPayload = payload;
    return { ...payload, toObject: () => payload };
  };
  const res = makeResponse();

  try {
    await createActivity({
      user: { id: 'creator-id', name: 'Admin', role: 'admin' },
      body: {
        leadId: 'LD-1',
        customerName: 'Northstar Ltd',
        activityType: 'Call',
        activityDate: '2026-11-13',
        product: 'Sensor',
        assignedUserId,
      },
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(createdPayload.assignedUserId, assignedUserId);
    assert.equal(createdPayload.assignedUser, 'Riya Shah');
  } finally {
    Lead.findOne = originals.leadFindOne;
    Employee.findOne = originals.employeeFindOne;
    Activity.findOne = originals.activityFindOne;
    Activity.find = originals.activityFind;
    Activity.create = originals.activityCreate;
  }
});

test('activity creation API requires Assigned To for non-lead activities', async () => {
  const originalEmployeeFindOne = Employee.findOne;
  const originalActivityCreate = Activity.create;
  let created = false;
  Employee.findOne = () => {
    throw new Error('No employee lookup should occur without an assigned employee ID.');
  };
  Activity.create = async () => {
    created = true;
  };
  const res = makeResponse();

  try {
    await createActivity({
      user: { id: 'admin-id', name: 'Admin', role: 'admin' },
      body: {
        customerName: 'Northstar Ltd',
        activityType: 'Call',
        activityDate: '2026-11-13',
        product: 'Sensor',
      },
    }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Please select an active Sales employee for Assigned To.');
    assert.equal(created, false);
  } finally {
    Employee.findOne = originalEmployeeFindOne;
    Activity.create = originalActivityCreate;
  }
});

test('activity update validates and persists the selected employee assignment', async () => {
  const originals = {
    activityFindOne: Activity.findOne,
    employeeFindOne: Employee.findOne,
  };
  const assignedUserId = '507f1f77bcf86cd799439011';
  const employee = { _id: assignedUserId, employeeName: 'Riya Shah', email: 'riya@example.com' };
  const activity = {
    status: 'Open',
    assignedUser: 'Previous Owner',
    assignedUserId: '',
    createdBy: 'Original Creator',
    createdById: 'creator-id',
    activityDate: '2026-11-13',
    followUpDate: '',
    toObject() {
      return { ...this };
    },
    save: async () => {},
  };
  Activity.findOne = async () => activity;
  Employee.findOne = () => ({ lean: async () => employee });
  const res = makeResponse();

  try {
    await updateActivity({
      params: { id: 'activity-1' },
      user: { id: 'editor-id', name: 'Editor', role: 'admin' },
      body: { assignedUserId },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(activity.assignedUserId, assignedUserId);
    assert.equal(activity.assignedUser, 'Riya Shah');
    assert.equal(activity.createdBy, 'Original Creator');
    assert.equal(activity.createdById, 'creator-id');
  } finally {
    Activity.findOne = originals.activityFindOne;
    Employee.findOne = originals.employeeFindOne;
  }
});

test('activity created from a lead retains its employee assignment separately from its creator', async () => {
  const originals = {
    leadFindOne: Lead.findOne,
    employeeFindOne: Employee.findOne,
    activityFindOne: Activity.findOne,
    activityFind: Activity.find,
    activityCreate: Activity.create,
  };
  const assignedUserId = '507f1f77bcf86cd799439011';
  const employee = {
    _id: assignedUserId,
    employeeName: 'Riya Shah',
    fullName: 'Riya Shah',
  };
  const lead = {
    assignedTo: 'Riya Shah',
    assignedToId: assignedUserId,
    leadStatus: 'New',
    timeline: [],
    save: async () => {},
  };
  let createdPayload;
  Lead.findOne = async () => lead;
  Employee.findOne = () => ({ lean: async () => employee });
  Activity.findOne = () => ({
    select() { return this; },
    lean: async () => null,
  });
  Activity.find = () => ({ lean: async () => [] });
  Activity.create = async (payload) => {
    createdPayload = payload;
    return { ...payload, toObject: () => payload };
  };
  const res = makeResponse();

  try {
    await createActivity({
      user: { id: 'creator-id', name: 'Created By User', role: 'admin' },
      body: {
        leadId: 'LD-1',
        customerName: 'Northstar Ltd',
        activityType: 'Call',
        activityDate: '2026-11-13',
        product: 'Sensor',
        assignedUserId: 'untrusted-client-id',
      },
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(createdPayload.assignedUserId, assignedUserId);
    assert.equal(createdPayload.assignedUser, 'Riya Shah');
    assert.equal(createdPayload.createdBy, 'Created By User');
    assert.equal(createdPayload.createdById, 'creator-id');
  } finally {
    Lead.findOne = originals.leadFindOne;
    Employee.findOne = originals.employeeFindOne;
    Activity.findOne = originals.activityFindOne;
    Activity.find = originals.activityFind;
    Activity.create = originals.activityCreate;
  }
});
