const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const MailCampaign = require('../models/MailCampaign');
const EmailLog = require('../models/EmailLog');
const {
  addEmailTracking,
  checkTrackingUrlReachable,
  getCampaignReport,
  trackOpen,
} = require('../controllers/mailCampaignController');

test('tracking URL verification falls back to the request host when the configured URL cannot resolve', async () => {
  const previousMailTrackingUrl = process.env.MAIL_TRACKING_BASE_URL;
  const originalFetch = global.fetch;
  process.env.MAIL_TRACKING_BASE_URL = 'https://unresolvable-test-host.invalid';

  const requestedUrls = [];
  global.fetch = async (url) => {
    requestedUrls.push(String(url));
    if (String(url).startsWith('https://unresolvable-test-host.invalid')) {
      throw new TypeError('fetch failed', {
        cause: Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }),
      });
    }
    if (String(url).endsWith('/api/health')) {
      return new Response('{"status":"ok"}', { status: 200 });
    }
    return new Response(Buffer.from('GIF89a'), {
      status: 200,
      headers: { 'content-type': 'image/gif' },
    });
  };

  try {
    const req = {
      headers: {
        host: 'sales-backend.internal:5001',
        'x-forwarded-host': 'crm.company.example:8443',
        'x-forwarded-proto': 'https',
      },
      get: (name) => name.toLowerCase() === 'host' ? 'sales-backend.internal:5001' : '',
    };
    const result = await checkTrackingUrlReachable(req);

    assert.equal(result.ok, true);
    assert.equal(result.baseUrl, 'https://crm.company.example:8443');
    assert.equal(requestedUrls.length, 3);
    assert.match(requestedUrls[0], /^https:\/\/unresolvable-test-host\.invalid\/api\/health$/);
    assert.match(requestedUrls[1], /^https:\/\/crm\.company\.example:8443\/api\/health$/);
    assert.match(requestedUrls[2], /^https:\/\/crm\.company\.example:8443\/api\/mail-campaigns\/track\/open\/tracking-probe-/);
    const trackedHtml = addEmailTracking('<html><body>Test</body></html>', 'test-campaign', 'test-recipient-token', result.baseUrl);
    assert.match(trackedHtml, /<img src="https:\/\/crm\.company\.example:8443\/api\/mail-campaigns\/track\/open\/test-recipient-token"/);
  } finally {
    global.fetch = originalFetch;
    if (previousMailTrackingUrl === undefined) delete process.env.MAIL_TRACKING_BASE_URL;
    else process.env.MAIL_TRACKING_BASE_URL = previousMailTrackingUrl;
  }
});

test('one public open request updates its matching recipient and the campaign report', async (t) => {
  const recipientToken = 'test-recipient-tracking-token';
  const logs = [
    {
      _id: 'target-recipient-log',
      campaignId: 'tracking-test-campaign',
      campaignName: 'Tracking endpoint test',
      recipientEmail: 'tracking-test@example.invalid',
      recipientId: recipientToken,
      trackingId: recipientToken,
      trackingToken: recipientToken,
      status: 'Sent',
      openCount: 0,
      clickCount: 0,
    },
    {
      _id: 'other-recipient-log',
      campaignId: 'tracking-test-campaign',
      campaignName: 'Tracking endpoint test',
      recipientEmail: 'other-recipient@example.invalid',
      recipientId: 'other-recipient-token',
      trackingId: 'other-recipient-token',
      trackingToken: 'other-recipient-token',
      status: 'Sent',
      openCount: 0,
      clickCount: 0,
    },
  ];
  const campaign = {
    _id: 'tracking-test-campaign-record',
    campaignId: 'tracking-test-campaign',
    campaignName: 'Tracking endpoint test',
    subject: 'Open tracking test',
    opens: 0,
    uniqueOpens: 0,
    clicks: 0,
  };
  const originalMethods = {
    emailLogFindOne: EmailLog.findOne,
    emailLogFindOneAndUpdate: EmailLog.findOneAndUpdate,
    emailLogAggregate: EmailLog.aggregate,
    emailLogFind: EmailLog.find,
    campaignUpdateOne: MailCampaign.updateOne,
    campaignFindOne: MailCampaign.findOne,
  };

  EmailLog.findOne = (query) => ({
    select: () => ({
      lean: async () => {
        const queriedIds = query.$or.map((condition) => Object.values(condition)[0]);
        const match = logs.find((log) => queriedIds.includes(log.trackingId) || queriedIds.includes(log.trackingToken));
        return match ? { ...match } : null;
      },
    }),
  });
  EmailLog.findOneAndUpdate = (query, update) => ({
    lean: async () => {
      const log = logs.find((item) => item._id === query._id);
      assert.ok(log);
      assert.equal(update[0].$set.openCount.$add[1], 1);
      log.openCount += 1;
      log.openedAt = new Date();
      log.firstOpenedAt = log.openedAt;
      log.lastOpenedAt = log.openedAt;
      return { ...log };
    },
  });
  EmailLog.aggregate = async () => [{
    opens: logs.reduce((total, log) => total + log.openCount, 0),
    clicks: logs.reduce((total, log) => total + log.clickCount, 0),
    uniqueOpens: new Set(logs.filter((log) => log.openCount > 0).map((log) => log.recipientId)).size,
  }];
  EmailLog.find = () => ({
    sort: () => ({ lean: async () => logs.map((log) => ({ ...log })) }),
  });
  MailCampaign.updateOne = async (_query, update) => {
    Object.assign(campaign, update.$set);
    return { matchedCount: 1, modifiedCount: 1 };
  };
  MailCampaign.findOne = () => ({
    select: () => ({ lean: async () => ({ ...campaign }) }),
  });

  const app = express();
  app.get('/api/mail-campaigns/track/open/:trackingId', trackOpen);
  app.get('/api/mail-campaigns/:id/report', (req, res) => {
    req.params.id = campaign._id;
    return getCampaignReport(req, res);
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    EmailLog.findOne = originalMethods.emailLogFindOne;
    EmailLog.findOneAndUpdate = originalMethods.emailLogFindOneAndUpdate;
    EmailLog.aggregate = originalMethods.emailLogAggregate;
    EmailLog.find = originalMethods.emailLogFind;
    MailCampaign.updateOne = originalMethods.campaignUpdateOne;
    MailCampaign.findOne = originalMethods.campaignFindOne;
  });

  await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const pixelResponse = await fetch(`${origin}/api/mail-campaigns/track/open/${recipientToken}`);
  assert.equal(pixelResponse.status, 200);
  assert.equal(pixelResponse.headers.get('content-type'), 'image/gif');
  assert.equal(pixelResponse.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');

  assert.equal(logs[0].openCount, 1);
  assert.equal(logs[1].openCount, 0);
  assert.equal(campaign.opens, 1);
  assert.equal(campaign.uniqueOpens, 1);

  const reportResponse = await fetch(`${origin}/api/mail-campaigns/${campaign._id}/report`);
  const report = await reportResponse.json();
  assert.equal(reportResponse.status, 200);
  assert.equal(report.summary.totalOpens, 1);
  assert.equal(report.summary.uniqueOpens, 1);
  assert.equal(report.summary.openRate, 50);
  assert.equal(report.data.find((row) => row.sentTo === 'tracking-test@example.invalid').opens, 1);
  assert.equal(report.data.find((row) => row.sentTo === 'other-recipient@example.invalid').opens, 0);
});
