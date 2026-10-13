const { randomUUID } = require('crypto');
const { db } = require('../utils/salesDatabase');

const fields = {
  supplierId: 'supplier_id',
  createdBy: 'created_by',
  supplierName: 'supplier_name',
  gstNumber: 'gst_number',
  category: 'category',
  paymentTerms: 'payment_terms',
  addressLine1: 'address_line_1',
  country: 'country',
  state: 'state',
  city: 'city',
  pinCode: 'pin_code',
  bankName: 'bank_name',
  bankAddress: 'bank_address',
  accountHolder: 'account_holder',
  accountNumber: 'account_number',
  ifscCode: 'ifsc_code',
  loginEmailId: 'login_email_id',
  loginPassword: 'login_password',
  contactType: 'contact_type',
  contactName: 'contact_name',
  designation: 'designation',
  emailId: 'email_id',
  contactNumber: 'contact_number',
  product: 'product',
  calendarStatus: 'calendar_status',
  deliveryDate: 'delivery_date',
  deliveryTime: 'delivery_time',
  paymentReminderDate: 'payment_reminder_date',
  paymentReminderTime: 'payment_reminder_time',
  followUpDate: 'follow_up_date',
  followUpTime: 'follow_up_time',
};
const columnToField = Object.fromEntries(Object.entries(fields).map(([field, column]) => [column, field]));
const requiredFields = ['supplierName', 'category', 'paymentTerms', 'addressLine1', 'country', 'state'];
const defaults = Object.fromEntries(Object.keys(fields).map((field) => [field, '']));
Object.assign(defaults, { supplierId: '', createdBy: 'Admin', calendarStatus: 'Pending' });
const sortColumns = {
  createdAt: 'created_at',
  supplierName: 'supplier_name',
  contactName: 'contact_name',
  product: 'product',
  createdBy: 'created_by',
};

const validationError = (errors) => {
  const error = new Error(Object.values(errors).map(({ message }) => message).join(', '));
  error.name = 'ValidationError';
  error.errors = errors;
  return error;
};

const normalize = (input = {}, { partial = false } = {}) => {
  const result = partial ? {} : { ...defaults };
  for (const [field, column] of Object.entries(fields)) {
    if (!Object.hasOwn(input, field) || input[field] === undefined) continue;
    const value = input[field];
    result[field] = value === null ? (field === 'supplierId' ? '' : '') : String(value).trim();
    if (field === 'emailId') result[field] = result[field].toLowerCase();
  }
  const errors = {};
  for (const field of requiredFields) {
    if ((!partial || Object.hasOwn(result, field)) && !result[field]) {
      errors[field] = { message: `${field === 'supplierName' ? 'Supplier name' : field} is required` };
    }
  }
  if (Object.hasOwn(result, 'calendarStatus') && !['Pending', 'Completed'].includes(result.calendarStatus)) {
    errors.calendarStatus = { message: '`calendarStatus` must be either Pending or Completed' };
  }
  if (Object.keys(errors).length) throw validationError(errors);
  return result;
};

const rowToSupplier = (row) => {
  if (!row) return null;
  const result = { _id: String(row.id) };
  for (const [field, column] of Object.entries(fields)) {
    result[field] = row[column] ?? defaults[field] ?? '';
  }
  result.createdAt = row.created_at || '';
  result.updatedAt = row.updated_at || '';
  return result;
};

const columns = Object.values(fields);
const selectAll = db.prepare('SELECT * FROM suppliers WHERE id = ?');
const getById = (id) => rowToSupplier(selectAll.get(String(id)));

const nextSupplierId = () => {
  const highest = db.prepare(`
    SELECT COALESCE(MAX(CAST(substr(supplier_id, 4) AS INTEGER)), 0) AS value
    FROM suppliers
    WHERE supplier_id REGEXP '^SL-[0-9]+$'
  `).get().value;
  return `SL-${highest + 1}`;
};

const ensureSupplierIds = db.transaction(() => {
  const rows = db.prepare('SELECT id, supplier_id FROM suppliers ORDER BY datetime(created_at), id').all();
  let highest = rows.reduce((max, row) => {
    const match = /^SL-(\d+)$/.exec(String(row.supplier_id || ''));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const assign = db.prepare('UPDATE suppliers SET supplier_id = ?, updated_at = ? WHERE id = ?');
  const now = new Date().toISOString();
  rows.forEach((row) => {
    if (/^SL-\d+$/.test(String(row.supplier_id || ''))) return;
    highest += 1;
    assign.run(`SL-${highest}`, now, row.id);
  });
});

const insertSupplier = db.transaction((input) => {
  const payload = normalize(input);
  const supplierId = payload.supplierId || nextSupplierId();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO suppliers (id, ${columns.map((column) => `"${column}"`).join(', ')}, created_at, updated_at)
    VALUES (?, ${columns.map(() => '?').join(', ')}, ?, ?)
  `).run(id, ...columns.map((column) => (
    column === 'supplier_id' ? supplierId : payload[columnToField[column]]
  )), now, now);
  return getById(id);
});
const create = (input) => insertSupplier.immediate(input);

const updateById = (id, input) => {
  const existing = getById(id);
  if (!existing) return null;
  const payload = normalize({ ...existing, ...input });
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE suppliers SET ${columns.map((column) => `"${column}" = ?`).join(', ')}, updated_at = ?
    WHERE id = ?
  `).run(...columns.map((column) => payload[columnToField[column]]), now, String(id));
  return getById(id);
};

const deleteById = (id) => {
  const existing = getById(id);
  if (!existing) return null;
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(String(id));
  return existing;
};

const sqlWhere = (filter = {}) => {
  const conditions = [];
  const params = [];
  for (const [field, criterion] of Object.entries(filter)) {
    const column = fields[field];
    if (!column) continue;
    if (criterion && typeof criterion === 'object' && criterion.$regex instanceof RegExp) {
      conditions.push(`"${column}" REGEXP ?`);
      params.push(criterion.$regex.source);
    } else if (criterion instanceof RegExp) {
      conditions.push(`"${column}" REGEXP ?`);
      params.push(criterion.source);
    } else if (criterion !== undefined && criterion !== null) {
      conditions.push(`"${column}" = ?`);
      params.push(String(criterion));
    }
  }
  return { where: conditions.length ? conditions.join(' AND ') : '1 = 1', params };
};

const selectFields = (projection) => {
  if (!projection) return '*';
  const requested = typeof projection === 'string'
    ? projection.split(/\s+/).filter(Boolean)
    : Object.entries(projection).filter(([, include]) => include).map(([field]) => field);
  const selected = [...new Set(['_id', ...requested])]
    .map((field) => field === '_id' ? 'id AS _id' : fields[field] ? `"${fields[field]}" AS "${field}"` : '')
    .filter(Boolean);
  return selected.length ? selected.join(', ') : '*';
};

const legacyFind = (filter = {}, projection) => {
  let sort = 'created_at DESC';
  let limit = null;
  let offset = 0;
  let selectedFields = projection;
  const query = {
    select(value) {
      selectedFields = value;
      return query;
    },
    sort(value = {}) {
      const [field, direction] = Object.entries(value)[0] || [];
      if (sortColumns[field]) sort = `"${sortColumns[field]}" ${Number(direction) === 1 ? 'ASC' : 'DESC'}`;
      return query;
    },
    skip(value = 0) {
      offset = Math.max(0, Number(value) || 0);
      return query;
    },
    limit(value) {
      limit = Math.max(0, Number(value) || 0);
      return query;
    },
    lean() {
      const { where, params } = sqlWhere(filter);
      const sql = `SELECT ${selectFields(selectedFields)} FROM suppliers WHERE ${where} ORDER BY ${sort}${limit === null ? '' : ' LIMIT ? OFFSET ?'}`;
      const rows = db.prepare(sql).all(...params, ...(limit === null ? [] : [limit, offset]));
      return rows.map((row) => {
        if (row._id === undefined) return rowToSupplier(row);
        return { ...row, _id: String(row._id) };
      });
    },
  };
  return query;
};

const countDocuments = (filter = {}) => {
  const { where, params } = sqlWhere(filter);
  return db.prepare(`SELECT COUNT(*) AS total FROM suppliers WHERE ${where}`).get(...params).total;
};

const findOneAndUpdate = (filter = {}, update = {}) => {
  const id = filter._id || filter.id;
  if (!id) return null;
  const existing = getById(id);
  if (!existing || (filter.deletedAt === null && existing.deletedAt)) return null;
  const changes = update.$set || update;
  return updateById(id, changes);
};

module.exports = {
  fields,
  normalize,
  create,
  updateById,
  deleteById,
  getById,
  findAll: () => db.prepare('SELECT * FROM suppliers ORDER BY datetime(created_at), id').all().map(rowToSupplier),
  updateCalendarStatus: (id, status) => updateById(id, { calendarStatus: status }),
  updateCalendarDate: (id, field, value) => {
    const allowed = new Set(['deliveryDate', 'paymentReminderDate', 'followUpDate']);
    if (!allowed.has(field)) throw new TypeError('Unsupported Supplier calendar field.');
    return updateById(id, { [field]: String(value) });
  },
  list: ({ search = '', product = '', createdBy = '', sortBy = 'createdAt', sortOrder = 'desc', limit = 10, offset = 0 } = {}) => {
    const conditions = [];
    const params = [];
    if (search) {
      conditions.push(`(supplier_name REGEXP ? OR contact_name REGEXP ? OR email_id REGEXP ? OR contact_number REGEXP ? OR product REGEXP ?)`);
      params.push(...Array(5).fill(String(search)));
    }
    if (product) {
      conditions.push('product REGEXP ?');
      params.push(`^${String(product).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    }
    if (createdBy) {
      conditions.push('created_by REGEXP ?');
      params.push(`^${String(createdBy).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    }
    const where = conditions.length ? conditions.join(' AND ') : '1 = 1';
    const sortColumn = sortColumns[sortBy] || sortColumns.createdAt;
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const rows = db.prepare(`
      SELECT id, supplier_id, created_by, supplier_name, contact_name, email_id,
        contact_number, product, category, created_at, updated_at
      FROM suppliers WHERE ${where}
      ORDER BY "${sortColumn}" ${direction}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    return rows.map((row) => ({
      _id: String(row.id),
      supplierId: row.supplier_id || '',
      createdBy: row.created_by || 'Admin',
      supplierName: row.supplier_name || '',
      contactName: row.contact_name || '',
      emailId: row.email_id || '',
      contactNumber: row.contact_number || '',
      product: row.product || '',
      category: row.category || '',
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || '',
    }));
  },
  count: ({ search = '', product = '', createdBy = '' } = {}) => {
    const conditions = [];
    const params = [];
    if (search) {
      conditions.push('(supplier_name REGEXP ? OR contact_name REGEXP ? OR email_id REGEXP ? OR contact_number REGEXP ? OR product REGEXP ?)');
      params.push(...Array(5).fill(String(search)));
    }
    if (product) {
      conditions.push('product REGEXP ?');
      params.push(`^${String(product).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    }
    if (createdBy) {
      conditions.push('created_by REGEXP ?');
      params.push(`^${String(createdBy).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    }
    return db.prepare(`SELECT COUNT(*) AS total FROM suppliers WHERE ${conditions.length ? conditions.join(' AND ') : '1 = 1'}`).get(...params).total;
  },
  ensureIds: ensureSupplierIds,
  findValidEmailRecipients: (pattern) => db.prepare(`
    SELECT id AS _id, email_id AS emailId FROM suppliers WHERE email_id REGEXP ?
  `).all(pattern),
  countValidEmailRecipients: (pattern) => db.prepare(`
    SELECT COUNT(*) AS total FROM suppliers WHERE email_id REGEXP ?
  `).get(pattern).total,
  // Transitional read adapters keep untouched Calendar and Campaign callers on SQLite.
  find: legacyFind,
  countDocuments,
  findOneAndUpdate,
};
