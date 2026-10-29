const test = require('node:test');
const assert = require('node:assert/strict');

const { shouldCreateEngagementLead } = require('../controllers/mailCampaignController');

test('does not create a lead before three total opens', () => {
  assert.equal(shouldCreateEngagementLead({ email: 'contact@example.com', openCount: 1 }), false);
  assert.equal(shouldCreateEngagementLead({ email: 'contact@example.com', openCount: 2 }), false);
});

test('creates a lead at three opens and above', () => {
  assert.equal(shouldCreateEngagementLead({ email: 'contact@example.com', openCount: 3 }), true);
  assert.equal(shouldCreateEngagementLead({ email: 'contact@example.com', openCount: 4 }), true);
  assert.equal(shouldCreateEngagementLead({ email: 'other@example.com', openCount: 2 }), false);
});

test('does not create a duplicate after the email log is claimed', () => {
  assert.equal(shouldCreateEngagementLead({ email: 'contact@example.com', openCount: 4, leadCreated: true }), false);
});

test('does not create a lead without recipient email data', () => {
  assert.equal(shouldCreateEngagementLead({ email: '', openCount: 3 }), false);
  assert.equal(shouldCreateEngagementLead({ email: null, openCount: 4 }), false);
});
