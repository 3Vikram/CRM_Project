const { randomUUID } = require('crypto');
const { db } = require('../utils/salesDatabase');

const fields = {
  employeeCode: 'employee_code',
  officialEmployeeId: 'official_employee_id',
  employeeName: 'employee_name',
  fullName: 'full_name',
  email: 'email',
  passwordHash: 'password_hash',
  passwordSalt: 'password_salt',
  phone: 'phone',
  contactNo: 'contact_no',
  designation: 'designation',
  department: 'department',
  role: 'role',
  status: 'status',
  joiningDate: 'joining_date',
  dateOfJoin: 'date_of_join',
  dateOfBirth: 'date_of_birth',
  profilePhoto: 'profile_photo',
  signature: 'signature',
  employeeType: 'employee_type',
  reportingTo: 'reporting_to',
  orderApprovalTo: 'order_approval_to',
  branchCode: 'branch_code',
  crudOption: 'crud_option',
  modulesOption: 'modules_option',
  permissions: 'permissions_json',
  address: 'address',
  notes: 'notes',
  createdBy: 'created_by',
};
const columns = Object.values(fields);
const jsonFields = new Set(['crudOption', 'modulesOption', 'permissions']);
const dateFields = new Set(['joiningDate', 'dateOfJoin', 'dateOfBirth']);
const stringFields = new Set(Object.keys(fields).filter((field) => !jsonFields.has(field) && !dateFields.has(field)));
const roleValues = ['Sales Head', 'Sales Manager', 'Sales Executive', 'Administrator', 'Support'];
const statusValues = ['Active', 'Inactive', 'On Leave'];
const validSortFields = new Set(['createdAt', 'employeeName', 'employeeCode', 'role', 'department', 'status']);
const defaults = {
  employeeCode: undefined,
  officialEmployeeId: '',
  employeeName: '',
  fullName: '',
  email: '',
  passwordHash: '',
  passwordSalt: '',
  phone: '',
  contactNo: '',
  designation: '',
  department: 'Sales',
  role: 'Sales Executive',
  status: 'Active',
  joiningDate: null,
  dateOfJoin: null,
  dateOfBirth: null,
  profilePhoto: '',
  signature: '',
  employeeType: '',
  reportingTo: '',
  orderApprovalTo: '',
  branchCode: '',
  crudOption: [],
  modulesOption: [],
  permissions: {},
  address: '',
  notes: '',
  createdBy: 'Admin',
};

const validationError = (errors) => {
  const error = new Error(Object.values(errors).map((item) => item.message).join(', '));
  error.name = 'ValidationError';
  error.errors = errors;
  return error;
};

const toIsoDate = (value, field) => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw validationError({ [field]: { message: `Cast to date failed for value "${value}" at path "${field}"` } });
  }
  return date.toISOString();
};

const parseJson = (value, field) => {
  try {
    return JSON.parse(value || (field === 'permissions' ? '{}' : '[]'));
  } catch (error) {
    throw new Error(`Invalid JSON stored in employees.${field}.`, { cause: error });
  }
};

const normalizeEmployee = (input, { partial = false } = {}) => {
  const employee = partial ? {} : { ...defaults };
  Object.entries(fields).forEach(([field]) => {
    if (!Object.hasOwn(input, field) || input[field] === undefined) return;
    if (input[field] === null) {
      if (partial) employee[field] = null;
      return;
    }
    if (dateFields.has(field)) {
      employee[field] = toIsoDate(input[field], field);
    } else if (jsonFields.has(field)) {
      employee[field] = input[field];
    } else {
      employee[field] = String(input[field]).trim();
      if (field === 'email') employee[field] = employee[field].toLowerCase();
      if (field === 'employeeCode' || field === 'officialEmployeeId') employee[field] = employee[field].toUpperCase();
    }
  });

  if (employee.employeeName && !employee.fullName) employee.fullName = employee.employeeName;
  if (employee.fullName && !employee.employeeName) employee.employeeName = employee.fullName;
  if (employee.phone && !employee.contactNo) employee.contactNo = employee.phone;
  if (employee.contactNo && !employee.phone) employee.phone = employee.contactNo;

  const errors = {};
  if ((!partial || Object.hasOwn(employee, 'employeeName')) && !employee.employeeName) {
    errors.employeeName = { message: 'Employee name is required' };
  }
  if ((!partial || Object.hasOwn(employee, 'email')) && !employee.email) {
    errors.email = { message: 'Employee email is required' };
  } else if (Object.hasOwn(employee, 'email') && !/^\S+@\S+\.\S+$/.test(employee.email)) {
    errors.email = { message: 'Please enter a valid email address' };
  }
  if (Object.hasOwn(employee, 'role') && !roleValues.includes(employee.role)) {
    errors.role = { message: `\`${employee.role}\` is not a valid enum value for path \`role\`.` };
  }
  if (Object.hasOwn(employee, 'status') && !statusValues.includes(employee.status)) {
    errors.status = { message: `\`${employee.status}\` is not a valid enum value for path \`status\`.` };
  }
  ['crudOption', 'modulesOption'].forEach((field) => {
    if (Object.hasOwn(employee, field) && !Array.isArray(employee[field])) {
      errors[field] = { message: `${field} must be an array.` };
    } else if (Object.hasOwn(employee, field)) {
      employee[field] = employee[field].map((value) => String(value));
    }
  });
  if (Object.hasOwn(employee, 'permissions')
    && (!employee.permissions || typeof employee.permissions !== 'object' || Array.isArray(employee.permissions))) {
    errors.permissions = { message: 'Permissions must be an object.' };
  }
  if (Object.keys(errors).length) throw validationError(errors);
  return employee;
};

const rowToEmployee = (row, { includePasswordHash = false } = {}) => {
  if (!row) return null;
  const employee = { _id: String(row.id) };
  Object.entries(fields).forEach(([field, column]) => {
    if (field === 'passwordHash' && !includePasswordHash) return;
    const value = row[column];
    if (jsonFields.has(field)) employee[field] = parseJson(value, field);
    else employee[field] = value;
  });
  employee.createdAt = row.created_at;
  employee.updatedAt = row.updated_at;
  return employee;
};

const storageValues = (employee) => columns.map((column) => {
  const field = Object.keys(fields).find((key) => fields[key] === column);
  const value = employee[field] ?? defaults[field];
  return jsonFields.has(field) ? JSON.stringify(value) : value === undefined ? null : value;
});

const allocateEmployeeCode = db.transaction(() => {
  db.prepare("UPDATE employee_sequences SET value = value + 1 WHERE name = 'employee'").run();
  const { value } = db.prepare("SELECT value FROM employee_sequences WHERE name = 'employee'").get();
  return `EMP-${String(value).padStart(4, '0')}`;
});

const insertColumns = ['id', ...columns, 'created_at', 'updated_at'];
const insertSql = db.prepare(`
  INSERT INTO employees (${insertColumns.map((column) => `"${column}"`).join(', ')})
  VALUES (${insertColumns.map(() => '?').join(', ')})
`);

const findById = (id, options) => rowToEmployee(
  db.prepare('SELECT * FROM employees WHERE id = ?').get(String(id)),
  options,
);
const findByEmail = (email, options) => rowToEmployee(
  db.prepare('SELECT * FROM employees WHERE email = ? COLLATE NOCASE LIMIT 1').get(String(email).trim()),
  options,
);

const createRecord = db.transaction((input) => {
  const employee = normalizeEmployee(input);
  employee._id = input._id ? String(input._id) : randomUUID();
  employee.employeeCode = employee.employeeCode || allocateEmployeeCode();
  const now = new Date().toISOString();
  insertSql.run(employee._id, ...storageValues(employee), now, now);
  return findById(employee._id);
});

const updateById = (id, changes) => {
  const existing = findById(id, { includePasswordHash: true });
  if (!existing) return null;
  const patch = normalizeEmployee(changes, { partial: true });
  const next = normalizeEmployee({ ...existing, ...patch, _id: existing._id });
  const now = new Date().toISOString();
  db.prepare(`UPDATE employees SET ${columns.map((column) => `"${column}" = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
    .run(...storageValues(next), now, existing._id);
  return findById(existing._id);
};

const deleteById = (id) => {
  const employee = findById(id);
  if (!employee) return null;
  db.prepare('DELETE FROM employees WHERE id = ?').run(employee._id);
  return employee;
};

const list = ({
  page = 1, limit = 10, search = '', role = '', status = '', department = '',
  sortBy = 'createdAt', sortOrder = 'desc',
} = {}) => {
  const conditions = [];
  const params = [];
  if (search) {
    const pattern = `%${String(search).replace(/[\\%_]/g, '\\$&')}%`;
    conditions.push(`(
      employee_name LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      email LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      employee_code LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      designation LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      department LIKE ? ESCAPE '\\' COLLATE NOCASE
    )`);
    params.push(...Array(5).fill(pattern));
  }
  [['role', role], ['status', status], ['department', department]].forEach(([field, value]) => {
    if (!value) return;
    conditions.push(`"${fields[field]}" = ? COLLATE NOCASE`);
    params.push(value);
  });
  const where = conditions.length ? conditions.join(' AND ') : '1 = 1';
  const sortColumns = {
    createdAt: 'created_at',
    employeeName: 'employee_name',
    employeeCode: 'employee_code',
    role: 'role',
    department: 'department',
    status: 'status',
  };
  const sortColumn = sortColumns[validSortFields.has(sortBy) ? sortBy : 'createdAt'];
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pageNum = Math.max(Number.parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 100);
  const rows = db.prepare(`
    SELECT * FROM employees WHERE ${where}
    ORDER BY "${sortColumn}" ${direction}
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, (pageNum - 1) * limitNum);
  const total = db.prepare(`SELECT COUNT(*) AS total FROM employees WHERE ${where}`).get(...params).total;
  return {
    data: rows.map((row) => rowToEmployee(row)),
    pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
  };
};

module.exports = {
  fields,
  normalizeEmployee,
  rowToEmployee,
  list,
  findById,
  findByEmail,
  findByEmailWithPassword: (email) => findByEmail(email, { includePasswordHash: true }),
  findAll: () => db.prepare('SELECT * FROM employees').all().map((row) => rowToEmployee(row)),
  findNames: () => db.prepare(`
    SELECT id AS _id, employee_name AS employeeName, full_name AS fullName, email
    FROM employees ORDER BY employee_name COLLATE NOCASE
  `).all(),
  countValidEmails: (pattern) => db.prepare('SELECT COUNT(*) AS count FROM employees WHERE email REGEXP ?').get(pattern).count,
  create: (input) => createRecord.immediate(input),
  updateById,
  deleteById,
  isValidationError: (error) => error?.name === 'ValidationError',
};
