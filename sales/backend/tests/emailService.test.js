const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { sendCampaignEmails } = require('../services/emailService');

const smtpEnvKeys = [
  'EMAIL_USER',
  'EMAIL_PASS',
  'SMTP_USER',
  'SMTP_PASS',
  'GMAIL_APP_PASSWORD',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
];

const withSmtpEnv = async (overrides, run) => {
  const originalEnv = Object.fromEntries(smtpEnvKeys.map((key) => [key, process.env[key]]));
  const originalCreateTransport = nodemailer.createTransport;
  const originalLogger = { info: logger.info, error: logger.error };

  for (const key of smtpEnvKeys) {
    if (Object.hasOwn(overrides, key)) {
      process.env[key] = overrides[key];
    } else {
      delete process.env[key];
    }
  }

  try {
    await run({
      setTransport: (transport) => {
        nodemailer.createTransport = transport;
      },
      setLogger: (methods) => Object.assign(logger, methods),
    });
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    nodemailer.createTransport = originalCreateTransport;
    Object.assign(logger, originalLogger);
  }
};

test('logs SMTP error details while redacting the configured password', async () => {
  await withSmtpEnv({
    EMAIL_USER: 'mailer@synovconnect.com',
    EMAIL_PASS: 'smtp-test-secret',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '465',
    SMTP_SECURE: 'true',
  }, async ({ setTransport, setLogger }) => {
    const errors = [];
    setLogger({ error: (event, metadata) => errors.push({ event, metadata }) });
    setTransport(() => ({
      verify: async () => {
        const error = new Error('Authentication failed for smtp-test-secret');
        error.code = 'EAUTH';
        error.command = 'AUTH PLAIN';
        error.responseCode = 535;
        error.response = '535 smtp-test-secret rejected';
        throw error;
      },
    }));

    const report = await sendCampaignEmails({
      subject: 'Test',
      html: '<p>Campaign content</p>',
      to: ['recipient@example.com'],
    });

    assert.equal(report.results[0].status, 'Failed');
    assert.equal(report.failed, 1);
    assert.equal(errors.length, 1);
    assert.deepEqual(
      Object.fromEntries(['code', 'command', 'responseCode'].map((key) => [key, errors[0].metadata[key]])),
      { code: 'EAUTH', command: 'AUTH PLAIN', responseCode: 535 },
    );
    assert.match(errors[0].metadata.response, /535 \[REDACTED\] rejected/);
    assert.doesNotMatch(JSON.stringify(errors), /smtp-test-secret/);
    assert.doesNotMatch(report.results[0].errorMessage, /smtp-test-secret/);
  });
});

test('preserves SMTP credential fallbacks and marks unaccepted recipients as failed', async () => {
  await withSmtpEnv({
    EMAIL_USER: '',
    EMAIL_PASS: '',
    SMTP_USER: 'fallback@synovconnect.com',
    SMTP_PASS: 'fallback-password',
    SMTP_HOST: '',
    SMTP_PORT: '',
    SMTP_SECURE: '',
  }, async ({ setTransport, setLogger }) => {
    let transportConfig;
    const infoLogs = [];
    const trackingUrl = 'https://tracking.example/open/private-tracking-token';
    setLogger({ info: (event, metadata) => infoLogs.push({ event, metadata }) });
    setTransport((config) => {
      transportConfig = config;
      return {
        verify: async () => {},
        sendMail: async () => ({
          accepted: [],
          rejected: ['recipient@example.com'],
          pending: [],
          response: '550 Recipient rejected',
          messageId: '',
        }),
      };
    });

    const report = await sendCampaignEmails({
      subject: 'Test',
      html: (recipient) => `<p>Private campaign content for ${recipient}</p><img src="${trackingUrl}">`,
      to: ['recipient@example.com'],
      tracking: () => ({
        campaignId: 'campaign-1',
        trackingId: 'private-tracking-token',
        url: trackingUrl,
      }),
    });

    assert.equal(transportConfig.auth.user, 'fallback@synovconnect.com');
    assert.equal(transportConfig.auth.pass, 'fallback-password');
    assert.equal(transportConfig.host, 'smtp.gmail.com');
    assert.equal(transportConfig.port, 465);
    assert.equal(transportConfig.secure, true);
    assert.equal(report.results[0].status, 'Failed');
    assert.equal(report.successfullySent, 0);
    assert.equal(report.failed, 1);
    const serializedLogs = JSON.stringify(infoLogs);
    assert.doesNotMatch(serializedLogs, /Private campaign content/);
    assert.doesNotMatch(serializedLogs, /private-tracking-token/);
    assert.doesNotMatch(serializedLogs, /tracking\.example/);
    assert.doesNotMatch(serializedLogs, /fallback-password/);
  });
});
