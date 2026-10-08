const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const Counter = require('../models/Counter');
const { DEFAULT_PAGE_SIZE, parsePagination, normalizeSort, regexFromSearch, escapeRegex } = require('../utils/queryUtils');

const permissionModules = [
  'customers', 'contacts', 'leads', 'activities', 'mailCampaign', 'suppliers',
  'quotations', 'opf', 'calendar', 'funnels', 'renewals', 'reports', 'dataAdmin',
  'employees', 'companyProfiles', 'inventory', 'purchaseOrders', 'dcTracking', 'billSale',
];

const defaultPermissions = () => ({
  dashboard: false,
  ...Object.fromEntries(permissionModules.map((moduleName) => [moduleName, {
    view: false,
    create: false,
    edit: false,
    delete: false,
  }])),
});

const normalizePermissionBlock = (value = {}) => {
  const source = value && typeof value === 'object' ? value : {};
  const normalized = defaultPermissions();
  normalized.dashboard = Boolean(source.dashboard ?? false);

  permissionModules.forEach((moduleName) => {
    const block = source[moduleName] && typeof source[moduleName] === 'object' ? source[moduleName] : {};
    normalized[moduleName] = {
      view: Boolean(block.view ?? false),
      create: Boolean(block.create ?? false),
      edit: Boolean(block.edit ?? false),
      delete: Boolean(block.delete ?? false),
    };
  });

  return normalized;
};

const normaliseEmployeePayload = (body = {}) => {
  const payload = {};
  Object.entries(body || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          payload[key] = JSON.parse(trimmed);
          return;
        } catch (_error) {
          payload[key] = value;
          return;
        }
      }
    }
    payload[key] = value;
  });

  const employeeName = payload.employeeName || payload.fullName || '';
  const employeeCode = payload.employeeCode || payload.officialEmployeeId || '';
  const email = payload.email || payload.emailId || '';
  const phone = payload.phone || payload.contactNo || '';

  const next = {
    employeeCode: employeeCode ? String(employeeCode).trim().toUpperCase() : undefined,
    officialEmployeeId: employeeCode ? String(employeeCode).trim().toUpperCase() : '',
    employeeName: employeeName ? String(employeeName).trim() : '',
    fullName: employeeName ? String(employeeName).trim() : '',
    email: email ? String(email).trim().toLowerCase() : '',
    phone: phone ? String(phone).trim() : '',
    contactNo: phone ? String(phone).trim() : '',
    designation: payload.designation ? String(payload.designation).trim() : '',
    department: payload.department ? String(payload.department).trim() : 'Sales',
    role: payload.role ? String(payload.role).trim() : 'Sales Executive',
    status: payload.status ? String(payload.status).trim() : 'Active',
    joiningDate: payload.joiningDate || payload.dateOfJoin || new Date(),
    dateOfJoin: payload.dateOfJoin || payload.joiningDate || null,
    dateOfBirth: payload.dateOfBirth || null,
    employeeType: payload.employeeType ? String(payload.employeeType).trim() : '',
    reportingTo: payload.reportingTo ? String(payload.reportingTo).trim() : '',
    orderApprovalTo: payload.orderApprovalTo ? String(payload.orderApprovalTo).trim() : '',
    branchCode: payload.branchCode ? String(payload.branchCode).trim() : '',
    crudOption: Array.isArray(payload.crudOption) ? payload.crudOption : (payload.crudOption ? [payload.crudOption] : []),
    modulesOption: Array.isArray(payload.modulesOption) ? payload.modulesOption : (payload.modulesOption ? [payload.modulesOption] : []),
    address: payload.address ? String(payload.address).trim() : '',
    notes: payload.notes ? String(payload.notes).trim() : '',
    createdBy: payload.createdBy ? String(payload.createdBy).trim() : 'Admin',
    permissions: normalizePermissionBlock(payload.permissions || defaultPermissions()),
  };

  if (payload.password) {
    next.password = String(payload.password);
  }

  return next;
};

const generateEmployeeCode = async () => {
  const counter = await Counter.findOneAndUpdate(
    { name: 'employeeSequence' },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  if (!counter || !Number.isSafeInteger(counter.value)) {
    throw new Error('Failed to generate employee code.');
  }

  return `EMP-${String(counter.value).padStart(4, '0')}`;
};

const hashEmployeePassword = async (password) => {
  if (!password) return '';
  return bcrypt.hash(password, 10);
};

const serializeEmployee = (employee) => {
  const source = employee && employee.toObject ? employee.toObject() : employee || {};
  return {
    _id: source._id ? String(source._id) : '',
    employeeCode: source.employeeCode || '',
    employeeName: source.employeeName || '',
    fullName: source.fullName || source.employeeName || '',
    email: source.email || '',
    phone: source.phone || '',
    contactNo: source.contactNo || source.phone || '',
    designation: source.designation || '',
    department: source.department || 'Sales',
    role: source.role || 'Sales Executive',
    status: source.status || 'Active',
    joiningDate: source.joiningDate || null,
    dateOfJoin: source.dateOfJoin || null,
    dateOfBirth: source.dateOfBirth || null,
    address: source.address || '',
    notes: source.notes || '',
    createdBy: source.createdBy || 'Admin',
    crudOption: Array.isArray(source.crudOption) ? source.crudOption : [],
    modulesOption: Array.isArray(source.modulesOption) ? source.modulesOption : [],
    permissions: normalizePermissionBlock(source.permissions || defaultPermissions()),
    createdAt: source.createdAt || null,
    updatedAt: source.updatedAt || null,
  };
};

exports.getEmployees = async (req, res) => {
  try {
    const {
      page = 1,
      limit = DEFAULT_PAGE_SIZE,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search = '',
      role = '',
      status = '',
      department = '',
    } = req.query;

    const query = {};
    const searchValue = regexFromSearch(search);
    if (searchValue) {
      query.$or = [
        { employeeName: searchValue },
        { email: searchValue },
        { employeeCode: searchValue },
        { designation: searchValue },
        { department: searchValue },
      ];
    }

    if (role) query.role = new RegExp(`^${escapeRegex(role)}$`, 'i');
    if (status) query.status = new RegExp(`^${escapeRegex(status)}$`, 'i');
    if (department) query.department = new RegExp(`^${escapeRegex(department)}$`, 'i');

    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit });
    const sortOptions = normalizeSort(sortBy, sortOrder, ['createdAt', 'employeeName', 'employeeCode', 'role', 'department', 'status']);

    const [employees, total] = await Promise.all([
      Employee.find(query).sort(sortOptions).skip(skip).limit(limitNum).lean(),
      Employee.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: employees.map(serializeEmployee),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Unable to load employees.' });
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).lean();
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    res.status(200).json({ success: true, data: serializeEmployee(employee) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Unable to load employee.' });
  }
};

exports.createEmployee = async (req, res) => {
  try {
    const payload = normaliseEmployeePayload(req.body);
    if (!payload.employeeName || !payload.email) {
      return res.status(400).json({ success: false, message: 'Employee name and email are required.' });
    }
    if (!payload.password || !String(payload.password).trim()) {
      return res.status(400).json({ success: false, message: 'Employee password is required.' });
    }

    payload.passwordHash = await hashEmployeePassword(payload.password);
    payload.passwordSalt = '';
    delete payload.password;

    if (!payload.employeeCode) {
      payload.employeeCode = await generateEmployeeCode();
    }

    const employee = await Employee.create(payload);
    res.status(201).json({ success: true, message: 'Employee created successfully.', data: serializeEmployee(employee) });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((item) => item.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'An employee with this email or code already exists.' });
    }
    res.status(500).json({ success: false, message: error.message || 'Unable to create employee.' });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const payload = normaliseEmployeePayload(req.body);
    if (!payload.employeeName || !payload.email) {
      return res.status(400).json({ success: false, message: 'Employee name and email are required.' });
    }

    if (payload.password) {
      payload.passwordHash = await hashEmployeePassword(payload.password);
      payload.passwordSalt = '';
      delete payload.password;
    }

    const employee = await Employee.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    res.status(200).json({ success: true, message: 'Employee updated successfully.', data: serializeEmployee(employee) });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((item) => item.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'An employee with this email or code already exists.' });
    }
    res.status(500).json({ success: false, message: error.message || 'Unable to update employee.' });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    res.status(200).json({ success: true, message: 'Employee deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Unable to delete employee.' });
  }
};

module.exports = {
  getEmployees: exports.getEmployees,
  getEmployeeById: exports.getEmployeeById,
  createEmployee: exports.createEmployee,
  updateEmployee: exports.updateEmployee,
  deleteEmployee: exports.deleteEmployee,
};
