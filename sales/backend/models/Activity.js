const { randomUUID } = require('crypto');
const { db } = require('../utils/salesDatabase');

const fields = [
  'activityId',
  'leadId',
  'leadSource',
  'customerName',
  'contactPerson',
  'designation',
  'email',
  'mobileNo',
  'sourceOfLead',
  'customerRequirements',
  'customerRemarks',
  'assignedUser',
  'leadIdLabel',
  'company',
  'priority',
  'campaign',
  'activityType',
  'activityDate',
  'location',
  'response',
  'followUp',
  'product',
  'tagResource',
  'followUpDate',
  'reminder',
  'status',
  'createdBy',
  'lastModifiedBy',
];

const statuses = ['Open', 'Pending', 'Completed', 'Overdue'];
const fieldSet = new Set(fields);
const idColumn = db.pragma('table_info(activities)').find((column) => column.name === 'id');
const integerPrimaryKey = idColumn?.type.toUpperCase() === 'INTEGER' && idColumn.pk === 1;
const activeById = db.prepare('SELECT * FROM activities WHERE id = ? AND deletedAt IS NULL');
const findOpenLeadActivity = db.prepare(`
  SELECT * FROM activities
  WHERE leadId = ? AND deletedAt IS NULL AND status IN ('Open', 'Pending')
  LIMIT 1
`);

const createRecord = db.prepare(integerPrimaryKey
  ? `INSERT INTO activities (${fields.map((field) => `"${field}"`).join(', ')}, createdAt, updatedAt)
     VALUES (${fields.map(() => '?').join(', ')}, ?, ?)`
  : `INSERT INTO activities (id, ${fields.map((field) => `"${field}"`).join(', ')}, createdAt, updatedAt)
     VALUES (?, ${fields.map(() => '?').join(', ')}, ?, ?)`);

const insertActivity = db.transaction((payload) => {
  if (payload.leadId) {
    const existing = findOpenLeadActivity.get(payload.leadId);
    if (existing) {
      const error = new Error('Activity already exists for this Lead.');
      error.code = 'ACTIVITY_OPEN_EXISTS';
      error.activity = existing;
      throw error;
    }
  }

  const existingIds = db.prepare(`
    SELECT activityId FROM activities
    WHERE activityId REGEXP '^ACT-[0-9]+$'
  `).all();
  const nextNumericId = existingIds.reduce((max, activity) => {
    const numericPart = Number(activity.activityId.slice(4));
    return Number.isSafeInteger(numericPart) ? Math.max(max, numericPart) : max;
  }, 0) + 1;
  const activityId = `ACT-${nextNumericId}`;
  const now = new Date().toISOString();

  const newId = integerPrimaryKey ? null : randomUUID();
  const inserted = createRecord.run(
    ...(integerPrimaryKey ? [] : [newId]),
    ...fields.map((field) => (field === 'activityId' ? activityId : payload[field])),
    now,
    now,
  );

  return db.prepare('SELECT * FROM activities WHERE id = ?').get(
    integerPrimaryKey ? String(inserted.lastInsertRowid) : newId,
  );
});

const list = ({ where, params, sortBy, sortOrder, limit, offset }) => {
  const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
  return db.prepare(`
    SELECT * FROM activities
    WHERE ${where}
    ORDER BY "${sortBy}" ${order}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
};

const count = (where, params) => db.prepare(`SELECT COUNT(*) AS total FROM activities WHERE ${where}`).get(...params).total;

const findActive = () => db.prepare('SELECT * FROM activities WHERE deletedAt IS NULL').all()
  .map((activity) => ({ ...activity, _id: String(activity.id) }));

const findForUsage = ({ createdByPattern, createdDateStart, createdDateEnd }) => {
  const conditions = ['deletedAt IS NULL'];
  const params = [];
  if (createdByPattern) {
    conditions.push('createdBy REGEXP ?');
    params.push(createdByPattern);
  }
  if (createdDateStart) {
    conditions.push('datetime(createdAt) >= datetime(?)');
    params.push(createdDateStart);
  }
  if (createdDateEnd) {
    conditions.push('datetime(createdAt) < datetime(?)');
    params.push(createdDateEnd);
  }
  return db.prepare(`SELECT createdBy FROM activities WHERE ${conditions.join(' AND ')}`).all(...params);
};

const updateActive = (id, changes) => {
  const keys = Object.keys(changes).filter((field) => fieldSet.has(field) || field === 'deletedAt');
  if (keys.length === 0) return db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  const assignments = keys.map((field) => `"${field}" = ?`);
  assignments.push('"updatedAt" = ?');
  db.prepare(`
    UPDATE activities SET ${assignments.join(', ')}
    WHERE id = ? AND deletedAt IS NULL
  `).run(...keys.map((field) => changes[field]), new Date().toISOString(), id);
  return db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
};

const softDelete = (id) => {
  const now = new Date().toISOString();
  return db.prepare(`
    UPDATE activities SET deletedAt = ?, updatedAt = ?
    WHERE id = ? AND deletedAt IS NULL
  `).run(now, now, id).changes;
};

module.exports = {
  fields,
  statuses,
  list,
  count,
  findById: (id) => activeById.get(id),
  findOpenByLead: (leadId) => findOpenLeadActivity.get(leadId),
  findActive,
  findForUsage,
  create: (payload) => insertActivity.immediate(payload),
  update: updateActive,
  softDelete,
};
