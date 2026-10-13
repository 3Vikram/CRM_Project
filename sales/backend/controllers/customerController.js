/**
 * customerController.js
 * Business logic for Customer CRUD operations, including
 * search, filtering, sorting, and pagination for the list view.
 */

const Customer = require('../models/Customer');
const { DEFAULT_PAGE_SIZE, parsePagination } = require('../utils/queryUtils');

const resolveCreatedDateRange = (value) => {
  if (!value || value === 'all') return null;

  if (typeof value === 'string' && !/\d{4}-\d{2}-\d{2}/.test(value)) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (value) {
      case 'today':
        return { $gte: startOfToday, $lte: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1) };
      case 'yesterday': {
        const start = new Date(startOfToday);
        start.setDate(start.getDate() - 1);
        const end = new Date(startOfToday);
        end.setTime(startOfToday.getTime() - 1);
        return { $gte: start, $lte: end };
      }
      case 'last7days': {
        const start = new Date(startOfToday);
        start.setDate(start.getDate() - 6);
        return { $gte: start, $lte: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1) };
      }
      case 'last30days': {
        const start = new Date(startOfToday);
        start.setDate(start.getDate() - 29);
        return { $gte: start, $lte: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1) };
      }
      case 'thismonth': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { $gte: start, $lte: end };
      }
      default: {
        const exactDate = new Date(value);
        if (Number.isNaN(exactDate.getTime())) return null;
        const start = new Date(exactDate.getFullYear(), exactDate.getMonth(), exactDate.getDate());
        const end = new Date(exactDate.getFullYear(), exactDate.getMonth(), exactDate.getDate(), 23, 59, 59, 999);
        return { $gte: start, $lte: end };
      }
    }
  }

  const exactDate = new Date(value);
  if (Number.isNaN(exactDate.getTime())) return null;
  const start = new Date(exactDate.getFullYear(), exactDate.getMonth(), exactDate.getDate());
  const end = new Date(exactDate.getFullYear(), exactDate.getMonth(), exactDate.getDate(), 23, 59, 59, 999);
  return { $gte: start, $lte: end };
};

const parsePayload = (body = {}) => {
  const payload = {};
  Object.entries(body).forEach(([key, value]) => {
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
  return payload;
};

exports.getCustomers = async (req, res) => {
  try {
    Customer.ensureCustomerIds();
    const {
      page = 1,
      limit = DEFAULT_PAGE_SIZE,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search = '',
      createdBy = '',
      status = '',
      createdDate = '',
      accountType = '',
    } = req.query;

    const { page: pageNum, limit: limitNum } = parsePagination({ page, limit });
    const dateRange = resolveCreatedDateRange(createdDate);
    const result = Customer.list({
      page: pageNum,
      limit: limitNum,
      sortBy,
      sortOrder,
      search,
      createdBy,
      status,
      accountType,
      createdDateStart: dateRange?.$gte.toISOString() || '',
      createdDateEnd: dateRange?.$lte.toISOString() || '',
    });
    const projection = [
      'companyName', 'customerId', 'customerName', 'email', 'phone', 'status',
      'accountType', 'createdBy', 'createdAt', 'billToAddress', 'state', 'notes', 'contacts',
    ];

    res.status(200).json({
      success: true,
      data: result.data.map((customer) => ({
        _id: customer._id,
        ...Object.fromEntries(projection.map((field) => [field, customer[field]])),
      })),
      pagination: {
        total: result.pagination.total,
        page: pageNum,
        limit: limitNum,
        totalPages: result.pagination.totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const customer = Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.status(200).json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createCustomer = async (req, res) => {
  try {
    const payload = parsePayload(req.body);
    if (req.files && req.files.length) {
      payload.documents = req.files.map((file) => ({
        fileName: file.originalname,
        filePath: `/uploads/${file.filename}`,
        documentType: file.mimetype,
      }));
    }

    const customer = Customer.create(payload);
    res.status(201).json({ success: true, message: 'Customer created successfully', data: customer });
  } catch (error) {
    if (Customer.isValidationError(error)) {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ success: false, message: 'A customer with this customer ID already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const payload = parsePayload(req.body);
    delete payload.customerId;
    if (req.files && req.files.length) {
      payload.documents = req.files.map((file) => ({
        fileName: file.originalname,
        filePath: `/uploads/${file.filename}`,
        documentType: file.mimetype,
      }));
    }

    const customer = Customer.updateById(req.params.id, payload);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: customer,
    });
  } catch (error) {
    if (Customer.isValidationError(error)) {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const customer = Customer.deleteById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.status(200).json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
