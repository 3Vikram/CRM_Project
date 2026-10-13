const { randomUUID } = require('crypto');
const { db } = require('../utils/salesDatabase');

const requiredFields = [
  'directorName', 'directorDesignation', 'companyName', 'city', 'state', 'pin',
  'country', 'website', 'email', 'gstNo', 'panNo', 'bankName',
  'accountHolderName', 'accountNo', 'ifscCode', 'swiftCode', 'cin', 'iec',
  'quotationFormat', 'idNoFormat', 'opfFormat', 'poFormat', 'piFormat',
  'invoiceFormat', 'prFormat', 'enquiryFormat', 'challanFormat',
];
const stringFields = [
  ...requiredFields,
  'branchName', 'branchCode', 'registeredAddress', 'address', 'companyContactNo', 'createdBy',
];
const fileFields = ['companyLogo', 'documentLogo', 'documentHeader', 'documentFooter'];
const booleanFields = ['documentHeaderRequired', 'documentFooterRequired'];
const fields = [...stringFields, ...fileFields, ...booleanFields];
const defaults = {
  branchName: '',
  branchCode: '',
  registeredAddress: '',
  address: '',
  companyContactNo: '',
  companyLogo: {},
  documentLogo: {},
  documentHeader: {},
  documentHeaderRequired: false,
  documentFooter: {},
  documentFooterRequired: false,
  createdBy: 'Admin',
};
const listFields = [
  '_id', 'directorName', 'directorDesignation', 'companyName', 'branchName', 'branchCode',
  'registeredAddress', 'address', 'city', 'state', 'pin', 'country',
  'companyContactNo', 'website', 'companyLogo', 'documentLogo',
  'documentHeader', 'documentFooter', 'documentHeaderRequired',
  'documentFooterRequired', 'gstNo', 'panNo', 'bankName', 'accountHolderName',
  'accountNo', 'ifscCode', 'swiftCode', 'email', 'quotationFormat',
  'idNoFormat', 'opfFormat', 'poFormat', 'piFormat', 'invoiceFormat',
  'prFormat', 'enquiryFormat', 'challanFormat', 'cin', 'iec', 'createdAt',
];
const sortColumns = {
  directorName: "json_extract(profile_json, '$.directorName')",
  directorDesignation: "json_extract(profile_json, '$.directorDesignation')",
  companyName: 'company_name',
  branchName: "json_extract(profile_json, '$.branchName')",
  createdAt: 'datetime(created_at)',
};
const requiredLabels = {
  directorName: 'Director Name',
  directorDesignation: 'Director Designation',
  companyName: 'Company Name',
  pin: 'PIN',
  gstNo: 'GST No.',
  panNo: 'PAN No.',
  bankName: 'Bank Name',
  accountHolderName: 'Account Holder Name',
  accountNo: 'Account No.',
  ifscCode: 'IFSC Code',
  swiftCode: 'SWIFT Code',
  cin: 'CIN',
  iec: 'IEC',
  quotationFormat: 'Quotation Format',
  idNoFormat: 'ID No. Format',
  opfFormat: 'OPF Format',
  poFormat: 'PO Format',
  piFormat: 'PI Format',
  invoiceFormat: 'Invoice Format',
  prFormat: 'PR Format',
  enquiryFormat: 'Enquiry Format',
  challanFormat: 'Challan Format',
};

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

const normalizeFile = (value = {}) => ({
  fileName: String(value.fileName ?? '').trim(),
  filePath: String(value.filePath ?? '').trim(),
  mimeType: String(value.mimeType ?? '').trim(),
  uploadDate: value.uploadDate ? toIsoDate(value.uploadDate, 'uploadDate') : new Date().toISOString(),
});

const normalize = (input, { partial = false } = {}) => {
  const profile = partial ? {} : { ...defaults };
  fields.forEach((field) => {
    if (!Object.hasOwn(input, field) || input[field] === undefined || input[field] === null) return;
    if (stringFields.includes(field)) {
      profile[field] = String(input[field]).trim();
      if (field === 'email') profile[field] = profile[field].toLowerCase();
      if (['gstNo', 'panNo', 'ifscCode', 'swiftCode'].includes(field)) {
        profile[field] = profile[field].toUpperCase();
      }
    } else if (fileFields.includes(field)) {
      profile[field] = normalizeFile(input[field]);
    } else {
      profile[field] = input[field] === true || input[field] === 1 || input[field] === 'true' || input[field] === '1';
    }
  });

  const errors = {};
  requiredFields.forEach((field) => {
    if ((!partial || Object.hasOwn(profile, field)) && !profile[field]) {
      const label = requiredLabels[field] || field[0].toUpperCase() + field.slice(1);
      errors[field] = { message: `${label} is required` };
    }
  });
  if (Object.hasOwn(profile, 'email') && !/^\S+@\S+\.\S+$/.test(profile.email)) {
    errors.email = { message: 'Please enter a valid email address' };
  }
  if (Object.keys(errors).length) throw validationError(errors);
  return profile;
};

const rowToProfile = (row) => {
  if (!row) return null;
  let profile;
  try {
    profile = JSON.parse(row.profile_json || '{}');
  } catch (error) {
    throw new Error('Invalid JSON stored in company_profiles.profile_json.', { cause: error });
  }
  return {
    ...profile,
    _id: String(row.id),
    companyName: profile.companyName || row.company_name || '',
    quotationFormat: profile.quotationFormat || row.quotation_format || '',
    createdAt: profile.createdAt || row.created_at,
    updatedAt: profile.updatedAt || row.updated_at,
  };
};

const findById = (id) => rowToProfile(db.prepare('SELECT * FROM company_profiles WHERE id = ?').get(String(id)));
const findFirst = () => rowToProfile(db.prepare('SELECT * FROM company_profiles ORDER BY datetime(created_at) DESC, id DESC LIMIT 1').get());

const createRecord = db.transaction((input) => {
  const profile = normalize(input);
  const id = input._id ? String(input._id) : randomUUID();
  const now = new Date().toISOString();
  const record = {
    ...profile,
    _id: id,
    createdAt: input.createdAt ? toIsoDate(input.createdAt, 'createdAt') : now,
    updatedAt: input.updatedAt ? toIsoDate(input.updatedAt, 'updatedAt') : now,
  };
  db.prepare(`
    INSERT INTO company_profiles (id, company_name, quotation_format, profile_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, record.companyName, record.quotationFormat, JSON.stringify(record), record.createdAt, record.updatedAt);
  return findById(id);
});

const updateById = (id, changes) => {
  const existing = findById(id);
  if (!existing) return null;
  const profile = normalize({ ...existing, ...changes, _id: existing._id }, { partial: false });
  const record = { ...profile, _id: existing._id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
  db.prepare(`
    UPDATE company_profiles
    SET company_name = ?, quotation_format = ?, profile_json = ?, updated_at = ?
    WHERE id = ?
  `).run(record.companyName, record.quotationFormat, JSON.stringify(record), record.updatedAt, existing._id);
  return findById(existing._id);
};

const deleteById = (id) => {
  const profile = findById(id);
  if (!profile) return null;
  db.prepare('DELETE FROM company_profiles WHERE id = ?').run(profile._id);
  return profile;
};

const list = ({ page = 1, limit = 10, search = '', sortBy = 'createdAt', sortOrder = 'desc' } = {}) => {
  const conditions = [];
  const params = [];
  if (search) {
    const pattern = `%${String(search).replace(/[\\%_]/g, '\\$&')}%`;
    conditions.push(`(
      company_name LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      json_extract(profile_json, '$.directorName') LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      json_extract(profile_json, '$.email') LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      json_extract(profile_json, '$.gstNo') LIKE ? ESCAPE '\\' COLLATE NOCASE
    )`);
    params.push(pattern, pattern, pattern, pattern);
  }
  const where = conditions.length ? conditions.join(' AND ') : '1 = 1';
  const sortColumn = sortColumns[sortBy] || 'created_at';
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pageNum = Math.max(Number.parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 100);
  const rows = db.prepare(`
    SELECT * FROM company_profiles WHERE ${where}
    ORDER BY ${sortColumn} ${direction}
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, (pageNum - 1) * limitNum);
  const total = db.prepare(`SELECT COUNT(*) AS total FROM company_profiles WHERE ${where}`).get(...params).total;
  return {
    data: rows.map(rowToProfile).map((profile) => Object.fromEntries(
      listFields.map((field) => [field, field === '_id' ? profile._id : profile[field]]),
    )),
    pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
  };
};

const findWithLogo = () => rowToProfile(db.prepare(`
  SELECT * FROM company_profiles
  WHERE json_extract(profile_json, '$.companyLogo.filePath') IS NOT NULL
    AND json_extract(profile_json, '$.companyLogo.filePath') NOT IN ('', 'null')
  ORDER BY datetime(created_at) DESC LIMIT 1
`).get());

module.exports = {
  fields,
  listFields,
  normalize,
  list,
  findById,
  findFirst,
  findWithLogo,
  create: (input) => createRecord.immediate(input),
  updateById,
  deleteById,
  isValidationError: (error) => error?.name === 'ValidationError',
};
