const test = require('node:test');
const assert = require('node:assert/strict');
const Employee = require('../models/Employee');
const { resolveActivityEmployeeNames } = require('../utils/accessScope');

test('resolves activity creator and assignee separately without replacing creator attribution', async () => {
  const originalFind = Employee.find;
  const creatorId = '0123456789abcdef01234567';
  const assigneeId = 'abcdef0123456789abcdef01';
  Employee.find = () => ({
    select() {
      return this;
    },
    async lean() {
      return [
        { _id: creatorId, employeeName: 'Canonical Creator' },
        { _id: assigneeId, employeeName: 'Assigned Employee' },
      ];
    },
  });

  try {
    const records = await resolveActivityEmployeeNames([
      {
        createdBy: 'Original Creator',
        createdById: creatorId,
        assignedUser: '',
        assignedUserId: assigneeId,
      },
      {
        createdBy: '',
        createdById: creatorId,
        assignedUser: 'Existing Assignee',
        assignedUserId: '',
      },
    ]);

    assert.equal(records[0].createdBy, 'Original Creator');
    assert.equal(records[0].assignedUser, 'Assigned Employee');
    assert.equal(records[1].createdBy, 'Canonical Creator');
    assert.equal(records[1].assignedUser, 'Existing Assignee');
  } finally {
    Employee.find = originalFind;
  }
});
