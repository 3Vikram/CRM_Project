const { randomUUID } = require('crypto');
const { db } = require('../utils/salesDatabase');

const jsonFields = new Set(['billToAddress', 'shipToAddress', 'contacts', 'documents']);
const fields = {
  customerId: 'customer_id',
  companyName: 'company_name',
  gstNumber: 'gst_number',
  panNumber: 'pan_number',
  website: 'website',
  industry: 'industry',
  state: 'state',
  billToAddress: 'bill_to_address_json',
  shipToSameAsBilling: 'ship_to_same_as_billing',
  shipToAddress: 'ship_to_address_json',
  contacts: 'contacts_json',
  customerName: 'customer_name',
  email: 'email',
  phone: 'phone',
  documents: 'documents_json',
  status: 'status',
  calendarStatus: 'calendar_status',
  meetingDate: 'meeting_date',
  meetingTime: 'meeting_time',
  renewalDate: 'renewal_date',
  renewalTime: 'renewal_time',
  contractExpiryDate: 'contract_expiry_date',
  contractExpiryTime: 'contract_expiry_time',
  visitDate: 'visit_date',
  visitTime: 'visit_time',
  nextActionDate: 'next_action_date',
  nextActionTime: 'next_action_time',
  accountType: 'account_type',
  createdBy: 'created_by',
  notes: 'notes',
};
const columns = Object.values(fields);
const insertColumns = ['id', ...columns, 'created_at', 'updated_at'];
const stringFields = [
  'customerId', 'companyName', 'gstNumber', 'panNumber', 'website', 'industry',
  'state', 'customerName', 'email', 'phone', 'status', 'calendarStatus',
  'accountType', 'createdBy', 'notes', 'meetingDate', 'meetingTime',
  'renewalDate', 'renewalTime', 'contractExpiryDate', 'contractExpiryTime',
  'visitDate', 'visitTime', 'nextActionDate', 'nextActionTime',
];
const defaults = {
  customerId: undefined,
  companyName: '',
  gstNumber: '',
  panNumber: '',
  website: '',
  industry: '',
  state: '',
  billToAddress: {},
  shipToSameAsBilling: true,
  shipToAddress: {},
  contacts: [],
  customerName: '',
  email: '',
  phone: '',
  documents: [],
  status: 'Active',
  calendarStatus: 'Pending',
  meetingDate: '',
  meetingTime: '',
  renewalDate: '',
  renewalTime: '',
  contractExpiryDate: '',
  contractExpiryTime: '',
  visitDate: '',
  visitTime: '',
  nextActionDate: '',
  nextActionTime: '',
  accountType: 'Individual',
  createdBy: '',
  notes: '',
};
const validSortFields = new Set(['createdAt', 'companyName', 'customerName', 'status', 'createdBy', 'email']);

const validationError = (errors) => {
  const error = new Error(Object.values(errors).map((item) => item.message).join(', '));
  error.name = 'ValidationError';
  error.errors = errors;
  return error;
};

const toIsoDate = (value, field) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw validationError({ [field]: { message: `Cast to date failed for value "${value}" at path "${field}"` } });
  }
  return date.toISOString();
};

const parseJson = (value, field) => {
  try {
    return JSON.parse(value || (field === 'contacts' || field === 'documents' ? '[]' : '{}'));
  } catch (error) {
    throw new Error(`Invalid JSON stored in customers.${field}.`, { cause: error });
  }
};

const normalizeAddress = (address = {}) => Object.fromEntries(
  ['addressLine1', 'area', 'country', 'state', 'city', 'pincode']
    .map((field) => [field, String(address?.[field] ?? '').trim()]),
);

const normalizeContact = (contact = {}) => ({
  contactType: String(contact.contactType ?? '').trim(),
  name: String(contact.name ?? '').trim(),
  email: String(contact.email ?? '').trim().toLowerCase(),
  phone: String(contact.phone ?? '').trim(),
  designation: String(contact.designation ?? '').trim(),
});

const normalizeDocument = (document = {}, index) => ({
  fileName: String(document.fileName ?? '').trim(),
  filePath: String(document.filePath ?? '').trim(),
  uploadDate: document.uploadDate ? toIsoDate(document.uploadDate, `documents.${index}.uploadDate`) : new Date().toISOString(),
  customerId: document.customerId ? String(document.customerId) : undefined,
  documentType: String(document.documentType ?? '').trim(),
});

const normalizeCustomer = (input, { partial = false } = {}) => {
  const customer = partial ? {} : { ...defaults };
  Object.entries(fields).forEach(([field]) => {
    if (!Object.hasOwn(input, field) || input[field] === undefined) return;
    if (input[field] === null) {
      if (partial) customer[field] = null;
      return;
    }
    if (stringFields.includes(field)) {
      customer[field] = String(input[field]).trim();
      if (field === 'email') customer[field] = customer[field].toLowerCase();
      if (field === 'gstNumber' || field === 'panNumber') customer[field] = customer[field].toUpperCase();
      return;
    }
    if (field === 'shipToSameAsBilling') {
      customer[field] = input[field] === true || input[field] === 1 || input[field] === 'true' || input[field] === '1';
      return;
    }
    if (field === 'billToAddress' || field === 'shipToAddress') {
      customer[field] = normalizeAddress(input[field]);
      return;
    }
    if (field === 'contacts') {
      customer[field] = (Array.isArray(input[field]) ? input[field] : [input[field]]).map(normalizeContact);
      return;
    }
    if (field === 'documents') {
      customer[field] = (Array.isArray(input[field]) ? input[field] : [input[field]]).map(normalizeDocument);
    }
  });

  const errors = {};
  if (!partial || Object.hasOwn(customer, 'companyName')) {
    if (!customer.companyName) errors.companyName = { message: 'Company name is required' };
  }
  if (!partial || Object.hasOwn(customer, 'createdBy')) {
    if (!customer.createdBy) errors.createdBy = { message: 'Created By is required' };
  }
  if (customer.contacts && (!Array.isArray(customer.contacts) || customer.contacts.length === 0)) {
    errors.contacts = { message: 'At least one contact is required' };
  }
  (customer.contacts || []).forEach((contact, index) => {
    if (!contact.name) errors[`contacts.${index}.name`] = { message: 'Contact name is required' };
    if (!contact.phone) errors[`contacts.${index}.phone`] = { message: 'Contact number is required' };
    if (!/^\S+@\S+\.\S+$/.test(contact.email)) {
      errors[`contacts.${index}.email`] = { message: 'Please enter a valid email address' };
    }
  });
  if (Object.hasOwn(customer, 'email') && customer.email && !/^\S+@\S+\.\S+$/.test(customer.email)) {
    errors.email = { message: 'Please enter a valid email address' };
  }
  if (Object.hasOwn(customer, 'status') && !['Active', 'Inactive'].includes(customer.status)) {
    errors.status = { message: `\`${customer.status}\` is not a valid enum value for path \`status\`.` };
  }
  if (Object.hasOwn(customer, 'calendarStatus') && !['Pending', 'Completed'].includes(customer.calendarStatus)) {
    errors.calendarStatus = { message: `\`${customer.calendarStatus}\` is not a valid enum value for path \`calendarStatus\`.` };
  }
  if (Object.hasOwn(customer, 'accountType') && !['Individual', 'Business', 'Enterprise'].includes(customer.accountType)) {
    errors.accountType = { message: `\`${customer.accountType}\` is not a valid enum value for path \`accountType\`.` };
  }
  if (Object.keys(errors).length) throw validationError(errors);

  if (customer.contacts?.length) {
    customer.customerName = customer.contacts[0].name;
    customer.email = customer.contacts[0].email;
    customer.phone = customer.contacts[0].phone;
  }
  return customer;
};

const rowToCustomer = (row) => {
  if (!row) return null;
  const customer = { _id: String(row.id) };
  Object.entries(fields).forEach(([field, column]) => {
    const value = row[column];
    if (jsonFields.has(field)) customer[field] = parseJson(value, field);
    else if (field === 'shipToSameAsBilling') customer[field] = Boolean(value);
    else customer[field] = value;
  });
  customer.createdAt = row.created_at;
  customer.updatedAt = row.updated_at;
  return customer;
};

const storageValues = (customer) => columns.map((column) => {
  const field = Object.keys(fields).find((key) => fields[key] === column);
  const value = customer[field] ?? defaults[field];
  if (jsonFields.has(field)) return JSON.stringify(value);
  if (field === 'shipToSameAsBilling') return value ? 1 : 0;
  return value === undefined ? null : value;
});

const allocateCustomerId = db.transaction(() => {
  db.prepare("UPDATE customer_sequences SET value = value + 1 WHERE name = 'customer'").run();
  const { value } = db.prepare("SELECT value FROM customer_sequences WHERE name = 'customer'").get();
  return `CI-${value}`;
});

const insertSql = db.prepare(`
  INSERT INTO customers (${insertColumns.map((column) => `"${column}"`).join(', ')})
  VALUES (${insertColumns.map(() => '?').join(', ')})
`);

const createRecord = db.transaction((input) => {
  const customer = normalizeCustomer(input);
  customer._id = input._id ? String(input._id) : randomUUID();
  customer.customerId = customer.customerId || allocateCustomerId();
  const now = new Date().toISOString();
  insertSql.run(customer._id, ...storageValues(customer), now, now);
  return rowToCustomer(db.prepare('SELECT * FROM customers WHERE id = ?').get(customer._id));
});

const updateById = (id, changes) => {
  const existing = findById(id);
  if (!existing) return null;
  const patch = normalizeCustomer(changes, { partial: true });
  const updated = normalizeCustomer({ ...existing, ...patch, customerId: existing.customerId });
  const now = new Date().toISOString();
  db.prepare(`UPDATE customers SET ${columns.map((column) => `"${column}" = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
    .run(...storageValues(updated), now, existing._id);
  return findById(existing._id);
};

const findById = (id) => rowToCustomer(db.prepare('SELECT * FROM customers WHERE id = ?').get(String(id)));

const ensureCustomerIds = db.transaction(() => {
  const rows = db.prepare('SELECT id, customer_id FROM customers ORDER BY created_at, id').all();
  let highest = db.prepare(`
    SELECT COALESCE(MAX(CAST(substr(customer_id, 4) AS INTEGER)), 0) AS value
    FROM customers WHERE customer_id REGEXP '^CI-[0-9]+$'
  `).get().value;
  const update = db.prepare('UPDATE customers SET customer_id = ? WHERE id = ?');
  for (const row of rows) {
    if (/^CI-\d+$/.test(String(row.customer_id || ''))) continue;
    highest += 1;
    update.run(`CI-${highest}`, row.id);
  }
  db.prepare(`
    INSERT INTO customer_sequences (name, value) VALUES ('customer', ?)
    ON CONFLICT(name) DO UPDATE SET value = MAX(value, excluded.value)
  `).run(highest);
});

const list = ({
  page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc',
  search = '', createdBy = '', status = '', accountType = '',
  createdDateStart = '', createdDateEnd = '',
} = {}) => {
  const conditions = [];
  const params = [];
  if (search) {
    const pattern = `%${String(search).replace(/[\\%_]/g, '\\$&')}%`;
    conditions.push(`(
      customer_name LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      company_name LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      email LIKE ? ESCAPE '\\' COLLATE NOCASE OR phone LIKE ? ESCAPE '\\' COLLATE NOCASE
    )`);
    params.push(pattern, pattern, pattern, pattern);
  }
  if (createdBy) {
    conditions.push('created_by = ? COLLATE NOCASE');
    params.push(createdBy);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (accountType) {
    conditions.push('account_type = ?');
    params.push(accountType);
  }
  if (createdDateStart) {
    conditions.push("datetime(created_at) >= datetime(?)");
    params.push(createdDateStart);
  }
  if (createdDateEnd) {
    conditions.push("datetime(created_at) <= datetime(?)");
    params.push(createdDateEnd);
  }
  const where = conditions.length ? conditions.join(' AND ') : '1 = 1';
  const sortColumns = {
    createdAt: 'created_at',
    companyName: 'company_name',
    customerName: 'customer_name',
    status: 'status',
    createdBy: 'created_by',
    email: 'email',
  };
  const sortColumn = sortColumns[sortBy] || sortColumns.createdAt;
  const orderBy = sortColumn === 'created_at' ? 'datetime(created_at)' : `"${sortColumn}"`;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pageNum = Math.max(Number.parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 100);
  const rows = db.prepare(`
    SELECT * FROM customers WHERE ${where}
    ORDER BY ${orderBy} ${direction}
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, (pageNum - 1) * limitNum);
  const total = db.prepare(`SELECT COUNT(*) AS total FROM customers WHERE ${where}`).get(...params).total;
  return {
    data: rows.map(rowToCustomer),
    pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
  };
};

const findAll = (filters = {}) => {
  const conditions = [];
  const params = [];
  if (filters.createdBy) {
    conditions.push('created_by = ? COLLATE NOCASE');
    params.push(filters.createdBy);
  }
  if (filters.createdDateStart) {
    conditions.push('datetime(created_at) >= datetime(?)');
    params.push(filters.createdDateStart);
  }
  if (filters.createdDateEnd) {
    conditions.push('datetime(created_at) < datetime(?)');
    params.push(filters.createdDateEnd);
  }
  return db.prepare(`SELECT * FROM customers${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''}`)
    .all(...params).map(rowToCustomer);
};

const findByName = (name) => rowToCustomer(db.prepare(`
  SELECT * FROM customers
  WHERE customer_name = ? COLLATE NOCASE OR company_name = ? COLLATE NOCASE
  ORDER BY datetime(created_at) DESC LIMIT 1
`).get(String(name).trim(), String(name).trim()));

const addContact = db.transaction((id, contact) => {
  const customer = findById(id);
  if (!customer) return null;
  const normalized = normalizeContact(contact);
  const alreadyLinked = customer.contacts.some((existing) => (
    existing.email.toLowerCase() === normalized.email.toLowerCase()
    || existing.phone.replace(/\D/g, '') === normalized.phone.replace(/\D/g, '')
  ));
  if (alreadyLinked) return customer;
  return updateById(id, { contacts: [...customer.contacts, normalized] });
});

const deleteById = (id) => {
  const customer = findById(id);
  if (!customer) return null;
  db.prepare('DELETE FROM customers WHERE id = ?').run(customer._id);
  return customer;
};

module.exports = {
  fields,
  normalizeCustomer,
  rowToCustomer,
  ensureCustomerIds: () => ensureCustomerIds.immediate(),
  list,
  findAll,
  findById,
  findByEmail: (email) => rowToCustomer(db.prepare('SELECT * FROM customers WHERE email = ? COLLATE NOCASE LIMIT 1').get(String(email).trim())),
  findByName,
  countValidEmails: (pattern) => db.prepare('SELECT COUNT(*) AS count FROM customers WHERE email REGEXP ?').get(pattern).count,
  create: (input) => createRecord.immediate(input),
  updateById,
  addContact: (id, contact) => addContact.immediate(id, contact),
  deleteById,
  isValidationError: (error) => error?.name === 'ValidationError',
};
