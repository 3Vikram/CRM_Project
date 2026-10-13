const { randomUUID } = require('crypto');
const { db } = require('../utils/salesDatabase');

const rowToEmailLog = (row) => {
  if (!row) return null;
  let legacy = {};
  try {
    legacy = JSON.parse(row.data_json || '{}');
  } catch (error) {
    throw new Error(`Invalid JSON stored in email_logs row ${row.id}.`, { cause: error });
  }
  return {
    ...legacy,
    _id: String(row.id),
    campaignId: row.campaign_id || legacy.campaignId || '',
    campaignName: row.campaign_name || legacy.campaignName || '',
    recipientEmail: row.recipient_email || row.recipient || legacy.recipientEmail || '',
    status: row.status || legacy.status || 'Failed',
    sentAt: row.sent_at || row.created_at || legacy.sentAt || null,
    errorMessage: row.error_message || legacy.errorMessage || '',
    senderEmail: row.sender_email || legacy.senderEmail || '',
    trackingId: row.tracking_id || legacy.trackingId || '',
    trackingToken: row.tracking_token || legacy.trackingToken || '',
    openedAt: row.opened_at || legacy.openedAt || null,
    openCount: Number(row.open_count ?? legacy.openCount ?? 0),
    firstOpenedAt: row.first_opened_at || legacy.firstOpenedAt || null,
    lastOpenedAt: row.last_opened_at || legacy.lastOpenedAt || null,
    clickedAt: row.clicked_at || legacy.clickedAt || null,
    clickCount: Number(row.click_count ?? legacy.clickCount ?? 0),
    firstClickedAt: row.first_clicked_at || legacy.firstClickedAt || null,
    lastClickedAt: row.last_clicked_at || legacy.lastClickedAt || null,
    leadCreated: Boolean(row.lead_created ?? legacy.leadCreated),
    leadId: row.lead_id || legacy.leadId || '',
    createdAt: row.created_at || legacy.createdAt || '',
    updatedAt: row.updated_at || legacy.updatedAt || '',
  };
};

const columns = [
  'campaign_id', 'campaign_name', 'recipient_email', 'status', 'sent_at',
  'error_message', 'sender_email', 'tracking_id', 'tracking_token',
  'opened_at', 'open_count', 'first_opened_at', 'last_opened_at',
  'clicked_at', 'click_count', 'first_clicked_at', 'last_clicked_at',
  'lead_created', 'lead_id', 'data_json', 'created_at', 'updated_at',
];
const fields = {
  campaignId: 'campaign_id',
  campaignName: 'campaign_name',
  recipientEmail: 'recipient_email',
  status: 'status',
  sentAt: 'sent_at',
  errorMessage: 'error_message',
  senderEmail: 'sender_email',
  trackingId: 'tracking_id',
  trackingToken: 'tracking_token',
  openedAt: 'opened_at',
  openCount: 'open_count',
  firstOpenedAt: 'first_opened_at',
  lastOpenedAt: 'last_opened_at',
  clickedAt: 'clicked_at',
  clickCount: 'click_count',
  firstClickedAt: 'first_clicked_at',
  lastClickedAt: 'last_clicked_at',
  leadCreated: 'lead_created',
  leadId: 'lead_id',
};

const normalize = (input = {}) => {
  if (!input.campaignId) {
    const error = new Error('Email log campaign ID is required.');
    error.name = 'ValidationError';
    throw error;
  }
  const recipientEmail = String(input.recipientEmail || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    const error = new Error('A valid recipient email is required.');
    error.name = 'ValidationError';
    throw error;
  }
  const status = input.status || 'Failed';
  if (!['Sent', 'Failed'].includes(status)) {
    const error = new Error('Email log status must be Sent or Failed.');
    error.name = 'ValidationError';
    throw error;
  }
  const now = new Date().toISOString();
  const normalized = {
    campaignId: String(input.campaignId),
    campaignName: String(input.campaignName || ''),
    recipientEmail,
    status,
    sentAt: input.sentAt instanceof Date ? input.sentAt.toISOString() : input.sentAt || now,
    errorMessage: String(input.errorMessage || ''),
    senderEmail: String(input.senderEmail || '').trim().toLowerCase(),
    trackingId: input.trackingId ? String(input.trackingId) : null,
    trackingToken: input.trackingToken ? String(input.trackingToken) : null,
    openedAt: input.openedAt || null,
    openCount: Math.max(0, Number(input.openCount) || 0),
    firstOpenedAt: input.firstOpenedAt || null,
    lastOpenedAt: input.lastOpenedAt || null,
    clickedAt: input.clickedAt || null,
    clickCount: Math.max(0, Number(input.clickCount) || 0),
    firstClickedAt: input.firstClickedAt || null,
    lastClickedAt: input.lastClickedAt || null,
    leadCreated: input.leadCreated ? 1 : 0,
    leadId: String(input.leadId || ''),
  };
  return { ...normalized, createdAt: now, updatedAt: now };
};

const insertLogs = db.transaction((logs) => {
  const insert = db.prepare(`
    INSERT INTO email_logs (
      id, ${columns.map((column) => `"${column}"`).join(', ')}
    ) VALUES (?, ${columns.map(() => '?').join(', ')})
  `);
  return logs.map((input) => {
    const log = normalize(input);
    const id = randomUUID();
    const stored = { ...log };
    const values = columns.map((column) => {
      if (column === 'data_json') return JSON.stringify(stored);
      if (column === 'created_at') return log.createdAt;
      if (column === 'updated_at') return log.updatedAt;
      const field = Object.keys(fields).find((name) => fields[name] === column);
      return field ? log[field] : null;
    });
    insert.run(id, ...values);
    return getById(id);
  });
});

function getById(id) {
  return rowToEmailLog(db.prepare('SELECT * FROM email_logs WHERE id = ?').get(String(id)));
}

const getByTrackingId = (trackingId) => rowToEmailLog(db.prepare(`
  SELECT * FROM email_logs WHERE tracking_id = ? OR tracking_token = ? LIMIT 1
`).get(String(trackingId), String(trackingId)));

const updateTrackingEvent = db.transaction((id, type, now) => {
  if (type === 'open') {
    db.prepare(`
      UPDATE email_logs SET
        open_count = open_count + 1,
        opened_at = COALESCE(opened_at, ?),
        first_opened_at = COALESCE(first_opened_at, ?),
        last_opened_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(now, now, now, now, String(id));
  } else {
    db.prepare(`
      UPDATE email_logs SET
        clicked_at = CASE WHEN click_count = 0 THEN ? ELSE clicked_at END,
        first_clicked_at = CASE WHEN click_count = 0 THEN ? ELSE first_clicked_at END,
        click_count = click_count + 1,
        last_clicked_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(now, now, now, now, String(id));
  }
  return getById(id);
});

const statsForCampaign = (campaignId) => db.prepare(`
  SELECT
    COALESCE(SUM(open_count), 0) AS opens,
    COUNT(DISTINCT CASE WHEN open_count > 0 THEN lower(recipient_email) END) AS uniqueOpens,
    COALESCE(SUM(click_count), 0) AS clicks
  FROM email_logs WHERE campaign_id = ?
`).get(String(campaignId));

const updateDelivery = db.transaction((trackingId, result) => {
  const now = new Date().toISOString();
  const changed = db.prepare(`
    UPDATE email_logs SET status = ?, sent_at = ?, error_message = ?,
      updated_at = ? WHERE tracking_id = ? OR tracking_token = ?
  `).run(result.status, now, String(result.errorMessage || ''), now, String(trackingId), String(trackingId));
  if (!changed.changes) return null;
  return getByTrackingId(trackingId);
});

const markLeadCreated = (id, leadId) => {
  const now = new Date().toISOString();
  const changed = db.prepare(`
    UPDATE email_logs SET lead_created = 1, lead_id = ?, updated_at = ? WHERE id = ?
  `).run(String(leadId || ''), now, String(id));
  return changed.changes ? getById(id) : null;
};

module.exports = {
  normalize,
  createMany: (logs) => insertLogs.immediate(logs),
  getById,
  getByTrackingId,
  recordOpen: (id, now = new Date().toISOString()) => updateTrackingEvent.immediate(id, 'open', now),
  recordClick: (id, now = new Date().toISOString()) => updateTrackingEvent.immediate(id, 'click', now),
  updateDelivery: (trackingId, result) => updateDelivery.immediate(trackingId, result),
  markLeadCreated,
  statsForCampaign,
  statsForCampaigns: (campaignIds) => {
    if (!campaignIds.length) return [];
    const placeholders = campaignIds.map(() => '?').join(', ');
    return db.prepare(`
      SELECT campaign_id AS campaignId,
        COALESCE(SUM(open_count), 0) AS totalOpens,
        COALESCE(SUM(click_count), 0) AS totalClicks
      FROM email_logs WHERE campaign_id IN (${placeholders})
      GROUP BY campaign_id
    `).all(...campaignIds);
  },
  listByCampaign: (campaignId, sortOrder = 'asc') => {
    const order = sortOrder === 'desc' ? 'DESC' : 'ASC';
    return db.prepare(`SELECT * FROM email_logs WHERE campaign_id = ? ORDER BY datetime(sent_at) ${order}, id ${order}`)
      .all(String(campaignId)).map(rowToEmailLog);
  },
  latestByCampaign: (campaignId) => rowToEmailLog(db.prepare(`
    SELECT * FROM email_logs WHERE campaign_id = ?
    ORDER BY datetime(sent_at) DESC, id DESC LIMIT 1
  `).get(String(campaignId))),
  findForTrackingDiagnostic: (trackingId) => rowToEmailLog(db.prepare(`
    SELECT * FROM email_logs WHERE tracking_id = ? OR tracking_token = ? LIMIT 1
  `).get(String(trackingId), String(trackingId))),
  deleteByCampaign: (campaignId) => db.prepare('DELETE FROM email_logs WHERE campaign_id = ?').run(String(campaignId)).changes,
};
