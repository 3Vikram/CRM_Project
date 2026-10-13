const { randomUUID } = require('crypto');
const { db } = require('../utils/salesDatabase');

const fields = {
  opfNo: 'opf_no',
  quotationNumber: 'quotation_number',
  quotationId: 'quotation_id',
  customerId: 'customer_id',
  customerName: 'customer_name',
  contactPerson: 'contact_person',
  supplierName: 'supplier_name',
  supplierContactPerson: 'supplier_contact_person',
  product: 'product',
  description: 'description',
  quantity: 'quantity',
  unitPrice: 'unit_price',
  vendorPrice: 'vendor_price',
  revenue: 'revenue',
  margin: 'margin',
  tax: 'tax',
  partNo: 'part_no',
  startDate: 'start_date',
  endDate: 'end_date',
  serviceName: 'service_name',
  serviceCost: 'service_cost',
  serviceTax: 'service_tax',
  freightName: 'freight_name',
  freightCost: 'freight_cost',
  freightTax: 'freight_tax',
  wht: 'wht',
  conversionRate: 'conversion_rate',
  vendorCurrency: 'vendor_currency',
  eta: 'eta',
  customerPONo: 'customer_po_no',
  customerPODate: 'customer_po_date',
  amc: 'amc',
  amcRenewalDate: 'amc_renewal_date',
  notes: 'notes',
  customerPaymentTerms: 'customer_payment_terms',
  supplierPaymentTerms: 'supplier_payment_terms',
  enduserName: 'enduser_name',
  enduserEmail: 'enduser_email',
  enduserContact: 'enduser_contact',
  enduserAddress: 'enduser_address',
  billToAddress: 'bill_to_address',
  shipToAddress: 'ship_to_address',
  createdBy: 'created_by',
  createdDate: 'created_date',
  renewalDate: 'renewal_date',
  approvalStatus: 'approval_status',
};
const fileFields = {
  poFile: 'po_file_json',
  customerPOFile: 'customer_po_file_json',
  additionalDocument: 'additional_document_json',
  uploadedDocuments: 'uploaded_documents_json',
};
const requiredFields = ['opfNo', 'quotationNumber', 'customerName', 'supplierName', 'product'];
const approvalStatuses = ['Pending', 'Approved', 'Rejected', 'Under Review'];
const numberFields = [
  'quantity', 'unitPrice', 'vendorPrice', 'revenue', 'margin', 'serviceCost',
  'serviceTax', 'freightCost', 'freightTax', 'wht', 'conversionRate',
];
const dateFields = [
  'startDate', 'endDate', 'eta', 'customerPODate', 'amcRenewalDate', 'createdDate', 'renewalDate',
];
const stringDefaults = {
  quotationId: '',
  customerId: null,
  contactPerson: '',
  supplierContactPerson: '',
  description: '',
  tax: '',
  partNo: '',
  serviceName: '',
  freightName: '',
  vendorCurrency: 'INR',
  customerPONo: '',
  amc: '',
  notes: '',
  customerPaymentTerms: '',
  supplierPaymentTerms: '',
  enduserName: '',
  enduserEmail: '',
  enduserContact: '',
  enduserAddress: '',
  billToAddress: '',
  shipToAddress: '',
  createdBy: 'Admin',
  approvalStatus: 'Pending',
};
const numericDefaults = {
  quantity: 0,
  unitPrice: 0,
  vendorPrice: 0,
  serviceCost: 0,
  serviceTax: 0,
  freightCost: 0,
  freightTax: 0,
  wht: 0,
  conversionRate: 1,
};
const sortColumns = {
  createdDate: 'created_date',
  renewalDate: 'renewal_date',
  customerName: 'customer_name',
  quotationNumber: 'quotation_number',
  approvalStatus: 'approval_status',
  createdAt: 'created_at',
};
const allowedColumns = new Set([...Object.values(fields), 'id', 'created_at', 'updated_at']);

const validationError = (errors) => {
  const error = new Error(Object.values(errors).map(({ message }) => message).join(', '));
  error.name = 'ValidationError';
  error.errors = errors;
  return error;
};

const toDateString = (value, field) => {
  if (value === '' || value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw validationError({ [field]: { message: `Cast to date failed for value "${value}" at path "${field}"` } });
  }
  return date.toISOString();
};

const normalize = (input = {}, { partial = false } = {}) => {
  const result = partial ? {} : {
    ...stringDefaults,
    ...numericDefaults,
    createdDate: new Date().toISOString(),
    renewalDate: null,
    startDate: null,
    endDate: null,
    eta: null,
    customerPODate: null,
    amcRenewalDate: null,
    poFile: null,
    customerPOFile: null,
    additionalDocument: null,
    uploadedDocuments: [],
  };
  for (const [field] of Object.entries(fields)) {
    if (!Object.hasOwn(input, field) || input[field] === undefined) continue;
    const value = input[field];
    if (dateFields.includes(field)) {
      result[field] = toDateString(value, field);
    } else if (numberFields.includes(field)) {
      const number = value === '' || value === null ? numericDefaults[field] ?? null : Number(value);
      if (number !== null && !Number.isFinite(number)) {
        throw validationError({ [field]: { message: `Cast to Number failed for value "${value}" at path "${field}"` } });
      }
      result[field] = number;
    } else if (value === null) {
      result[field] = stringDefaults[field] === null ? null : '';
    } else {
      result[field] = String(value).trim();
    }
  }
  for (const field of Object.keys(fileFields)) {
    if (Object.hasOwn(input, field) && input[field] !== undefined) result[field] = input[field];
  }
  const errors = {};
  for (const field of requiredFields) {
    if (!result[field]) {
      const label = {
        opfNo: 'OPF No.',
        quotationNumber: 'Quotation Number',
        customerName: 'Customer Name',
        supplierName: 'Supplier Name',
        product: 'Product',
      }[field];
      errors[field] = { message: `${label} is required` };
    }
  }
  if (!approvalStatuses.includes(result.approvalStatus)) {
    errors.approvalStatus = { message: '`approvalStatus` is invalid' };
  }
  if (Object.keys(errors).length) throw validationError(errors);
  return result;
};

const parseJson = (value, field, fallback) => {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Cannot read OPF ${field}: invalid JSON.`, { cause: error });
  }
};

const rowToOPF = (row) => {
  if (!row) return null;
  const payload = parseJson(row.data_json, 'data_json', {});
  const result = { ...payload, _id: String(row.id) };
  for (const [field, column] of Object.entries(fields)) {
    if (row[column] !== undefined) result[field] = row[column];
  }
  for (const [field, column] of Object.entries(fileFields)) {
    const value = parseJson(row[column], field, field === 'uploadedDocuments' ? [] : null);
    if (value !== null || field === 'uploadedDocuments') result[field] = value;
  }
  result.createdAt = row.created_at || payload.createdAt || '';
  result.updatedAt = row.updated_at || payload.updatedAt || '';
  return result;
};

const valueForColumn = (record, column) => {
  const fileField = Object.keys(fileFields).find((field) => fileFields[field] === column);
  if (fileField) {
    const value = record[fileField];
    return value === null || value === undefined ? null : JSON.stringify(value);
  }
  const field = Object.keys(fields).find((name) => fields[name] === column);
  return field ? record[field] ?? null : null;
};

const columns = [...Object.values(fields), ...Object.values(fileFields), 'data_json', 'created_at', 'updated_at'];
const getById = (id) => rowToOPF(db.prepare('SELECT * FROM opfs WHERE id = ?').get(String(id)));

const nextNumberInTransaction = (prefix) => {
  const latest = db.prepare(`
    SELECT COALESCE(MAX(CAST(substr(opf_no, length(?) + 1) AS INTEGER)), 0) AS value
    FROM opfs
    WHERE substr(opf_no, 1, length(?)) = ?
  `).get(prefix, prefix, prefix).value;
  const current = db.prepare('SELECT value FROM opf_sequences WHERE prefix = ?').get(prefix)?.value || 0;
  const value = Math.max(Number(latest) || 0, Number(current) || 0) + 1;
  db.prepare(`
    INSERT INTO opf_sequences (prefix, value) VALUES (?, ?)
    ON CONFLICT(prefix) DO UPDATE SET value = excluded.value
  `).run(prefix, value);
  return value;
};

const insertOPF = db.transaction((record, generatedPrefix) => {
  if (generatedPrefix) {
    const sequence = nextNumberInTransaction(generatedPrefix);
    record.opfNo = `${generatedPrefix}${String(sequence).padStart(3, '0')}`;
  }
  const id = randomUUID();
  const now = new Date().toISOString();
  const values = columns.map((column) => {
    if (column === 'data_json') return JSON.stringify({ ...record, createdAt: now, updatedAt: now });
    if (column === 'created_at') return now;
    if (column === 'updated_at') return now;
    return valueForColumn(record, column);
  });
  db.prepare(`
    INSERT INTO opfs (id, ${columns.map((column) => `"${column}"`).join(', ')})
    VALUES (?, ${columns.map(() => '?').join(', ')})
  `).run(id, ...values);
  return getById(id);
});

const create = (input, generatedPrefix = '') => {
  const suppliedOpfNo = String(input?.opfNo || '').trim();
  const record = normalize({
    ...input,
    opfNo: suppliedOpfNo || (generatedPrefix ? 'pending' : ''),
  });
  return insertOPF.immediate(record, suppliedOpfNo ? '' : String(generatedPrefix));
};

const updateById = (id, input) => {
  const existing = getById(id);
  if (!existing) return null;
  const record = normalize({ ...existing, ...input });
  const now = new Date().toISOString();
  const values = columns.map((column) => {
    if (column === 'data_json') return JSON.stringify({ ...record, createdAt: existing.createdAt, updatedAt: now });
    if (column === 'created_at') return existing.createdAt || now;
    if (column === 'updated_at') return now;
    return valueForColumn(record, column);
  });
  db.prepare(`
    UPDATE opfs SET ${columns.map((column) => `"${column}" = ?`).join(', ')} WHERE id = ?
  `).run(...values, String(id));
  return getById(id);
};

const deleteById = (id) => {
  const existing = getById(id);
  if (!existing) return null;
  db.prepare('DELETE FROM opfs WHERE id = ?').run(String(id));
  return existing;
};

const filterToSql = (filter = {}) => {
  const conditions = [];
  const params = [];
  const addCriterion = (field, criterion) => {
    const column = fields[field];
    if (!column || !allowedColumns.has(column)) return;
    if (criterion instanceof RegExp) {
      conditions.push(`"${column}" REGEXP ?`);
      params.push(criterion.source);
    } else if (criterion && typeof criterion === 'object' && !(criterion instanceof Date)) {
      for (const [operator, value] of Object.entries(criterion)) {
        const sqlOperator = { $gte: '>=', $lte: '<=', $gt: '>', $lt: '<', $ne: '!=' }[operator];
        if (!sqlOperator || value === undefined) continue;
        conditions.push(`"${column}" ${sqlOperator} ?`);
        params.push(value instanceof Date ? value.toISOString() : value);
      }
    } else {
      conditions.push(`"${column}" = ?`);
      params.push(criterion instanceof Date ? criterion.toISOString() : criterion);
    }
  };
  for (const [field, criterion] of Object.entries(filter)) {
    if (field === '$or' && Array.isArray(criterion)) {
      const alternatives = criterion.map((part) => {
        const start = conditions.length;
        const paramStart = params.length;
        for (const [orField, orCriterion] of Object.entries(part)) addCriterion(orField, orCriterion);
        const clauses = conditions.splice(start);
        const values = params.splice(paramStart);
        params.push(...values);
        return clauses.length ? `(${clauses.join(' AND ')})` : '';
      }).filter(Boolean);
      if (alternatives.length) conditions.push(`(${alternatives.join(' OR ')})`);
    } else {
      addCriterion(field, criterion);
    }
  }
  return { where: conditions.length ? conditions.join(' AND ') : '1 = 1', params };
};

const selectedColumns = (projection) => {
  if (!projection) return '*';
  const names = typeof projection === 'string'
    ? projection.split(/\s+/).filter(Boolean)
    : Object.entries(projection).filter(([, include]) => include).map(([field]) => field);
  const selected = [...new Set(['_id', ...names])].map((field) => {
    if (field === '_id') return 'id AS _id';
    if (fields[field] && allowedColumns.has(fields[field])) return `"${fields[field]}" AS "${field}"`;
    if (field === 'createdAt') return 'created_at AS createdAt';
    if (field === 'updatedAt') return 'updated_at AS updatedAt';
    if (fileFields[field]) return `"${fileFields[field]}" AS "${field}"`;
    return '';
  }).filter(Boolean);
  return selected.length ? selected.join(', ') : '*';
};

const queryBuilder = (filter = {}, projection) => {
  let sort = 'created_date DESC';
  let limit = null;
  let offset = 0;
  let selected = projection;
  const query = {
    select(value) {
      selected = value;
      return query;
    },
    sort(value = {}) {
      const terms = Object.entries(value).map(([field, direction]) => {
        const column = sortColumns[field] || (fields[field] && allowedColumns.has(fields[field]) ? fields[field] : '');
        return column ? `"${column}" ${Number(direction) === 1 ? 'ASC' : 'DESC'}` : '';
      }).filter(Boolean);
      if (terms.length) sort = terms.join(', ');
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
      const { where, params } = filterToSql(filter);
      const sql = `SELECT ${selectedColumns(selected)} FROM opfs WHERE ${where} ORDER BY ${sort}${limit === null ? '' : ' LIMIT ? OFFSET ?'}`;
      const rows = db.prepare(sql).all(...params, ...(limit === null ? [] : [limit, offset]));
      return rows.map((row) => row.id === undefined && row._id !== undefined
        ? { ...row, _id: String(row._id) }
        : rowToOPF(row));
    },
  };
  return query;
};

const list = ({
  search = '',
  createdBy = '',
  createdDateStart = '',
  createdDateEnd = '',
  renewalDateStart = '',
  renewalDateEnd = '',
  customerName = '',
  approvalStatus = '',
  product = '',
  sortBy = 'createdDate',
  sortOrder = 'desc',
  limit = 10,
  offset = 0,
} = {}) => {
  const conditions = [];
  const params = [];
  const exactFilters = [
    ['createdBy', createdBy],
    ['customerName', customerName],
    ['approvalStatus', approvalStatus],
    ['product', product],
  ];
  if (search) {
    conditions.push('(opf_no REGEXP ? OR quotation_number REGEXP ? OR quotation_id REGEXP ? OR customer_name REGEXP ? OR contact_person REGEXP ?)');
    params.push(...Array(5).fill(String(search)));
  }
  exactFilters.forEach(([field, value]) => {
    if (!value) return;
    conditions.push(`"${fields[field]}" REGEXP ?`);
    params.push(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  });
  for (const [column, start, end] of [
    ['created_date', createdDateStart, createdDateEnd],
    ['renewal_date', renewalDateStart, renewalDateEnd],
  ]) {
    if (start) {
      conditions.push(`datetime("${column}") >= datetime(?)`);
      params.push(start);
    }
    if (end) {
      conditions.push(`datetime("${column}") <= datetime(?)`);
      params.push(end);
    }
  }
  const where = conditions.length ? conditions.join(' AND ') : '1 = 1';
  const sortColumn = sortColumns[sortBy] || sortColumns.createdDate;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const records = db.prepare(`
    SELECT * FROM opfs WHERE ${where}
    ORDER BY "${sortColumn}" ${direction}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset).map(rowToOPF);
  const total = db.prepare(`SELECT COUNT(*) AS total FROM opfs WHERE ${where}`).get(...params).total;
  return { records, total };
};

const findForReport = ({
  createdBy = '',
  createdDateStart = '',
  createdDateEnd = '',
  customerName = '',
  product = '',
  sortBy = 'createdDate',
  sortOrder = 'desc',
} = {}) => {
  const conditions = [];
  const params = [];
  for (const [field, value] of [
    ['createdBy', createdBy],
    ['customerName', customerName],
    ['product', product],
  ]) {
    if (!value) continue;
    conditions.push(`"${fields[field]}" REGEXP ?`);
    params.push(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
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
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const sortColumn = fields[sortBy] || sortColumns[sortBy] || sortColumns.createdDate;
  const orderBy = sortBy === 'createdBy'
    ? `"${sortColumn}" ${direction}, created_date DESC, id ${direction}`
    : `"${sortColumn}" ${direction}, id ${direction}`;
  return db.prepare(`
    SELECT * FROM opfs WHERE ${where}
    ORDER BY ${orderBy}
  `).all(...params).map(rowToOPF);
};

module.exports = {
  fields,
  normalize,
  create,
  updateById,
  deleteById,
  getById,
  list,
  findForReport,
  find: queryBuilder,
  findOne: (filter = {}, projection) => {
    const query = queryBuilder(filter, projection);
    const lean = query.lean.bind(query);
    query.lean = () => lean()[0] || null;
    return query;
  },
};
