const Employee = require('../models/Employee');
const OPF = require('../models/OPF');
const { sendRenewalReminder } = require('./emailService');
const logger = require('../utils/logger');
const { escapeRegex } = require('../utils/queryUtils');
const { getDaysUntilRenewal, getRenewalReminderDateRange } = require('../utils/renewalUtils');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let isProcessing = false;

const processReminder = async (opf, now, dependencies) => {
  const claimed = await dependencies.claimReminder(opf, now);
  if (!claimed) return 'already-claimed';

  const creator = await dependencies.findCreator(opf);
  if (!creator || !EMAIL_PATTERN.test(String(creator.email || '').trim())) {
    dependencies.logger.error('renewal.reminder.creator-email-missing', {
      opfId: String(opf._id),
      opfNo: opf.opfNo || '',
      createdBy: opf.createdBy || '',
    });
    return 'missing-email';
  }

  const result = await dependencies.sendEmail({
    recipient: creator.email,
    employeeName: creator.employeeName || creator.fullName || creator.email,
    opf,
    renewalDate: opf.renewalDate,
    daysRemaining: 7,
  });

  if (!result?.success) {
    dependencies.logger.error('renewal.reminder.send.failed', {
      opfId: String(opf._id),
      opfNo: opf.opfNo || '',
      error: result?.errorMessage || result?.message || 'Email service did not confirm delivery.',
    });
    if (result?.retryable) {
      await dependencies.releaseReminder(opf, now);
    }
    return 'send-failed';
  }

  await dependencies.OPF.findOneAndUpdate(
    { _id: opf._id, renewalReminderDate: opf.renewalDate },
    { $set: { renewalReminderSentAt: now } }
  );
  dependencies.logger.info('renewal.reminder.send.success', {
    opfId: String(opf._id),
    opfNo: opf.opfNo || '',
  });
  return 'sent';
};

const createRenewalReminderProcessor = ({
  OPF: OPFModel = OPF,
  Employee: EmployeeModel = Employee,
  sendEmail = sendRenewalReminder,
  log = logger,
} = {}) => {
  const dependencies = {
    OPF: OPFModel,
    claimReminder: async (opf, now) => {
      const claimed = await OPFModel.findOneAndUpdate(
        {
          _id: opf._id,
          renewalDate: opf.renewalDate,
          approvalStatus: { $nin: ['Approved', 'Rejected'] },
          $or: [
            { renewalReminderDate: { $ne: opf.renewalDate } },
            {
              renewalReminderClaimedAt: null,
              renewalReminderRetryAt: { $lte: now },
            },
          ],
        },
        {
          $set: {
            renewalReminderDate: opf.renewalDate,
            renewalReminderClaimedAt: now,
            renewalReminderRetryAt: null,
            renewalReminderSentAt: null,
          },
        },
        { new: true, projection: { _id: 1 } }
      ).lean();
      return claimed;
    },
    releaseReminder: async (opf, now) => OPFModel.findOneAndUpdate(
      {
        _id: opf._id,
        renewalReminderDate: opf.renewalDate,
        renewalReminderClaimedAt: now,
      },
      {
        $set: {
          renewalReminderClaimedAt: null,
          renewalReminderRetryAt: new Date(now.getTime() + (60 * 60 * 1000)),
        },
      }
    ),
    findCreator: async (opf) => {
      if (/^[a-f\d]{24}$/i.test(String(opf.createdById || ''))) {
        const employee = await EmployeeModel.findById(opf.createdById).select('employeeName fullName email').lean();
        if (employee) return employee;
      }

      const storedEmail = String(opf.createdByEmail || '').trim().toLowerCase();
      if (EMAIL_PATTERN.test(storedEmail)) {
        const employee = await EmployeeModel.findOne({ email: storedEmail }).select('employeeName fullName email').lean();
        if (employee) return employee;
        return { employeeName: opf.createdBy || storedEmail, email: storedEmail };
      }

      const creatorName = String(opf.createdBy || '').trim();
      if (!creatorName) return null;
      const exactCreator = new RegExp(`^${escapeRegex(creatorName)}$`, 'i');
      return EmployeeModel.findOne({
        $or: [
          { employeeName: exactCreator },
          { fullName: exactCreator },
          ...(EMAIL_PATTERN.test(creatorName) ? [{ email: creatorName.toLowerCase() }] : []),
        ],
      }).select('employeeName fullName email').lean();
    },
    sendEmail,
    logger: log,
  };

  return async (now = new Date()) => {
    if (isProcessing) return { processed: 0, skipped: 0, sent: 0 };
    isProcessing = true;
    try {
      const { start, end } = getRenewalReminderDateRange(now);
      const opfs = await OPFModel.find({
        renewalDate: { $gte: start, $lt: end },
        approvalStatus: { $nin: ['Approved', 'Rejected'] },
      }).lean();
      const result = { processed: opfs.length, skipped: 0, sent: 0 };

      for (const opf of opfs) {
        if (getDaysUntilRenewal(opf.renewalDate, now) !== 7) {
          result.skipped += 1;
          continue;
        }
        try {
          const outcome = await processReminder(opf, now, dependencies);
          if (outcome === 'sent') result.sent += 1;
          else result.skipped += 1;
        } catch (error) {
          log.error('renewal.reminder.processing.failed', {
            opfId: String(opf._id),
            opfNo: opf.opfNo || '',
            error: error?.message || 'Unknown renewal reminder error.',
          });
          result.skipped += 1;
        }
      }
      return result;
    } finally {
      isProcessing = false;
    }
  };
};

const processScheduledRenewalReminders = createRenewalReminderProcessor();

module.exports = { createRenewalReminderProcessor, processScheduledRenewalReminders };
