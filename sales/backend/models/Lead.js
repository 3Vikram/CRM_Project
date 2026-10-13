const { randomUUID } = require('crypto');
const { isDeepStrictEqual } = require('util');
const { db } = require('../utils/salesDatabase');

const fields = {
  leadId: 'lead_id',
  companyName: 'company_name',
  contactPerson: 'contact_person',
  designation: 'designation',
  email: 'email',
  mobile: 'mobile',
  source: 'source',
  sourceOfLead: 'source_of_lead',
  campaignId: 'campaign_id',
  campaignName: 'campaign_name',
  openCount: 'open_count',
  emailOpenCount: 'email_open_count',
  linkClicks: 'link_clicks',
  firstOpenedAt: 'first_opened_at',
  lastOpenedAt: 'last_opened_at',
  firstClickedAt: 'first_clicked_at',
  lastClickedAt: 'last_clicked_at',
  downloads: 'downloads',
  replies: 'replies',
  websiteVisits: 'website_visits',
  engagement: 'engagement_json',
  leadScore: 'lead_score',
  priority: 'priority',
  leadStatus: 'lead_status',
  calendarStatus: 'calendar_status',
  assignedTo: 'assigned_to',
  createdBy: 'created_by',
  createdDate: 'created_date',
  followUpDate: 'follow_up_date',
  followUpTime: 'follow_up_time',
  demoDate: 'demo_date',
  demoTime: 'demo_time',
  meetingDate: 'meeting_date',
  meetingTime: 'meeting_time',
  callbackDate: 'callback_date',
  callbackTime: 'callback_time',
  nextActionDate: 'next_action_date',
  nextActionTime: 'next_action_time',
  customerRequirements: 'customer_requirements',
  remarks: 'remarks',
  lastOpenTime: 'last_open_time',
  timeline: 'timeline_json',
  notes: 'notes_json',
  isConverted: 'is_converted',
  isScrapped: 'is_scrapped',
  reason: 'reason',
  quotationType: 'quotation_type',
  quotationId: 'quotation_id',
  products: 'products_json',
  quotationDetails: 'quotation_details_json',
  customerId: 'customer_id',
};

const stringFields = [
  'leadId', 'companyName', 'contactPerson', 'designation', 'email', 'mobile',
  'source', 'sourceOfLead', 'campaignId', 'campaignName', 'priority',
  'leadStatus', 'calendarStatus', 'assignedTo', 'createdBy', 'followUpDate',
  'followUpTime', 'demoDate', 'demoTime', 'meetingDate', 'meetingTime',
  'callbackDate', 'callbackTime', 'nextActionDate', 'nextActionTime',
  'customerRequirements', 'remarks', 'reason', 'quotationType',
  'quotationId', 'customerId',
];
const numericFields = [
  'openCount', 'emailOpenCount', 'linkClicks', 'downloads', 'replies',
  'websiteVisits', 'leadScore',
];
const dateFields = [
  'firstOpenedAt', 'lastOpenedAt', 'firstClickedAt', 'lastClickedAt',
  'createdDate', 'lastOpenTime',
];
const jsonFields = new Set(['engagement', 'timeline', 'notes', 'products', 'quotationDetails']);
const priorities = ['High', 'Medium', 'Low'];
const statuses = [
  'New', 'Contacted', 'Follow-up', 'Interested', 'Qualified', 'Proposal Sent',
  'Negotiation', 'Won', 'Lost', 'Scrapped',
];
const calendarStatuses = ['Pending', 'Completed'];
const quotationTypes = ['rent', 'sold'];
const engagementFields = ['emailOpens', 'linkClicks', 'brochureDownloads', 'replies', 'websiteVisits'];
const listFields = [
  '_id', 'leadId', 'quotationId', 'companyName', 'contactPerson', 'designation',
  'email', 'mobile', 'source', 'sourceOfLead', 'campaignId', 'campaignName',
  'leadScore', 'priority', 'leadStatus', 'assignedTo', 'createdBy', 'createdDate',
  'followUpDate', 'followUpTime', 'isConverted', 'isScrapped', 'reason',
  'demoDate', 'demoTime', 'meetingDate', 'meetingTime', 'callbackDate',
  'callbackTime', 'nextActionDate', 'nextActionTime',
  'timeline', 'notes', 'quotationType', 'products', 'quotationDetails',
];
const validSortFields = new Set([
  'createdDate', 'companyName', 'leadStatus', 'priority', 'assignedTo', 'leadScore',
]);
const columnNames = Object.values(fields);
const insertColumns = ['id', ...columnNames, 'created_at', 'updated_at'];
const selectColumns = ['id', ...columnNames, 'created_at', 'updated_at'];
const insertSql = db.prepare(`
  INSERT INTO leads (${insertColumns.map((column) => `"${column}"`).join(', ')})
  VALUES (${insertColumns.map(() => '?').join(', ')})
`);

const defaults = {
  leadId: undefined,
  companyName: '',
  contactPerson: 'Not provided',
  designation: '',
  email: 'noemail@noemail.com',
  mobile: '0000000000',
  source: 'Manual',
  sourceOfLead: 'Manual',
  campaignId: '',
  campaignName: '',
  openCount: 0,
  emailOpenCount: 0,
  linkClicks: 0,
  firstOpenedAt: null,
  lastOpenedAt: null,
  firstClickedAt: null,
  lastClickedAt: null,
  downloads: 0,
  replies: 0,
  websiteVisits: 0,
  engagement: Object.fromEntries(engagementFields.map((field) => [field, 0])),
  leadScore: 0,
  priority: 'Low',
  leadStatus: 'New',
  calendarStatus: 'Pending',
  assignedTo: 'Unassigned',
  createdBy: 'System',
  createdDate: null,
  followUpDate: '',
  followUpTime: '',
  demoDate: '',
  demoTime: '',
  meetingDate: '',
  meetingTime: '',
  callbackDate: '',
  callbackTime: '',
  nextActionDate: '',
  nextActionTime: '',
  customerRequirements: '',
  remarks: '',
  lastOpenTime: null,
  timeline: [],
  notes: [],
  isConverted: false,
  isScrapped: false,
  reason: '',
  quotationType: 'rent',
  quotationId: undefined,
  products: [],
  quotationDetails: {},
  customerId: '',
};

const validationError = (errors) => {
  const error = new Error(Object.values(errors).map((item) => item.message).join(', '));
  error.name = 'ValidationError';
  error.errors = errors;
  return error;
};

const jsonParse = (value, field) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Invalid JSON stored in leads.${field}.`, { cause: error });
  }
};

const toDateString = (value, field) => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const errors = { [field]: { message: `Cast to date failed for value "${value}" at path "${field}"` } };
    throw validationError(errors);
  }
  return date.toISOString();
};

const rowToLead = (row) => {
  if (!row) return null;
  const lead = { _id: String(row.id) };
  Object.entries(fields).forEach(([field, column]) => {
    const value = row[column];
    if (['leadId', 'quotationId'].includes(field) && value === null) {
      lead[field] = undefined;
    } else if (jsonFields.has(field)) {
      lead[field] = jsonParse(value || (field === 'timeline' || field === 'notes' || field === 'products' ? '[]' : '{}'), column);
    } else if (['isConverted', 'isScrapped'].includes(field)) {
      lead[field] = Boolean(value);
    } else if (numericFields.includes(field)) {
      lead[field] = Number(value || 0);
    } else {
      lead[field] = value;
    }
  });
  lead.createdAt = row.created_at;
  lead.updatedAt = row.updated_at;
  return lead;
};

const normalizeLead = (input, { partial = false, validate = true, allowActivityStatus = false } = {}) => {
  const lead = partial ? {} : { ...defaults };
  Object.entries(fields).forEach(([field]) => {
    if (!Object.prototype.hasOwnProperty.call(input, field) || input[field] === undefined) return;
    if (input[field] === null) {
      if (partial) lead[field] = null;
      return;
    }
    let value = input[field];
    if (stringFields.includes(field)) {
      value = String(value).trim();
      if (field === 'email') value = value.toLowerCase();
    } else if (numericFields.includes(field)) {
      value = Number(value);
    } else if (dateFields.includes(field)) {
      value = toDateString(value, field);
    } else if (field === 'isConverted' || field === 'isScrapped') {
      value = value === true || value === 1 || value === 'true' || value === '1';
    } else if (field === 'engagement' && value && typeof value === 'object' && !Array.isArray(value)) {
      value = Object.fromEntries(engagementFields.map((name) => [
        name,
        Object.hasOwn(value, name) ? Number(value[name]) : defaults.engagement[name],
      ]));
    } else if (field === 'timeline') {
      value = (Array.isArray(value) ? value : [value]).map((entry) => ({
        type: String(entry?.type || 'info').trim(),
        title: String(entry?.title || '').trim(),
        description: String(entry?.description || '').trim(),
        createdAt: toDateString(entry?.createdAt || new Date(), 'timeline.createdAt'),
      }));
    } else if (field === 'notes') {
      value = (Array.isArray(value) ? value : [value]).map((entry) => ({
        message: String(entry?.message || '').trim(),
        createdBy: String(entry?.createdBy || 'System').trim(),
        createdAt: toDateString(entry?.createdAt || new Date(), 'notes.createdAt'),
      }));
    } else if (field === 'products' && !Array.isArray(value)) {
      value = [value];
    }
    lead[field] = value;
  });

  if (!partial) {
    if (!lead.createdDate) lead.createdDate = new Date().toISOString();
    if (input._id !== undefined && input._id !== null) lead._id = String(input._id);
    if (input.createdAt !== undefined) lead.createdAt = toDateString(input.createdAt, 'createdAt');
    if (input.updatedAt !== undefined) lead.updatedAt = toDateString(input.updatedAt, 'updatedAt');
  }

  if (!validate) return lead;
  const errors = {};
  if (!partial || Object.hasOwn(lead, 'companyName')) {
    if (!lead.companyName) errors.companyName = { message: 'Company name is required' };
  }
  if (Object.hasOwn(lead, 'email') && !/^\S+@\S+\.\S+$/.test(lead.email)) {
    errors.email = { message: 'Please enter a valid email address' };
  }
  numericFields.forEach((field) => {
    if (Object.hasOwn(lead, field) && !Number.isFinite(lead[field])) {
      errors[field] = { message: `Cast to Number failed for value "${lead[field]}" at path "${field}"` };
    }
  });
  const checkEnum = (field, values) => {
    if (Object.hasOwn(lead, field) && !values.includes(lead[field])
      && !(allowActivityStatus && field === 'leadStatus' && lead[field] === 'Follow-up Scheduled')) {
      errors[field] = { message: `\`${lead[field]}\` is not a valid enum value for path \`${field}\`.` };
    }
  };
  checkEnum('priority', priorities);
  checkEnum('leadStatus', statuses);
  checkEnum('calendarStatus', calendarStatuses);
  checkEnum('quotationType', quotationTypes);
  if (Object.hasOwn(lead, 'engagement') && (!lead.engagement || typeof lead.engagement !== 'object' || Array.isArray(lead.engagement))) {
    errors.engagement = { message: 'Engagement must be an object.' };
  }
  if (Object.hasOwn(lead, 'timeline') && (!Array.isArray(lead.timeline)
    || lead.timeline.some((entry) => !entry || !String(entry.title || '').trim()))) {
    errors.timeline = { message: 'Timeline entry title is required.' };
  }
  if (Object.hasOwn(lead, 'notes') && (!Array.isArray(lead.notes)
    || lead.notes.some((entry) => !entry || !String(entry.message || '').trim()))) {
    errors.notes = { message: 'Note message is required.' };
  }
  if (Object.values(errors).length) throw validationError(errors);
  return lead;
};

const storageValues = (lead) => columnNames.map((column) => {
  const field = Object.keys(fields).find((key) => fields[key] === column);
  const value = lead[field];
  if (jsonFields.has(field)) return JSON.stringify(value ?? defaults[field]);
  if (field === 'isConverted' || field === 'isScrapped') return value ? 1 : 0;
  if (value === undefined) return null;
  return value;
});

const allocateLeadId = db.transaction(() => {
  db.prepare("UPDATE lead_sequences SET value = value + 1 WHERE name = 'lead'").run();
  const { value } = db.prepare("SELECT value FROM lead_sequences WHERE name = 'lead'").get();
  return `LD-${value}`;
});

const allocateQuotationId = db.transaction((prefix) => {
  const currentMaximum = db.prepare(`
    SELECT MAX(CAST(substr(quotation_id, length(?) + 1) AS INTEGER)) AS value
    FROM leads
    WHERE substr(quotation_id, 1, length(?)) = ?
      AND substr(quotation_id, length(?) + 1) REGEXP '^[0-9]{3}$'
  `).get(prefix, prefix, prefix, prefix).value || 0;
  db.prepare(`
    INSERT INTO quotation_sequences (prefix, value) VALUES (?, ?)
    ON CONFLICT(prefix) DO UPDATE SET value = MAX(value, excluded.value)
  `).run(prefix, currentMaximum);
  db.prepare('UPDATE quotation_sequences SET value = value + 1 WHERE prefix = ?').run(prefix);
  const { value } = db.prepare('SELECT value FROM quotation_sequences WHERE prefix = ?').get(prefix);
  return `${prefix}${String(value).padStart(3, '0')}`;
});

const createRecord = db.transaction((input) => {
  const lead = normalizeLead(input);
  lead._id = lead._id || randomUUID();
  lead.leadId = allocateLeadId();
  const now = new Date().toISOString();
  insertSql.run(lead._id, ...storageValues(lead), now, now);
  return rowToLead(db.prepare('SELECT * FROM leads WHERE id = ?').get(lead._id));
});

const importRecord = db.transaction((input) => {
  const lead = normalizeLead(input, { validate: false });
  lead._id = lead._id || randomUUID();
  const now = new Date().toISOString();
  const exists = db.prepare('SELECT * FROM leads WHERE id = ?').get(lead._id);
  if (exists) {
    const existing = rowToLead(exists);
    const comparedFields = Object.keys(fields).filter((field) => input[field] !== undefined);
    const identical = comparedFields.every((field) => isDeepStrictEqual(existing[field], lead[field]))
      && (input.createdAt === undefined || existing.createdAt === lead.createdAt)
      && (input.updatedAt === undefined || existing.updatedAt === lead.updatedAt);
    return { status: 'exists', identical, lead: existing };
  }
  const insert = db.prepare(`
    INSERT OR IGNORE INTO leads (${insertColumns.map((column) => `"${column}"`).join(', ')})
    VALUES (${insertColumns.map(() => '?').join(', ')})
  `);
  const result = insert.run(lead._id, ...storageValues(lead), lead.createdAt || now, lead.updatedAt || now);
  if (!result.changes) return { status: 'conflict', leadId: lead.leadId, quotationId: lead.quotationId };
  const leadSequence = /^LD-(\d+)$/.exec(lead.leadId || '');
  if (leadSequence) {
    db.prepare(`
      INSERT INTO lead_sequences (name, value) VALUES ('lead', ?)
      ON CONFLICT(name) DO UPDATE SET value = MAX(value, excluded.value)
    `).run(Number(leadSequence[1]));
  }
  return { status: 'inserted', lead: rowToLead(db.prepare('SELECT * FROM leads WHERE id = ?').get(lead._id)) };
});

const updateById = (id, changes, { allowActivityStatus = false } = {}) => {
  const currentRow = db.prepare('SELECT * FROM leads WHERE id = ?').get(String(id));
  if (!currentRow) return null;
  const existing = rowToLead(currentRow);
  const patch = normalizeLead(changes, { partial: true, allowActivityStatus });
  const next = { ...existing, ...patch };
  next._id = existing._id;
  const validated = normalizeLead(next, {
    allowActivityStatus: allowActivityStatus
      || (existing.leadStatus === 'Follow-up Scheduled' && !Object.hasOwn(patch, 'leadStatus')),
  });
  const now = new Date().toISOString();
  const assignments = columnNames.map((column) => `"${column}" = ?`).join(', ');
  db.prepare(`UPDATE leads SET ${assignments}, updated_at = ? WHERE id = ?`)
    .run(...storageValues(validated), now, existing._id);
  return rowToLead(db.prepare('SELECT * FROM leads WHERE id = ?').get(existing._id));
};

const list = ({
  page = 1,
  limit = 10,
  search = '',
  status = '',
  priority = '',
  source = '',
  assignedTo = '',
  campaign = '',
  quotationType = '',
  onlyQuotations,
  sortBy = 'createdDate',
  sortOrder = 'desc',
}) => {
  const conditions = [];
  const params = [];
  const addExact = (column, value) => {
    if (!value) return;
    conditions.push(`"${column}" = ?`);
    params.push(value);
  };
  if (search) {
    const pattern = `%${String(search).replace(/[\\%_]/g, '\\$&')}%`;
    conditions.push(`(
      company_name LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      contact_person LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      email LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      mobile LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      campaign_name LIKE ? ESCAPE '\\' COLLATE NOCASE
    )`);
    params.push(...Array(5).fill(pattern));
  }
  addExact('lead_status', status);
  addExact('priority', priority);
  if (source) {
    conditions.push('(source = ? OR source_of_lead = ?)');
    params.push(source, source);
  }
  addExact('assigned_to', assignedTo);
  if (campaign) {
    conditions.push('campaign_name = ? COLLATE NOCASE');
    params.push(campaign);
  }
  if (quotationType && quotationTypes.includes(String(quotationType).toLowerCase())) {
    addExact('quotation_type', String(quotationType).toLowerCase());
  }
  if (onlyQuotations === true) conditions.push("quotation_id IS NOT NULL AND quotation_id <> ''");
  if (onlyQuotations === false) conditions.push("(quotation_id IS NULL OR quotation_id = '')");

  const where = conditions.length ? conditions.join(' AND ') : '1 = 1';
  const sortField = validSortFields.has(sortBy) ? fields[sortBy] : fields.createdDate;
  const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pageNum = Math.max(Number.parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 100);
  const offset = (pageNum - 1) * limitNum;
  const rows = db.prepare(`
    SELECT ${selectColumns.map((column) => `"${column}"`).join(', ')}
    FROM leads WHERE ${where}
    ORDER BY "${sortField}" ${sortDirection}
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, offset);
  const total = db.prepare(`SELECT COUNT(*) AS total FROM leads WHERE ${where}`).get(...params).total;
  return {
    data: rows.map(rowToLead).map((lead) => Object.fromEntries(
      listFields.map((field) => [field, lead[field]]),
    )),
    pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
  };
};

const findForReport = ({ createdBy = '', createdDateStart = '', createdDateEnd = '', customerName = '', product = '' }) => {
  const conditions = [];
  const params = [];
  if (createdBy) {
    conditions.push('created_by = ? COLLATE NOCASE');
    params.push(createdBy);
  }
  if (createdDateStart) {
    conditions.push('datetime(created_date) >= datetime(?)');
    params.push(createdDateStart);
  }
  if (createdDateEnd) {
    conditions.push('datetime(created_date) < datetime(?)');
    params.push(createdDateEnd);
  }
  if (customerName) {
    conditions.push('company_name = ? COLLATE NOCASE');
    params.push(customerName);
  }
  if (product) {
    conditions.push(`EXISTS (
      SELECT 1 FROM json_each(leads.products_json) AS product_item
      WHERE json_extract(product_item.value, '$.productName') = ? COLLATE NOCASE
    )`);
    params.push(product);
  }
  const where = conditions.length ? conditions.join(' AND ') : '1 = 1';
  return db.prepare(`SELECT * FROM leads WHERE ${where}`).all(...params).map(rowToLead);
};

const findForUsage = ({ createdBy = '', createdDateStart = '', createdDateEnd = '' }) => {
  const conditions = [];
  const params = [];
  if (createdBy) {
    conditions.push('created_by = ? COLLATE NOCASE');
    params.push(createdBy);
  }
  if (createdDateStart) {
    conditions.push('datetime(created_date) >= datetime(?)');
    params.push(createdDateStart);
  }
  if (createdDateEnd) {
    conditions.push('datetime(created_date) < datetime(?)');
    params.push(createdDateEnd);
  }
  const where = conditions.length ? conditions.join(' AND ') : '1 = 1';
  return db.prepare(`SELECT created_by AS createdBy FROM leads WHERE ${where}`).all(...params);
};

const findValidEmailRecipients = (emailPattern) => db.prepare(`
  SELECT id AS _id, email FROM leads WHERE email REGEXP ?
`).all(emailPattern);

const updateEngagement = (id, { leadValues, openCount, clickCount }) => {
  const existing = findById(id);
  if (!existing) return null;
  return updateById(id, {
    ...leadValues,
    openCount: Number(openCount || 0),
    emailOpenCount: Number(openCount || 0),
    linkClicks: Number(clickCount || 0),
    engagement: {
      ...existing.engagement,
      emailOpens: Number(openCount || 0),
      linkClicks: Number(clickCount || 0),
    },
  });
};

const deleteByIdentifier = db.transaction((identifier) => {
  const row = db.prepare('SELECT * FROM leads WHERE id = ? OR lead_id = ? LIMIT 1')
    .get(String(identifier), String(identifier));
  if (!row) return null;
  db.prepare('DELETE FROM leads WHERE id = ?').run(row.id);
  return rowToLead(row);
});

const importLeadRecord = (record) => importRecord.immediate(record);
const inspectImportRecord = (input) => {
  const lead = normalizeLead(input, { validate: false });
  const existing = lead._id ? findById(lead._id) : null;
  if (!existing) return { status: 'ready' };
  const comparedFields = Object.keys(fields).filter((field) => input[field] !== undefined);
  const identical = comparedFields.every((field) => isDeepStrictEqual(existing[field], lead[field]))
    && (input.createdAt === undefined || existing.createdAt === lead.createdAt)
    && (input.updatedAt === undefined || existing.updatedAt === lead.updatedAt);
  return { status: 'exists', identical };
};

function findById(id) {
  return rowToLead(db.prepare('SELECT * FROM leads WHERE id = ?').get(String(id)));
}

module.exports = {
  fields,
  listFields,
  list,
  findById,
  findByLeadId: (leadId) => rowToLead(db.prepare('SELECT * FROM leads WHERE lead_id = ?').get(String(leadId))),
  findByEmail: (email) => rowToLead(db.prepare('SELECT * FROM leads WHERE email = ? COLLATE NOCASE LIMIT 1').get(String(email).trim())),
  findAll: () => db.prepare('SELECT * FROM leads').all().map(rowToLead),
  findForReport,
  findForUsage,
  findValidEmailRecipients,
  countValidEmails: (emailPattern) => db.prepare('SELECT COUNT(*) AS count FROM leads WHERE email REGEXP ?').get(emailPattern).count,
  create: (input) => createRecord.immediate(input),
  updateById,
  updateFromActivity: (id, changes) => updateById(id, changes, { allowActivityStatus: true }),
  updateEngagement,
  deleteByIdentifier: (identifier) => deleteByIdentifier.immediate(identifier),
  nextQuotationId: (prefix) => allocateQuotationId.immediate(prefix),
  importRecord: importLeadRecord,
  inspectImportRecord,
  isValidationError: (error) => error?.name === 'ValidationError',
};
