const { randomUUID } = require('crypto');
const { db } = require('../utils/salesDatabase');

const fields = {
  campaignId: 'campaign_id',
  campaignName: 'campaign_name',
  subject: 'subject',
  campaignType: 'campaign_type',
  priority: 'priority',
  imageAlignment: 'image_alignment',
  tags: 'tags_json',
  recipientModules: 'recipient_modules_json',
  recipientGroup: 'recipient_group_json',
  recipientEmails: 'recipient_emails_json',
  batchName: 'batch_name',
  batchNumber: 'batch_number',
  batchId: 'batch_id',
  employeeId: 'employee_id',
  employeeName: 'employee_name',
  recipientCount: 'recipient_count',
  campaignBody: 'campaign_body',
  footer: 'footer',
  image: 'image',
  attachments: 'attachments_json',
  status: 'status',
  calendarStatus: 'calendar_status',
  opens: 'opens',
  uniqueOpens: 'unique_opens',
  clicks: 'clicks',
  createdBy: 'created_by',
  createdDate: 'created_date',
  scheduledDate: 'scheduled_date',
  scheduledTime: 'scheduled_time',
  timezone: 'timezone',
  sentDate: 'sent_date',
  testEmail: 'test_email',
  deliveryResults: 'delivery_results_json',
  deletedAt: 'deleted_at',
};
const arrayFields = new Set(['tags', 'recipientModules', 'recipientGroup', 'recipientEmails', 'attachments', 'deliveryResults']);
const jsonColumns = new Set(['tags_json', 'recipient_modules_json', 'recipient_group_json', 'recipient_emails_json', 'attachments_json', 'delivery_results_json']);
const statuses = ['Draft', 'Scheduled', 'Sending', 'Sent', 'Partially Sent', 'Failed', 'Trash'];
const defaults = {
  campaignId: '',
  campaignName: '',
  subject: '',
  campaignType: 'Promotional',
  priority: 'Medium',
  imageAlignment: 'Image Before Text',
  tags: [],
  recipientModules: [],
  recipientGroup: [],
  recipientEmails: [],
  batchName: '',
  batchNumber: null,
  batchId: null,
  employeeId: '',
  employeeName: '',
  recipientCount: 0,
  campaignBody: '',
  footer: '',
  image: '',
  attachments: [],
  status: 'Draft',
  calendarStatus: 'Pending',
  opens: 0,
  uniqueOpens: 0,
  clicks: 0,
  createdBy: 'Admin',
  createdDate: '',
  scheduledDate: '',
  scheduledTime: '',
  timezone: 'UTC',
  sentDate: '',
  testEmail: '',
  deliveryResults: [],
  deletedAt: null,
};
const sortColumns = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  campaignName: 'campaign_name',
  campaignId: 'campaign_id',
  subject: 'subject',
  status: 'status',
  createdBy: 'created_by',
  scheduledDate: 'scheduled_date',
  sentDate: 'sent_date',
  recipientCount: 'recipient_count',
  opens: 'opens',
  clicks: 'clicks',
};

const validationError = (message, errors = {}) => {
  const error = new Error(message);
  error.name = 'ValidationError';
  error.errors = errors;
  return error;
};

const normalizeGroup = (group = {}, index = 0) => ({
  _id: String(group._id || randomUUID()),
  groupName: String(group.groupName || `Campaign Group ${index + 1}`).trim() || `Campaign Group ${index + 1}`,
  contactIds: [...new Set((Array.isArray(group.contactIds) ? group.contactIds : []).map(String).filter(Boolean))],
  subject: String(group.subject || '').trim(),
  message: String(group.message || ''),
  status: String(group.status || 'Draft'),
  recipientEmails: [...new Set((Array.isArray(group.recipientEmails) ? group.recipientEmails : []).map((email) => String(email).trim()).filter(Boolean))],
  sentDate: String(group.sentDate || ''),
  deliveryResults: Array.isArray(group.deliveryResults) ? group.deliveryResults : [],
});

const normalize = (input = {}, { partial = false } = {}) => {
  const result = partial ? {} : { ...defaults };
  for (const [field, column] of Object.entries(fields)) {
    if (!Object.hasOwn(input, field) || input[field] === undefined) continue;
    let value = input[field];
    if (field === 'deletedAt' && value) {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) throw validationError('Campaign data is invalid.');
      value = date.toISOString();
    } else if (jsonColumns.has(column)) {
      if (!Array.isArray(value)) value = [];
    } else if (field === 'recipientCount' || field === 'opens' || field === 'uniqueOpens' || field === 'clicks') {
      value = Number(value || 0);
      if (!Number.isSafeInteger(value) || value < 0) throw validationError(`Campaign ${field} must be a non-negative integer.`);
    } else if (field === 'batchNumber') {
      value = value === '' || value === null ? null : Number(value);
      if (value !== null && (!Number.isSafeInteger(value) || value < 1)) throw validationError('Campaign batch number must be a positive integer.');
    } else if (field === 'batchId') {
      value = value === '' || value === null ? null : String(value);
    } else if (field !== 'deletedAt') {
      value = value === null ? '' : String(value);
    }
    result[field] = value;
  }
  if (Object.hasOwn(input, 'campaignGroups') && Array.isArray(input.campaignGroups)) {
    result.campaignGroups = input.campaignGroups.map(normalizeGroup);
  } else if (!partial) {
    result.campaignGroups = [];
  }
  if (!partial) {
    if (!result.campaignId) throw validationError('Campaign ID is required.');
    if (!result.campaignName.trim()) throw validationError('Campaign name is required.');
    if (!result.subject.trim()) throw validationError('Subject is required.');
  }
  if (Object.hasOwn(result, 'status') && !statuses.includes(result.status)) {
    throw validationError('Campaign status is invalid.');
  }
  if (Object.hasOwn(result, 'calendarStatus') && !['Pending', 'Completed'].includes(result.calendarStatus)) {
    throw validationError('Campaign calendar status is invalid.');
  }
  return result;
};

const parseJson = (value, field, fallback) => {
  try {
    return JSON.parse(value || JSON.stringify(fallback));
  } catch (error) {
    throw new Error(`Invalid JSON stored in mail_campaigns.${field}.`, { cause: error });
  }
};

const normalizeGroupFromStorage = (row) => {
  const group = parseJson(row.data_json, 'campaign group', {});
  const contactIds = db.prepare(`
    SELECT contact_id FROM campaign_group_contacts WHERE group_id = ? ORDER BY position, contact_id
  `).all(row.group_id).map(({ contact_id: id }) => id);
  return normalizeGroup({ ...group, _id: row.group_id, contactIds }, Number(row.position));
};

const getGroups = (campaignRowId) => db.prepare(`
  SELECT group_id, position, data_json FROM mail_campaign_groups
  WHERE campaign_row_id = ? ORDER BY position, group_id
`).all(campaignRowId).map(normalizeGroupFromStorage);

const rowToCampaign = (row) => {
  if (!row) return null;
  const result = { _id: String(row.id) };
  for (const [field, column] of Object.entries(fields)) {
    const value = row[column];
    if (jsonColumns.has(column)) result[field] = parseJson(value, field, defaults[field]);
    else if (field === 'deletedAt') result[field] = value || null;
    else result[field] = value ?? defaults[field];
  }
  result.campaignGroups = getGroups(row.id);
  result.createdAt = row.created_at || '';
  result.updatedAt = row.updated_at || '';
  return result;
};

const storageValue = (field, value) => {
  if (jsonColumns.has(fields[field])) return JSON.stringify(value ?? defaults[field]);
  return value instanceof Date ? value.toISOString() : value ?? null;
};

const writeGroups = (campaignRowId, groups) => {
  db.prepare('DELETE FROM mail_campaign_groups WHERE campaign_row_id = ?').run(campaignRowId);
  const insertGroup = db.prepare(`
    INSERT INTO mail_campaign_groups (group_id, campaign_row_id, position, data_json)
    VALUES (?, ?, ?, ?)
  `);
  const insertContact = db.prepare(`
    INSERT INTO campaign_group_contacts (group_id, contact_id, position) VALUES (?, ?, ?)
  `);
  groups.forEach((group, position) => {
    const normalized = normalizeGroup(group, position);
    const groupId = normalized._id || randomUUID();
    insertGroup.run(groupId, campaignRowId, position, JSON.stringify({ ...normalized, _id: groupId, contactIds: [] }));
    normalized.contactIds.forEach((contactId, contactPosition) => insertContact.run(groupId, contactId, contactPosition));
  });
};

const getById = (id) => rowToCampaign(db.prepare('SELECT * FROM mail_campaigns WHERE id = ?').get(String(id)));
const getByCampaignId = (campaignId) => rowToCampaign(
  db.prepare('SELECT * FROM mail_campaigns WHERE campaign_id = ?').get(String(campaignId)),
);
const getAnyByIdentifier = (identifier) => rowToCampaign(db.prepare(`
  SELECT * FROM mail_campaigns WHERE id = ? OR campaign_id = ? ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END LIMIT 1
`).get(String(identifier), String(identifier), String(identifier)));

const insertCampaign = db.transaction((input) => {
  const campaign = normalize(input);
  const id = randomUUID();
  const now = new Date().toISOString();
  const dataJson = JSON.stringify({ ...campaign, _id: id, createdAt: now, updatedAt: now });
  const columns = Object.values(fields);
  db.prepare(`
    INSERT INTO mail_campaigns (id, ${columns.map((column) => `"${column}"`).join(', ')}, data_json, created_at, updated_at)
    VALUES (?, ${columns.map(() => '?').join(', ')}, ?, ?, ?)
  `).run(id, ...Object.keys(fields).map((field) => storageValue(field, campaign[field])), dataJson, now, now);
  writeGroups(id, campaign.campaignGroups || []);
  return getById(id);
});

const create = (input) => {
  const id = input.campaignId || nextCampaignId();
  return insertCampaign.immediate({ ...input, campaignId: id });
};

const updateRecord = db.transaction((id, input) => {
  const existing = getById(id);
  if (!existing) return null;
  const campaign = normalize({ ...existing, ...input });
  const now = new Date().toISOString();
  const columns = Object.values(fields);
  const dataJson = JSON.stringify({ ...campaign, _id: existing._id, createdAt: existing.createdAt, updatedAt: now });
  db.prepare(`
    UPDATE mail_campaigns SET ${columns.map((column) => `"${column}" = ?`).join(', ')},
      data_json = ?, updated_at = ? WHERE id = ?
  `).run(...Object.keys(fields).map((field) => storageValue(field, campaign[field])), dataJson, now, String(id));
  if (Object.hasOwn(input, 'campaignGroups')) writeGroups(String(id), campaign.campaignGroups);
  return getById(id);
});

const nextCampaignId = db.transaction(() => {
  const highest = db.prepare(`
    SELECT COALESCE(MAX(CAST(substr(campaign_id, 5) AS INTEGER)), 0) AS value
    FROM mail_campaigns WHERE campaign_id REGEXP '^CMP-[0-9]+$'
  `).get().value;
  const current = db.prepare("SELECT value FROM counters WHERE name = 'campaign-id'").get()?.value || 0;
  const value = Math.max(highest, current) + 1;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO counters (id, name, value, created_at, updated_at)
    VALUES (?, 'campaign-id', ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(randomUUID(), value, now, now);
  return `CMP-${value}`;
});

const list = ({ page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search = '', status = '', recipientGroup = '', createdBy = '', includeDeleted = false } = {}) => {
  const conditions = [];
  const params = [];
  if (!includeDeleted) conditions.push('deleted_at IS NULL');
  if (search) {
    conditions.push(`(
      campaign_name REGEXP ? OR campaign_id REGEXP ? OR subject REGEXP ?
      OR EXISTS (SELECT 1 FROM json_each(mail_campaigns.recipient_group_json) AS g WHERE g.value REGEXP ?)
    )`);
    params.push(...Array(4).fill(String(search)));
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (recipientGroup) {
    conditions.push('EXISTS (SELECT 1 FROM json_each(mail_campaigns.recipient_group_json) AS rg WHERE rg.value REGEXP ?)');
    params.push(`^${String(recipientGroup).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  }
  if (createdBy) {
    conditions.push('created_by REGEXP ?');
    params.push(`^${String(createdBy).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  }
  const where = conditions.length ? conditions.join(' AND ') : '1 = 1';
  const sort = sortColumns[sortBy] || sortColumns.createdAt;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 10));
  const rows = db.prepare(`
    SELECT * FROM mail_campaigns WHERE ${where}
    ORDER BY "${sort}" ${direction} LIMIT ? OFFSET ?
  `).all(...params, pageSize, (pageNumber - 1) * pageSize).map(rowToCampaign);
  const total = db.prepare(`SELECT COUNT(*) AS total FROM mail_campaigns WHERE ${where}`).get(...params).total;
  return { campaigns: rows, total };
};

const claimScheduled = (id) => {
  const now = new Date().toISOString();
  return db.prepare(`
    UPDATE mail_campaigns SET status = 'Sending', updated_at = ?
    WHERE id = ? AND status = 'Scheduled' AND deleted_at IS NULL
  `).run(now, String(id)).changes === 1;
};

const findScheduledCandidates = (today) => db.prepare(`
  SELECT id, scheduled_date, scheduled_time FROM mail_campaigns
  WHERE status = 'Scheduled' AND deleted_at IS NULL
    AND scheduled_date <> '' AND scheduled_date <= ?
  ORDER BY scheduled_date, scheduled_time, id
`).all(String(today)).map((row) => ({
  _id: String(row.id),
  scheduledDate: row.scheduled_date,
  scheduledTime: row.scheduled_time || '',
}));

const findForCalendar = () => db.prepare(`
  SELECT * FROM mail_campaigns WHERE deleted_at IS NULL
  ORDER BY datetime(created_at), id
`).all().map(rowToCampaign);

const updateCalendarStatus = (id, status) => {
  const campaign = getAnyByIdentifier(id);
  if (!campaign || campaign.deletedAt) return null;
  return updateRecord.immediate(campaign._id, { calendarStatus: status });
};

const updateCalendarDate = (id, field, value) => {
  if (!['scheduledDate', 'createdDate'].includes(field)) {
    throw new TypeError('Unsupported Mail Campaign calendar field.');
  }
  const campaign = getAnyByIdentifier(id);
  if (!campaign || campaign.deletedAt) return null;
  return updateRecord.immediate(campaign._id, { [field]: String(value) });
};

const setStatusIfCurrent = (id, expectedStatus, status) => {
  const now = new Date().toISOString();
  return db.prepare(`
    UPDATE mail_campaigns SET status = ?, updated_at = ?
    WHERE id = ? AND status = ?
  `).run(status, now, String(id), expectedStatus).changes === 1;
};

const deleteCampaign = db.transaction((id) => {
  const existing = getAnyByIdentifier(id);
  if (!existing) return null;
  db.prepare('DELETE FROM email_logs WHERE campaign_id = ?').run(existing.campaignId);
  db.prepare('DELETE FROM mail_campaigns WHERE id = ?').run(existing._id);
  return existing;
});

module.exports = {
  normalize,
  create,
  getById,
  getByCampaignId,
  getAnyByIdentifier,
  update: (id, changes) => updateRecord.immediate(id, changes),
  save: (campaign) => updateRecord.immediate(campaign._id, campaign),
  list,
  findForCalendar,
  updateCalendarStatus,
  updateCalendarDate,
  findScheduledCandidates,
  claimScheduled,
  setStatusIfCurrent,
  delete: (id) => deleteCampaign.immediate(id),
  nextCampaignId,
};
