const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getDaysUntilRenewal,
  getRenewalReminderDateRange,
} = require('../utils/renewalUtils');
const { createRenewalReminderProcessor } = require('../services/renewalReminderService');
const { buildRenewalReminderEmail } = require('../services/emailService');

const now = new Date('2026-03-01T18:30:00.000Z');
const dateInDays = (days) => new Date(Date.UTC(2026, 2, 1 + days));
const creatorId = '507f1f77bcf86cd799439011';

const createProcessor = ({ opfs, employees = {}, sendEmail = async () => ({ success: true }) }) => {
  const claims = new Set();
  const retryAt = new Map();
  const sentUpdates = [];
  const logs = [];
  const OPFModel = {
    find: (query) => ({
      lean: async () => opfs.filter((opf) => (
        opf.renewalDate >= query.renewalDate.$gte
        && opf.renewalDate < query.renewalDate.$lt
        && !query.approvalStatus.$nin.includes(opf.approvalStatus)
      )),
    }),
    findOneAndUpdate: (query, update) => {
      if (query.$or) {
        return {
          lean: async () => {
            const key = `${query._id}:${query.renewalDate.toISOString()}`;
            if (claims.has(key)) return null;
            if (retryAt.has(key) && retryAt.get(key) > update.$set.renewalReminderClaimedAt) return null;
            claims.add(key);
            return { _id: query._id };
          },
        };
      }
      if (query.renewalReminderClaimedAt) {
        const key = `${query._id}:${query.renewalReminderDate.toISOString()}`;
        claims.delete(key);
        retryAt.set(key, update.$set.renewalReminderRetryAt);
        return Promise.resolve({ acknowledged: true });
      }
      sentUpdates.push({ query, update });
      return Promise.resolve({ acknowledged: true });
    },
  };
  const EmployeeModel = {
    findById: (id) => ({
      select: () => ({ lean: async () => employees[id] || null }),
    }),
    findOne: (query) => ({
      select: () => ({
        lean: async () => {
          if (query.email) {
            return Object.values(employees).find((employee) => employee.email === query.email) || null;
          }
          const creatorPattern = query.$or?.find((item) => item.employeeName)?.employeeName;
          return Object.values(employees).find((employee) => creatorPattern?.test(employee.employeeName || '')) || null;
        },
      }),
    }),
  };
  const log = {
    info: (event, metadata) => logs.push({ level: 'info', event, metadata }),
    error: (event, metadata) => logs.push({ level: 'error', event, metadata }),
  };
  const process = createRenewalReminderProcessor({ OPF: OPFModel, Employee: EmployeeModel, sendEmail, log });
  return { process, logs, sentUpdates };
};

test('calculates renewal countdowns at and around the 90-day boundary', () => {
  assert.equal(getDaysUntilRenewal(dateInDays(91), now), 91);
  assert.equal(getDaysUntilRenewal(dateInDays(90), now), 90);
  assert.equal(getDaysUntilRenewal(dateInDays(7), now), 7);
  assert.equal(getDaysUntilRenewal(dateInDays(0), now), 0);
  assert.equal(getDaysUntilRenewal(dateInDays(-1), now), -1);
});

test('builds the seven-day scheduler range using UTC calendar days', () => {
  const { start, end } = getRenewalReminderDateRange(now);
  assert.equal(start.toISOString(), '2026-03-08T00:00:00.000Z');
  assert.equal(end.toISOString(), '2026-03-09T00:00:00.000Z');
});

test('sends one reminder to the OPF creator and does not repeat after processing again', async () => {
  const opf = {
    _id: 'opf-1',
    opfNo: 'OPF-001',
    renewalDate: dateInDays(7),
    approvalStatus: 'Pending',
    createdById: creatorId,
    createdBy: 'Original Creator',
    customerName: 'Customer One',
    product: 'Product One',
  };
  const reminders = [];
  const { process, sentUpdates } = createProcessor({
    opfs: [opf],
    employees: {
      [creatorId]: { employeeName: 'Original Creator', email: 'creator@example.com' },
    },
    sendEmail: async (reminder) => {
      reminders.push(reminder);
      return { success: true };
    },
  });

  assert.deepEqual(await process(now), { processed: 1, skipped: 0, sent: 1 });
  assert.deepEqual(await process(now), { processed: 1, skipped: 1, sent: 0 });
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].recipient, 'creator@example.com');
  assert.equal(reminders[0].employeeName, 'Original Creator');
  assert.equal(sentUpdates.length, 1);
});

test('does not send for missing creator email and logs the missing recipient once', async () => {
  const opf = {
    _id: 'opf-no-email',
    opfNo: 'OPF-002',
    renewalDate: dateInDays(7),
    approvalStatus: 'Pending',
    createdById: creatorId,
    createdBy: 'Unknown Creator',
  };
  let sendCount = 0;
  const { process, logs } = createProcessor({
    opfs: [opf],
    sendEmail: async () => {
      sendCount += 1;
      return { success: true };
    },
  });

  await process(now);
  await process(now);
  assert.equal(sendCount, 0);
  assert.equal(logs.filter((entry) => entry.event === 'renewal.reminder.creator-email-missing').length, 1);
});

test('handles email-service failures without throwing or sending duplicate attempts', async () => {
  const opf = {
    _id: 'opf-send-failure',
    opfNo: 'OPF-003',
    renewalDate: dateInDays(7),
    approvalStatus: 'Pending',
    createdByEmail: 'creator@example.com',
    createdBy: 'Original Creator',
  };
  let sendCount = 0;
  const { process, logs } = createProcessor({
    opfs: [opf],
    sendEmail: async () => {
      sendCount += 1;
      return { success: false, errorMessage: 'SMTP unavailable' };
    },
  });

  await assert.doesNotReject(process(now));
  await process(now);
  assert.equal(sendCount, 1);
  assert.equal(logs.filter((entry) => entry.event === 'renewal.reminder.send.failed').length, 1);
});

test('retries known pre-send email failures after the retry delay', async () => {
  const opf = {
    _id: 'opf-retry',
    opfNo: 'OPF-005',
    renewalDate: dateInDays(7),
    approvalStatus: 'Pending',
    createdByEmail: 'creator@example.com',
    createdBy: 'Original Creator',
  };
  let sendCount = 0;
  const { process } = createProcessor({
    opfs: [opf],
    sendEmail: async () => {
      sendCount += 1;
      return sendCount === 1
        ? { success: false, retryable: true, errorMessage: 'SMTP is temporarily unavailable' }
        : { success: true };
    },
  });

  await process(now);
  await process(new Date(now.getTime() + (30 * 60 * 1000)));
  assert.equal(sendCount, 1);
  assert.deepEqual(await process(new Date(now.getTime() + (60 * 60 * 1000))), { processed: 1, skipped: 0, sent: 1 });
  assert.equal(sendCount, 2);
});

test('builds the reminder subject and dynamic employee and OPF details', () => {
  const message = buildRenewalReminderEmail({
    employeeName: 'Alex Employee',
    opf: { _id: 'opf-4', opfNo: 'OPF-004', customerName: 'A & B Ltd', product: '<Product>' },
    renewalDate: dateInDays(7),
    daysRemaining: 7,
  });

  assert.equal(message.subject, 'Renewal Reminder – OPF OPF-004 – Due in 7 Days');
  assert.match(message.text, /Dear Alex Employee,/);
  assert.match(message.text, /Renewal Date: 08\/03\/2026/);
  assert.match(message.html, /A &amp; B Ltd/);
  assert.match(message.html, /&lt;Product&gt;/);
  assert.match(message.html, /Days Remaining:<\/strong> 7/);
});
