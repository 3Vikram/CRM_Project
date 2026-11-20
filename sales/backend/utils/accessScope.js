const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const FULL_ACCESS_EMPLOYEE_TYPES = ['admin', 'manager'];

const hasFullAccess = (user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return FULL_ACCESS_EMPLOYEE_TYPES.includes(String(user.employeeType || '').trim().toLowerCase());
};

// Mongo filter that limits records to the ones created by the logged-in user.
// Returns {} for people with full access. Older records that have no creator id
// are matched by creator name.
const ownerScope = (req, { idField = 'createdById', nameField = 'createdBy', extraClauses = [] } = {}) => {
  if (hasFullAccess(req.user)) return {};
  const id = String(req.user?.id || '').trim();
  const name = String(req.user?.name || '').trim();
  const clauses = [];
  if (id) clauses.push({ [idField]: id });
  if (name) clauses.push({ [idField]: { $in: [null, ''] }, [nameField]: new RegExp(`^${escapeRegex(name)}$`, 'i') });
  clauses.push(...extraClauses);
  return clauses.length ? { $or: clauses } : { _id: null };
};

const hasReportFullAccess = (user) => hasFullAccess(user)
  || String(user?.employeeRole || '').trim().toLowerCase() === 'sales manager';

const managedReportEmployeesByRequest = new WeakMap();

const reportOwnerScope = (req, { idField = 'createdById', nameField = 'createdBy', extraClauses = [] } = {}) => {
  if (req.user?.role === 'admin') return {};
  const id = String(req.user?.id || '').trim();
  const name = String(req.user?.name || '').trim();
  const clauses = [];
  if (id) clauses.push({ [idField]: id });
  if (name) clauses.push({ [idField]: { $in: [null, ''] }, [nameField]: new RegExp(`^${escapeRegex(name)}$`, 'i') });
  clauses.push(...extraClauses);
  return clauses.length ? { $or: clauses } : { _id: null };
};

const getManagedReportEmployees = async (req) => {
  if (!managedReportEmployeesByRequest.has(req)) {
    const employeeQuery = (async () => {
      const Employee = require('../models/Employee');
      if (req.user?.role === 'admin') {
        return Employee.find({}).select('employeeName fullName').sort({ employeeName: 1 }).lean();
      }

      const name = String(req.user?.name || '').trim();
      const clauses = [{ _id: String(req.user?.id || '') }];
      if (hasReportFullAccess(req.user) && name) {
        clauses.push({ reportingTo: new RegExp(`^${escapeRegex(name)}$`, 'i') });
      }
      return Employee.find({ $or: clauses }).select('employeeName fullName').sort({ employeeName: 1 }).lean();
    })();
    managedReportEmployeesByRequest.set(req, employeeQuery);
  }
  return managedReportEmployeesByRequest.get(req);
};

const buildReportOwnerScope = async (req, { idField = 'createdById', nameField = 'createdBy', extraClauses = [] } = {}) => {
  if (req.user?.role === 'admin') return {};

  const userId = String(req.user?.id || '').trim();
  const userName = String(req.user?.name || '').trim();
  const isManager = hasReportFullAccess(req.user);
  const managedEmployees = isManager ? await getManagedReportEmployees(req) : [];
  const employeeIds = [...new Set([userId, ...managedEmployees.map((employee) => String(employee._id || '').trim())].filter(Boolean))];
  const employeeNames = [...new Set([
    userName,
    ...managedEmployees.flatMap((employee) => [employee.employeeName, employee.fullName]),
  ].map((value) => String(value || '').trim()).filter(Boolean))];
  const clauses = [];

  if (employeeIds.length) clauses.push({ [idField]: { $in: employeeIds } });
  if (employeeNames.length) {
    clauses.push({
      [idField]: { $in: [null, ''] },
      [nameField]: { $in: employeeNames.map((name) => new RegExp(`^${escapeRegex(name)}$`, 'i')) },
    });
  }

  extraClauses.forEach((clause) => {
    const [[field]] = Object.entries(clause);
    if (['assignedTo', 'assignedUser'].includes(field)) {
      if (employeeNames.length) clauses.push({ [field]: { $in: employeeNames } });
    } else if (['assignedToId', 'assignedUserId'].includes(field)) {
      if (employeeIds.length) clauses.push({ [field]: { $in: employeeIds } });
    } else if (field === 'assignedEmployees.employeeId') {
      if (employeeIds.length) clauses.push({ [field]: { $in: employeeIds } });
    } else {
      clauses.push(clause);
    }
  });

  return clauses.length ? { $or: clauses } : { _id: null };
};

const creatorFields = (req) => {
  const createdBy = String(req.user?.name || '').trim();
  const createdById = String(req.user?.id || '').trim();
  if (!createdBy || !createdById) {
    throw new Error('Authenticated creator identity is unavailable.');
  }
  return { createdBy, createdById };
};

const resolveCreatorNames = async (records) => {
  const rows = Array.isArray(records) ? records : [records];
  const employeeIds = [...new Set(rows
    .map((record) => String(record?.createdById || '').trim())
    .filter((id) => /^[a-f\d]{24}$/i.test(id)))];
  if (!employeeIds.length) return records;

  const Employee = require('../models/Employee');
  const employees = await Employee.find({ _id: { $in: employeeIds } })
    .select('employeeName fullName')
    .lean();
  const namesById = new Map(employees.map((employee) => [
    String(employee._id),
    String(employee.employeeName || employee.fullName || '').trim(),
  ]));
  const resolved = rows.map((record) => {
    const employeeName = namesById.get(String(record?.createdById || '').trim());
    if (!employeeName) return record;
    return { ...record, createdBy: employeeName };
  });
  return Array.isArray(records) ? resolved : resolved[0];
};

const resolveActivityEmployeeNames = async (records) => {
  const rows = Array.isArray(records) ? records : [records];
  const employeeIds = [...new Set(rows.flatMap((record) => [
    String(record?.createdById || '').trim(),
    String(record?.assignedUserId || '').trim(),
  ]).filter((id) => /^[a-f\d]{24}$/i.test(id)))];
  if (!employeeIds.length) return records;

  const Employee = require('../models/Employee');
  const employees = await Employee.find({ _id: { $in: employeeIds } })
    .select('employeeName fullName')
    .lean();
  const namesById = new Map(employees.map((employee) => [
    String(employee._id),
    String(employee.employeeName || employee.fullName || '').trim(),
  ]));
  const resolved = rows.map((record) => {
    const creatorName = namesById.get(String(record?.createdById || '').trim());
    const assignedName = namesById.get(String(record?.assignedUserId || '').trim());
    return {
      ...record,
      ...(!String(record?.createdBy || '').trim() && creatorName ? { createdBy: creatorName } : {}),
      ...(assignedName ? { assignedUser: assignedName } : {}),
    };
  });
  return Array.isArray(records) ? resolved : resolved[0];
};

module.exports = {
  hasFullAccess,
  hasReportFullAccess,
  ownerScope,
  reportOwnerScope,
  buildReportOwnerScope,
  getManagedReportEmployees,
  creatorFields,
  resolveCreatorNames,
  resolveActivityEmployeeNames,
};
