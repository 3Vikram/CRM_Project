const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'synov-crm-secret-key-change-me';

const getPermissionValue = (permissions, moduleName, action) => {
  if (!permissions || !moduleName || !action) return false;
  if (moduleName === 'dashboard') return action === 'view' && permissions.dashboard === true;
  return permissions[moduleName]?.[action] === true;
};

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (_error) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid.' });
  }
};

const actionForMethod = (method) => {
  if (method === 'GET') return 'view';
  if (method === 'POST') return 'create';
  if (method === 'PUT' || method === 'PATCH') return 'edit';
  if (method === 'DELETE') return 'delete';
  return '';
};

const requirePermission = (moduleName, action) => (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  if (getPermissionValue(req.user?.permissions, moduleName, action || actionForMethod(req.method))) return next();
  return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
};

const requireAnyPermission = (permissions) => (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  const allowed = permissions.some(({ moduleName, action }) => getPermissionValue(req.user?.permissions, moduleName, action));
  if (allowed) return next();
  return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Administrator access is required.' });
};

const requireLeadRecordPermission = (action, resource = 'lead') => async (req, res, next) => {
  if (req.user?.role === 'admin') return next();

  try {
    const Lead = require('../models/Lead');
    const identifier = req.params?.id || req.body?.id;
    let isQuotation = resource === 'quotation';

    if (resource === 'list') {
      const canViewLeads = getPermissionValue(req.user?.permissions, 'leads', 'view');
      const canViewQuotations = getPermissionValue(req.user?.permissions, 'quotations', 'view');
      const requestedQuotation = Boolean(req.query?.quotationType || req.query?.status === 'Proposal Sent');

      if (requestedQuotation && !canViewQuotations) {
        return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
      }
      if (requestedQuotation) isQuotation = true;
      else if (canViewQuotations && !canViewLeads) isQuotation = true;
      else if (!canViewQuotations && !canViewLeads) {
        return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
      }

      if (canViewQuotations !== canViewLeads) {
        req.leadResourceFilter = { quotationId: { $exists: isQuotation } };
      }
    } else if (resource === 'new-record') {
      isQuotation = Boolean(req.body?.quotationId || req.body?.leadStatus === 'Proposal Sent');
    } else if (resource === 'record') {
      const lead = await Lead.findById(identifier).select('quotationId').lean();
      if (!lead) return res.status(404).json({ success: false, message: 'Record not found.' });
      isQuotation = Boolean(lead.quotationId);
    }

    const moduleName = isQuotation ? 'quotations' : 'leads';
    if (getPermissionValue(req.user?.permissions, moduleName, action)) return next();
    return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Unable to verify record permissions.' });
  }
};

module.exports = { authMiddleware, requirePermission, requireAnyPermission, requireAdmin, requireLeadRecordPermission, getPermissionValue, JWT_SECRET };
