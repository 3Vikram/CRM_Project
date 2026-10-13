const { randomUUID } = require('crypto');
const { db } = require('../utils/salesDatabase');
const Counter = require('./Counter');
const CustomerBatch = require('./CustomerBatch');

const fields = {
  customerId: 'customer_id',
  customerName: 'customer_name',
  contactName: 'contact_name',
  designation: 'designation',
  mail: 'mail',
  contactNumber: 'contact_number',
  email: 'email',
  employeeId: 'employee_id',
  employeeEmail: 'employee_email',
  employeeName: 'employee_name',
  batchName: 'batch_name',
  batchNumber: 'batch_number',
  batchId: 'batch_id',
  calendarStatus: 'calendar_status',
  meetingDate: 'meeting_date',
  meetingTime: 'meeting_time',
  callReminderDate: 'call_reminder_date',
  callReminderTime: 'call_reminder_time',
  birthday: 'birthday',
  anniversary: 'anniversary',
  nextActionDate: 'next_action_date',
  nextActionTime: 'next_action_time',
  time: 'time',
};
const columns = Object.values(fields);
const defaults = {
  customerId: null,
  customerName: '',
  contactName: '',
  designation: '',
  mail: '',
  contactNumber: '',
  email: '',
  employeeId: '',
  employeeEmail: '',
  employeeName: '',
  batchName: '',
  batchNumber: null,
  batchId: null,
  calendarStatus: 'Pending',
  meetingDate: '',
  meetingTime: '',
  callReminderDate: '',
  callReminderTime: '',
  birthday: '',
  anniversary: '',
  nextActionDate: '',
  nextActionTime: '',
  time: '',
};
const sortColumns = {
  createdAt: 'created_at',
  customerName: 'customer_name',
  contactName: 'contact_name',
  email: 'email',
  contactNumber: 'contact_number',
};
const insertColumns = ['id', ...columns, 'created_at', 'updated_at'];
const insertStatement = db.prepare(`
  INSERT INTO contacts (${insertColumns.map((column) => `"${column}"`).join(', ')})
  VALUES (${insertColumns.map(() => '?').join(', ')})
`);
const insertBatchMembership = db.prepare(`
  INSERT INTO customer_batch_contacts (batch_id, contact_id, position)
  VALUES (?, ?, ?)
`);

const validationError = (errors) => {
  const error = new Error(Object.values(errors).map((item) => item.message).join(', '));
  error.name = 'ValidationError';
  error.errors = errors;
  return error;
};

const normalizeContact = (input = {}, { partial = false } = {}) => {
  const contact = partial ? {} : { ...defaults };
  Object.keys(fields).forEach((field) => {
    if (!Object.hasOwn(input, field) || input[field] === undefined) return;
    if (input[field] === null || input[field] === '') {
      if (partial) contact[field] = field === 'customerId' || field === 'batchId' || field === 'batchNumber'
        ? null
        : '';
      return;
    }
    if (field === 'batchNumber') {
      const number = Number(input[field]);
      if (!Number.isInteger(number)) {
        contact[field] = input[field];
      } else {
        contact[field] = number;
      }
      return;
    }
    const value = String(input[field]).trim();
    contact[field] = field === 'email' || field === 'employeeEmail' ? value.toLowerCase() : value;
  });

  const errors = {};
  if ((!partial || Object.hasOwn(contact, 'contactName')) && !contact.contactName) {
    errors.contactName = { message: 'Contact name is required' };
  }
  if ((!partial || Object.hasOwn(contact, 'contactNumber')) && !contact.contactNumber) {
    errors.contactNumber = { message: 'Contact number is required' };
  }
  if ((!partial || Object.hasOwn(contact, 'email')) && !contact.email) {
    errors.email = { message: 'Email is required' };
  } else if (Object.hasOwn(contact, 'email') && !/^\S+@\S+\.\S+$/.test(contact.email)) {
    errors.email = { message: 'Please enter a valid email address' };
  }
  if (Object.hasOwn(contact, 'batchNumber')
    && contact.batchNumber !== null
    && (!Number.isSafeInteger(contact.batchNumber) || contact.batchNumber < 1)) {
    errors.batchNumber = { message: '`batchNumber` must be a positive integer.' };
  }
  if (Object.hasOwn(contact, 'calendarStatus') && !['Pending', 'Completed'].includes(contact.calendarStatus)) {
    errors.calendarStatus = { message: `\`${contact.calendarStatus}\` is not a valid enum value for path \`calendarStatus\`.` };
  }
  if (Object.keys(errors).length) throw validationError(errors);

  if (!partial) {
    Object.keys(defaults).forEach((field) => {
      if (contact[field] === undefined) contact[field] = defaults[field];
    });
  }
  if (contact.employeeEmail) contact.employeeEmail = contact.employeeEmail.toLowerCase();
  return contact;
};

const rowToContact = (row) => {
  if (!row) return null;
  const contact = { _id: String(row.id) };
  Object.entries(fields).forEach(([field, column]) => {
    contact[field] = field === 'batchNumber' && row[column] !== null
      ? Number(row[column])
      : row[column];
  });
  contact.createdAt = row.created_at;
  contact.updatedAt = row.updated_at;
  return contact;
};

const storageValues = (contact) => columns.map((column) => {
  const field = Object.keys(fields).find((name) => fields[name] === column);
  return contact[field] === undefined ? defaults[field] : contact[field];
});

const insertRecord = (input, now = new Date().toISOString()) => {
  const contact = normalizeContact(input);
  const id = input._id ? String(input._id) : randomUUID();
  insertStatement.run(id, ...storageValues(contact), now, now);
  return findById(id);
};

function findById(id) {
  return rowToContact(db.prepare('SELECT * FROM contacts WHERE id = ?').get(String(id)));
}

const findForEmployee = (id, employeeId) => rowToContact(db.prepare(`
  SELECT * FROM contacts WHERE id = ? AND employee_id = ?
`).get(String(id), String(employeeId)));

const createRecord = db.transaction((input) => insertRecord(input));

const updateForEmployee = (id, employeeId, input) => {
  const existing = findForEmployee(id, employeeId);
  if (!existing) return null;
  const patch = normalizeContact(input, { partial: true });
  const updated = normalizeContact({ ...existing, ...patch });
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE contacts
    SET ${columns.map((column) => `"${column}" = ?`).join(', ')}, updated_at = ?
    WHERE id = ? AND employee_id = ?
  `).run(...storageValues(updated), now, String(id), String(employeeId));
  return findForEmployee(id, employeeId);
};

const deleteForEmployee = (id, employeeId) => {
  const contact = findForEmployee(id, employeeId);
  if (!contact) return null;
  const batchId = contact.batchId;
  const remove = db.transaction(() => {
    db.prepare('DELETE FROM customer_batch_contacts WHERE contact_id = ?').run(contact._id);
    db.prepare('DELETE FROM contacts WHERE id = ? AND employee_id = ?').run(contact._id, String(employeeId));
    if (batchId) {
      db.prepare(`
        UPDATE customer_batches
        SET customer_count = (SELECT COUNT(*) FROM customer_batch_contacts WHERE batch_id = ?),
            updated_at = ?
        WHERE id = ?
      `).run(batchId, new Date().toISOString(), batchId);
    }
  });
  remove.immediate();
  return contact;
};

const getBatchSummaries = (employeeId = '') => {
  const params = [];
  const conditions = ["(batch_number >= 1 OR (batch_name IS NOT NULL AND batch_name <> ''))"];
  if (employeeId) {
    conditions.push('employee_id = ?');
    params.push(String(employeeId));
  }
  return db.prepare(`
    WITH normalized AS (
      SELECT CASE
          WHEN batch_number >= 1 THEN batch_number
          WHEN batch_name REGEXP '^Batch [0-9]+$' THEN CAST(substr(batch_name, 7) AS INTEGER)
          ELSE NULL
        END AS batchNumber,
        batch_name AS name
      FROM contacts
      WHERE ${conditions.join(' AND ')}
    )
    SELECT batchNumber,
           CASE WHEN batchNumber > 0 THEN 'Batch ' || batchNumber ELSE MIN(name) END AS name,
           COUNT(*) AS count
    FROM normalized
    WHERE batchNumber IS NOT NULL
    GROUP BY batchNumber
    ORDER BY batchNumber
  `).all(...params);
};

const getOwnerSummaries = () => db.prepare(`
  SELECT employee_id AS employeeId,
         MAX(employee_email) AS employeeEmail,
         MAX(employee_name) AS employeeName,
         COUNT(*) AS count
  FROM contacts
  WHERE employee_id NOT IN ('', 'null')
  GROUP BY employee_id
`).all();

const getBatchOwnerCounts = () => db.prepare(`
  SELECT employee_id AS employeeId, batch_number AS batchNumber, COUNT(*) AS count
  FROM contacts
  WHERE employee_id NOT IN ('', 'null') AND batch_number >= 1
  GROUP BY employee_id, batch_number
`).all();

const importBatch = db.transaction((inputContacts, identity, fileName) => {
  const validContacts = [];
  const seenEmails = new Set();
  const seenNumbers = new Set();
  let skipped = 0;
  const findExisting = db.prepare(`
    SELECT 1 FROM contacts
    WHERE email = ? COLLATE NOCASE OR contact_number = ?
    LIMIT 1
  `);

  inputContacts.forEach((input) => {
    const contact = normalizeContact(input);
    const email = contact.email.toLowerCase();
    const number = contact.contactNumber;
    if (seenEmails.has(email) || seenNumbers.has(number) || findExisting.get(email, number)) {
      skipped += 1;
      return;
    }
    seenEmails.add(email);
    seenNumbers.add(number);
    validContacts.push(contact);
  });

  if (!validContacts.length) return { contacts: [], batch: null, skipped };

  const employeeId = String(identity.employeeId || '');
  const highestContactBatch = db.prepare(`
    SELECT COALESCE(MAX(batch_number), 0) AS value
    FROM contacts WHERE employee_id = ?
  `).get(employeeId).value;
  const highestStoredBatch = db.prepare(`
    SELECT COALESCE(MAX(batch_number), 0) AS value
    FROM customer_batches WHERE employee_id = ?
  `).get(employeeId).value;
  const batchNumber = Counter.next(`contactBatch:${employeeId}`, Math.max(highestContactBatch, highestStoredBatch));
  const batchName = `Batch ${batchNumber}`;
  const batchId = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO customer_batches (
      id, batch_name, batch_number, employee_id, employee_email, employee_name,
      customer_count, file_name, created_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    batchId,
    batchName,
    batchNumber,
    employeeId,
    String(identity.employeeEmail || '').trim().toLowerCase(),
    String(identity.employeeName || ''),
    validContacts.length,
    String(fileName || ''),
    now,
    now,
    now,
  );

  const inserted = validContacts.map((contact, position) => {
    const record = insertRecord({
      ...contact,
      ...identity,
      batchName,
      batchNumber,
      batchId,
    }, now);
    insertBatchMembership.run(batchId, record._id, position);
    return record;
  });
  return {
    contacts: inserted,
    batch: CustomerBatch.findById(batchId),
    skipped,
  };
});

const list = ({
  page = 1,
  limit = 10,
  sortBy = 'createdAt',
  sortOrder = 'desc',
  search = '',
  batchName = '',
  batchNumber = '',
  batchId = '',
  employeeId = '',
} = {}) => {
  const conditions = [];
  const params = [];
  if (employeeId) {
    conditions.push('employee_id = ?');
    params.push(String(employeeId));
  }
  if (search) {
    const pattern = `%${String(search).replace(/[\\%_]/g, '\\$&')}%`;
    conditions.push(`(
      customer_name LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      contact_name LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      designation LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      contact_number LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      email LIKE ? ESCAPE '\\' COLLATE NOCASE
    )`);
    params.push(...Array(5).fill(pattern));
  }
  if (batchName) {
    conditions.push('batch_name = ?');
    params.push(String(batchName));
  }
  if (batchNumber && Number.isInteger(Number(batchNumber))) {
    conditions.push('batch_number = ?');
    params.push(Number(batchNumber));
  }
  if (batchId) {
    conditions.push('batch_id = ?');
    params.push(String(batchId));
  }

  const where = conditions.length ? conditions.join(' AND ') : '1 = 1';
  const sortColumn = sortColumns[sortBy] || sortColumns.createdAt;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pageNumber = Math.max(Number.parseInt(page, 10) || 1, 1);
  const pageLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 100);
  const rows = db.prepare(`
    SELECT * FROM contacts WHERE ${where}
    ORDER BY "${sortColumn}" ${direction}, id
    LIMIT ? OFFSET ?
  `).all(...params, pageLimit, (pageNumber - 1) * pageLimit);
  const total = db.prepare(`SELECT COUNT(*) AS total FROM contacts WHERE ${where}`).get(...params).total;
  return {
    data: rows.map((row) => {
      const contact = rowToContact(row);
      return {
        _id: contact._id,
        customerId: contact.customerId,
        customerName: contact.customerName,
        contactName: contact.contactName,
        designation: contact.designation,
        mail: contact.mail,
        contactNumber: contact.contactNumber,
        email: contact.email,
        batchName: contact.batchName,
        batchNumber: contact.batchNumber,
        employeeId: contact.employeeId,
        employeeEmail: contact.employeeEmail,
        employeeName: contact.employeeName,
        batchId: contact.batchId,
        createdAt: contact.createdAt,
      };
    }),
    pagination: {
      total,
      page: pageNumber,
      limit: pageLimit,
      totalPages: Math.ceil(total / pageLimit),
    },
  };
};

const updateCalendarStatus = (id, status) => {
  if (!['Pending', 'Completed'].includes(status)) throw validationError({ calendarStatus: { message: 'Invalid calendar status.' } });
  const result = db.prepare(`
    UPDATE contacts SET calendar_status = ?, updated_at = ? WHERE id = ?
  `).run(status, new Date().toISOString(), String(id));
  return result.changes ? findById(id) : null;
};

const updateCalendarDate = (id, sourceField, value) => {
  const allowed = new Set(['meetingDate', 'callReminderDate', 'birthday', 'anniversary', 'nextActionDate']);
  if (!allowed.has(sourceField)) throw new TypeError('Unsupported Contact calendar field.');
  const column = sourceField.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  const existingColumns = new Set(db.pragma('table_info(contacts)').map((columnInfo) => columnInfo.name));
  if (!existingColumns.has(column)) return null;
  const result = db.prepare(`UPDATE contacts SET "${column}" = ?, updated_at = ? WHERE id = ?`)
    .run(String(value), new Date().toISOString(), String(id));
  return result.changes ? findById(id) : null;
};

const findCampaignRecipients = ({
  contactIds = [],
  employeeId = '',
  batchName = '',
  batchNumber = null,
  batchId = '',
  emailPattern = '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
} = {}) => {
  if (!employeeId) return [];
  const conditions = ['employee_id = ?', 'email REGEXP ?'];
  const params = [String(employeeId), String(emailPattern)];
  if (contactIds.length) {
    conditions.push(`id IN (${contactIds.map(() => '?').join(', ')})`);
    params.push(...contactIds.map(String));
  }
  if (batchName) {
    conditions.push('batch_name = ?');
    params.push(String(batchName));
  }
  if (Number.isInteger(Number(batchNumber)) && Number(batchNumber) > 0) {
    conditions.push('batch_number = ?');
    params.push(Number(batchNumber));
  }
  if (batchId) {
    conditions.push('batch_id = ?');
    params.push(String(batchId));
  }
  return db.prepare(`
    SELECT id AS _id, email FROM contacts WHERE ${conditions.join(' AND ')}
  `).all(...params).map((contact) => ({ ...contact, email: String(contact.email || '').trim().toLowerCase() }));
};

module.exports = {
  normalizeContact,
  rowToContact,
  list,
  findById,
  findForEmployee,
  findByEmail: (email) => rowToContact(db.prepare('SELECT * FROM contacts WHERE email = ? COLLATE NOCASE LIMIT 1').get(String(email).trim())),
  findAll: () => db.prepare('SELECT * FROM contacts ORDER BY datetime(created_at), id').all().map(rowToContact),
  findNames: () => db.prepare('SELECT id AS _id, contact_name AS contactName, email FROM contacts ORDER BY contact_name COLLATE NOCASE').all(),
  findOwnerSummaries: getOwnerSummaries,
  findBatchOwnerCounts: getBatchOwnerCounts,
  getBatchSummaries,
  findValidEmailRecipients: (pattern) => db.prepare('SELECT id AS _id, email FROM contacts WHERE email REGEXP ?').all(pattern),
  countValidEmails: (pattern) => db.prepare('SELECT COUNT(*) AS count FROM contacts WHERE email REGEXP ?').get(pattern).count,
  findCampaignRecipients,
  findValidEmailRecipients: (pattern, employeeId = '') => {
    const condition = employeeId ? 'email REGEXP ? AND employee_id = ?' : 'email REGEXP ?';
    const params = employeeId ? [pattern, String(employeeId)] : [pattern];
    return db.prepare(`SELECT id AS _id, email FROM contacts WHERE ${condition}`).all(...params);
  },
  countValidEmailsForEmployee: (pattern, employeeId = '') => {
    const condition = employeeId ? 'email REGEXP ? AND employee_id = ?' : 'email REGEXP ?';
    const params = employeeId ? [pattern, String(employeeId)] : [pattern];
    return db.prepare(`SELECT COUNT(*) AS count FROM contacts WHERE ${condition}`).get(...params).count;
  },
  findForUsage: ({ createdDateStart = '', createdDateEnd = '' } = {}) => {
    const conditions = [];
    const params = [];
    if (createdDateStart) {
      conditions.push('datetime(created_at) >= datetime(?)');
      params.push(createdDateStart);
    }
    if (createdDateEnd) {
      conditions.push('datetime(created_at) < datetime(?)');
      params.push(createdDateEnd);
    }
    return db.prepare(`SELECT created_at FROM contacts${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''}`)
      .all(...params).map((row) => ({ createdAt: row.created_at }));
  },
  create: (input) => createRecord.immediate(input),
  updateForEmployee,
  updateById: (id, changes) => {
    const existing = findById(id);
    if (!existing) return null;
    const updated = normalizeContact({ ...existing, ...normalizeContact(changes, { partial: true }) });
    db.prepare(`UPDATE contacts SET ${columns.map((column) => `"${column}" = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
      .run(...storageValues(updated), new Date().toISOString(), String(id));
    return findById(id);
  },
  deleteForEmployee,
  importBatch: (contacts, identity, fileName) => importBatch.immediate(contacts, identity, fileName),
  updateCalendarStatus,
  updateCalendarDate,
  isValidationError: (error) => error?.name === 'ValidationError',
};
