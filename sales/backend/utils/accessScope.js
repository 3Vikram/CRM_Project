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

module.exports = { hasFullAccess, ownerScope, creatorFields, resolveCreatorNames };
