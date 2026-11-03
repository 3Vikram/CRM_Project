const path = require('path');
const nodemailer = require('nodemailer');

const logger = require('../utils/logger');

const getSmtpConfig = () => {
  const user = process.env.EMAIL_USER || process.env.SMTP_USER || '';
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';

  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
  };
};

const redactSmtpErrorValue = (value, password, seen = new WeakSet()) => {
  if (typeof value === 'string') {
    return password ? value.split(password).join('[REDACTED]') : value;
  }
  if (!value || typeof value !== 'object') return value;
  if (Buffer.isBuffer(value)) return '[binary data]';
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSmtpErrorValue(item, password, seen));
  }

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    /pass|secret|authorization/i.test(key)
      ? '[REDACTED]'
      : redactSmtpErrorValue(item, password, seen),
  ]));
};

const getSmtpErrorDetails = (error, password) => {
  const details = {};
  for (const field of ['code', 'command', 'responseCode', 'response', 'message']) {
    if (error?.[field] !== undefined && error[field] !== null) {
      details[field] = redactSmtpErrorValue(error[field], password);
    }
  }
  return details;
};

const getSmtpConnectionDetails = ({ host, port, secure }) => ({
  smtpHost: host,
  smtpPort: port,
  smtpSecure: secure,
});

const createTransporter = () => nodemailer.createTransport(getSmtpConfig());

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character]);

const normalizeRecipients = (recipients = []) => {
  if (!Array.isArray(recipients)) return [];
  return [...new Set(recipients.map((item) => String(item).trim()).filter((value) => {
    const email = String(value).trim();
    return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }))];
};

const buildRenewalReminderEmail = ({ employeeName, opf, renewalDate, daysRemaining = 7 }) => {
  const opfNumber = opf.opfNo || opf.quotationNumber || String(opf._id);
  const formattedDate = new Date(renewalDate).toLocaleDateString('en-GB', { timeZone: 'UTC' });
  const subject = `Renewal Reminder – OPF ${opfNumber} – Due in 7 Days`;
  const text = [
    `Dear ${employeeName},`,
    '',
    'This is a reminder that the following OPF is due for renewal in 7 days.',
    '',
    `OPF Number: ${opfNumber}`,
    `Customer Name: ${opf.customerName || '-'}`,
    `Product: ${opf.product || '-'}`,
    `Renewal Date: ${formattedDate}`,
    `Days Remaining: ${daysRemaining}`,
    '',
    'Please review the renewal details and coordinate with the customer to initiate the renewal process before the expiry date.',
    '',
    'Kindly update the renewal status once the necessary action has been taken.',
    '',
    'Best regards,',
    'Synov IT Services',
    'CRM Renewal Management System',
  ].join('\n');
  const html = `<p>Dear ${escapeHtml(employeeName)},</p>
    <p>This is a reminder that the following OPF is due for renewal in 7 days.</p>
    <ul>
      <li><strong>OPF Number:</strong> ${escapeHtml(opfNumber)}</li>
      <li><strong>Customer Name:</strong> ${escapeHtml(opf.customerName || '-')}</li>
      <li><strong>Product:</strong> ${escapeHtml(opf.product || '-')}</li>
      <li><strong>Renewal Date:</strong> ${escapeHtml(formattedDate)}</li>
      <li><strong>Days Remaining:</strong> ${daysRemaining}</li>
    </ul>
    <p>Please review the renewal details and coordinate with the customer to initiate the renewal process before the expiry date.</p>
    <p>Kindly update the renewal status once the necessary action has been taken.</p>
    <p>Best regards,<br>Synov IT Services<br>CRM Renewal Management System</p>`;

  return { opfNumber, subject, text, html };
};

const sendCampaignEmails = async ({
  subject,
  html,
  text,
  to,
  attachments = [],
  fromName = 'CRM Mail Campaign',
  tracking,
}) => {
  const recipients = normalizeRecipients(to);
  const config = getSmtpConfig();
  const smtpUser = config.auth.user;

  logger.info('mail-campaign.email.send.start', {
    ...getSmtpConnectionDetails(config),
    smtpAuthConfigured: Boolean(smtpUser && config.auth.pass),
    recipientCount: recipients.length,
    attachments: attachments.length,
  });

  if (!smtpUser || !config.auth.pass) {
    const message = 'SMTP credentials are not configured. EMAIL_USER and EMAIL_PASS are required.';
    logger.error('mail-campaign.email.config.invalid', { message });
    return {
      totalRecipients: recipients.length,
      successfullySent: 0,
      failed: recipients.length,
      results: recipients.map((recipient) => ({
        recipientEmail: recipient,
        status: 'Failed',
        messageId: '',
        errorMessage: message,
      })),
    };
  }

  if (!recipients.length) {
    return {
      totalRecipients: 0,
      successfullySent: 0,
      failed: 0,
      results: [],
    };
  }

  const transporter = createTransporter();

  try {
    await transporter.verify();
    logger.info('mail-campaign.email.smtp.verified', getSmtpConnectionDetails(config));
  } catch (error) {
    const errorDetails = getSmtpErrorDetails(error, config.auth.pass);
    logger.error('mail-campaign.email.smtp.verify.failed', {
      ...getSmtpConnectionDetails(config),
      ...errorDetails,
    });

    return {
      totalRecipients: recipients.length,
      successfullySent: 0,
      failed: recipients.length,
      results: recipients.map((recipient) => ({
        recipientEmail: recipient,
        status: 'Failed',
        messageId: '',
        errorMessage: errorDetails.message || 'SMTP verification failed',
      })),
    };
  }

  const results = [];

  for (const recipient of recipients) {
    try {
      const finalHtml = (typeof html === 'function' ? html(recipient) : html) || '<p>Email from CRM Mail Campaign</p>';
      const trackingDetails = typeof tracking === 'function' ? tracking(recipient, finalHtml) : null;
      const mailOptions = {
        from: `${fromName} <${smtpUser}>`,
        to: recipient,
        subject,
        text: text || 'Email from CRM Mail Campaign',
        html: finalHtml,
        attachments: attachments.map((attachment) => {
          const attachmentPath = attachment.path || attachment.filename || '';
          return {
            filename: attachment.filename || attachment.originalname || path.basename(attachmentPath) || 'attachment',
            path: attachmentPath,
            contentType: attachment.mimetype,
            cid: attachment.cid,
          };
        }),
      };

      if (trackingDetails) {
        const trackingPixelIncluded = Boolean(trackingDetails.url && finalHtml.includes(trackingDetails.url));
        logger.info('mail-campaign.email.final-html', {
          campaignId: trackingDetails.campaignId,
          trackingPixelIncluded,
        });
        if (!trackingPixelIncluded) {
          throw new Error(`Tracking pixel missing from final HTML for campaign ${trackingDetails.campaignId}, recipient ${recipient}.`);
        }
      }
      const finalImageSources = [...finalHtml.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]);
      const invalidImageSources = finalImageSources.filter((source) => !/^cid:[^\s"']+$/i.test(source) && (!/^https:\/\//i.test(source) || /(?:localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(source) || /^(?:undefined|null)$/i.test(source)));
      if (invalidImageSources.length) {
        throw new Error(`Final email contains ${invalidImageSources.length} invalid image source(s).`);
      }
      const info = await transporter.sendMail(mailOptions);
      const accepted = Array.isArray(info.accepted) ? info.accepted : [];
      const rejected = Array.isArray(info.rejected) ? info.rejected : [];
      const pending = Array.isArray(info.pending) ? info.pending : [];
      const recipientAccepted = accepted.some((address) => String(address).toLowerCase() === recipient.toLowerCase());
      const recipientRejected = rejected.some((address) => String(address).toLowerCase() === recipient.toLowerCase());
      const status = recipientAccepted && !recipientRejected ? 'Sent' : 'Failed';
      const deliveryError = status === 'Failed'
        ? `Recipient was not accepted by SMTP. accepted=${accepted.join(',')} rejected=${rejected.join(',')} pending=${pending.join(',')}`
        : '';
      results.push({
        recipientEmail: recipient,
        status,
        accepted,
        rejected,
        pending,
        response: info.response || '',
        messageId: info.messageId || '',
        errorMessage: deliveryError,
        deliveryStatus: status === 'Sent' ? 'Accepted by SMTP; final delivery is not confirmed.' : deliveryError,
      });
    } catch (error) {
      const errorDetails = getSmtpErrorDetails(error, config.auth.pass);
      logger.error('mail-campaign.email.send.failed', {
        recipient,
        ...getSmtpConnectionDetails(config),
        ...errorDetails,
      });
      results.push({
        recipientEmail: recipient,
        status: 'Failed',
        accepted: [],
        rejected: [recipient],
        pending: [],
        response: errorDetails.response || '',
        messageId: '',
        errorMessage: errorDetails.response || errorDetails.message || 'Unknown email sending error',
      });
    }
  }

  const successfullySent = results.filter((item) => item.status === 'Sent').length;
  const failed = results.filter((item) => item.status === 'Failed').length;

  logger.info('mail-campaign.email.send.complete', {
    totalRecipients: recipients.length,
    successfullySent,
    failed,
  });

  return {
    totalRecipients: recipients.length,
    successfullySent,
    failed,
    results,
  };
};

const sendRenewalReminder = async ({ recipient, employeeName, opf, renewalDate, daysRemaining = 7 }) => {
  const email = String(recipient || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, errorMessage: 'A valid renewal reminder recipient is required.' };
  }

  const config = getSmtpConfig();
  if (!config.auth.user || !config.auth.pass) {
    const message = 'SMTP credentials are not configured.';
    logger.error('renewal.reminder.email.config.invalid', { message });
    return { success: false, retryable: true, errorMessage: message };
  }

  const { opfNumber, subject, text, html } = buildRenewalReminderEmail({
    employeeName,
    opf,
    renewalDate,
    daysRemaining,
  });

  try {
    const transporter = createTransporter();
    try {
      await transporter.verify();
    } catch (error) {
      const errorDetails = getSmtpErrorDetails(error, config.auth.pass);
      logger.error('renewal.reminder.email.smtp.verify.failed', {
        opfNo: opfNumber,
        ...getSmtpConnectionDetails(config),
        ...errorDetails,
      });
      return { success: false, retryable: true, errorMessage: errorDetails.message || 'SMTP verification failed.' };
    }
    const info = await transporter.sendMail({
      from: `Synov IT Services <${config.auth.user}>`,
      to: email,
      subject,
      text,
      html,
    });
    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    if (!accepted.some((address) => String(address).toLowerCase() === email)) {
      return { success: false, errorMessage: 'SMTP did not accept the renewal reminder recipient.' };
    }

    logger.info('renewal.reminder.email.sent', { opfNo: opfNumber });
    return { success: true, messageId: info.messageId || '' };
  } catch (error) {
    const errorDetails = getSmtpErrorDetails(error, config.auth.pass);
    logger.error('renewal.reminder.email.send.failed', {
      opfNo: opfNumber,
      ...getSmtpConnectionDetails(config),
      ...errorDetails,
    });
    return { success: false, errorMessage: errorDetails.message || 'Failed to send renewal reminder.' };
  }
};

const sendQuotationEmail = async ({
  recipient,
  cc = '',
  subject,
  quotationNumber,
  pdfBuffer,
  pdfFileName,
}) => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const parseEmails = (value) => String(value || '').split(/[,;\s]+/).map((item) => item.trim()).filter(Boolean);
  const toList = parseEmails(recipient);
  const ccList = parseEmails(cc);
  const config = getSmtpConfig();
  const smtpUser = config.auth.user;

  logger.info('quotation.email.send.start', {
    smtpUser: smtpUser || 'undefined',
    recipient,
    quotationNumber,
  });

  if (!smtpUser || !config.auth.pass) {
    const message = 'SMTP credentials are not configured. EMAIL_USER and EMAIL_PASS are required.';
    logger.error('quotation.email.config.invalid', { message });
    return {
      success: false,
      message,
      status: 'Failed',
      errorMessage: message,
    };
  }

  if (!toList.length || toList.some((email) => !emailPattern.test(email)) || ccList.some((email) => !emailPattern.test(email))) {
    const message = 'Invalid recipient or CC email address.';
    logger.error('quotation.email.recipient.invalid', { recipient, message });
    return {
      success: false,
      message,
      status: 'Failed',
      errorMessage: message,
    };
  }

  if (!pdfBuffer || !pdfFileName) {
    const message = 'PDF buffer or filename is missing.';
    logger.error('quotation.email.pdf.missing', { message });
    return {
      success: false,
      message,
      status: 'Failed',
      errorMessage: message,
    };
  }

  const transporter = createTransporter();

  try {
    await transporter.verify();
    logger.info('quotation.email.smtp.verified', getSmtpConnectionDetails(config));
  } catch (error) {
    const errorDetails = getSmtpErrorDetails(error, config.auth.pass);
    logger.error('quotation.email.smtp.verify.failed', {
      ...getSmtpConnectionDetails(config),
      ...errorDetails,
    });

    return {
      success: false,
      message: errorDetails.message || 'SMTP verification failed',
      status: 'Failed',
      errorMessage: errorDetails.message || 'SMTP verification failed',
    };
  }

  try {
    const mailOptions = {
      from: `CRM Quotation <${smtpUser}>`,
      to: toList.join(', '),
      cc: ccList.length ? ccList.join(', ') : undefined,
      subject: subject || `Quotation ${quotationNumber}`,
      text: `Dear Sir/Madam,\n\nPlease find attached the quotation.\n\nBest regards,\nSynov IT Services`,
      html: `<p>Dear Sir/Madam,</p><p>Please find attached the quotation ${quotationNumber}.</p><p>Best regards,<br>Synov IT Services</p>`,
      attachments: [
        {
          filename: pdfFileName,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    
    logger.info('quotation.email.send.success', {
      recipient,
      quotationNumber,
      messageId: info.messageId,
    });

    return {
      success: true,
      message: 'Quotation email sent successfully',
      status: 'Sent',
      messageId: info.messageId,
    };
  } catch (error) {
    const errorDetails = getSmtpErrorDetails(error, config.auth.pass);
    logger.error('quotation.email.send.failed', {
      recipient,
      quotationNumber,
      ...getSmtpConnectionDetails(config),
      ...errorDetails,
    });

    return {
      success: false,
      message: errorDetails.message || 'Failed to send quotation email',
      status: 'Failed',
      errorMessage: errorDetails.message || 'Unknown email sending error',
    };
  }
};

module.exports = {
  sendCampaignEmails,
  sendRenewalReminder,
  sendQuotationEmail,
  buildRenewalReminderEmail,
};
