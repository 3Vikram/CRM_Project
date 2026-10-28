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

const creatorFields = (req) => ({
  createdBy: String(req.user?.name || 'Admin').trim() || 'Admin',
  createdById: String(req.user?.id || '').trim(),
});

module.exports = { hasFullAccess, ownerScope, creatorFields };
