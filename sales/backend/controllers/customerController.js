/**
 * customerController.js
 * Business logic for Customer CRUD operations, including
 * search, filtering, sorting, and pagination for the list view.
 */

const Customer = require('../models/Customer');
const { DEFAULT_PAGE_SIZE, parsePagination, normalizeSort, regexFromSearch, escapeRegex: escapeQueryRegex } = require('../utils/queryUtils');
const { ownerScope, creatorFields } = require('../utils/accessScope');

const customerScope = (req) => {
  const id = String(req.user?.id || '').trim();
  return ownerScope(req, { extraClauses: id ? [{ 'assignedEmployees.employeeId': id }] : [] });
};

const getNextCustomerId = async () => {
  const customers = await Customer.find({ customerId: /^CI-\d+$/ }).select({ customerId: 1 }).lean();
  const highest = customers.reduce((max, customer) => {
    const number = Number(String(customer.customerId).slice(3));
    return Number.isSafeInteger(number) ? Math.max(max, number) : max;
  }, 0);
  return `CI-${highest + 1}`;
};

const ensureCustomerIds = async () => {
  const customers = await Customer.find({}).select({ customerId: 1, createdAt: 1 }).sort({ createdAt: 1, _id: 1 }).lean();
  let highest = customers.reduce((max, customer) => {
    const number = /^CI-(\d+)$/.exec(String(customer.customerId || ''))?.[1];
    return number && Number.isSafeInteger(Number(number)) ? Math.max(max, Number(number)) : max;
  }, 0);

  for (const customer of customers) {
    if (/^CI-\d+$/.test(String(customer.customerId || ''))) continue;
    highest += 1;
    await Customer.updateOne({ _id: customer._id }, { $set: { customerId: `CI-${highest}` } });
  }
};

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

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findDuplicateCustomer = async ({ companyName, gstNumber } = {}, excludeId = null) => {
  const conditions = [];
  const name = String(companyName || '').trim().replace(/\s+/g, ' ');
  if (name) {
    conditions.push({ companyName: new RegExp(`^\\s*${escapeRegex(name).replace(/ /g, '\\s+')}\\s*$`, 'i') });
  }
  const gst = String(gstNumber || '').trim().toUpperCase();
  if (gst) conditions.push({ gstNumber: gst });
  if (!conditions.length) return null;
  const query = { $or: conditions };
  if (excludeId) query._id = { $ne: excludeId };
  return Customer.findOne(query).select({ _id: 1, companyName: 1 }).lean();
};

exports.getCustomers = async (req, res) => {
  try {
    await ensureCustomerIds();
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

    const query = {};
    const searchValue = regexFromSearch(search);
    if (searchValue) {
      query.$or = [
        { customerName: searchValue },
        { companyName: searchValue },
        { email: searchValue },
        { phone: searchValue },
      ];
    }

    if (createdBy) query.createdBy = new RegExp(`^${escapeQueryRegex(createdBy)}$`, 'i');
    if (status) query.status = status;
    if (accountType) query.accountType = accountType;

    if (createdDate) {
      const dateRange = resolveCreatedDateRange(createdDate);
      if (dateRange) query.createdAt = dateRange;
    }

    const scope = customerScope(req);
    const finalQuery = Object.keys(scope).length ? { $and: [query, scope] } : query;
    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit });
    const projection = {
      companyName: 1,
      customerId: 1,
      customerName: 1,
      email: 1,
      phone: 1,
      status: 1,
      accountType: 1,
      createdBy: 1,
      createdById: 1,
      createdAt: 1,
      billToAddress: 1,
      state: 1,
      notes: 1,
      contacts: 1,
    };
    const sortOptions = normalizeSort(sortBy, sortOrder, ['createdAt', 'companyName', 'customerName', 'status', 'createdBy', 'email']);

    const [customers, total] = await Promise.all([
      Customer.find(finalQuery)
        .select(projection)
        .populate('createdById', 'fullName employeeName')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Customer.countDocuments(finalQuery),
    ]);

    const customerData = customers.map((customer) => {
      const creator = customer.createdById && typeof customer.createdById === 'object'
        ? customer.createdById
        : null;
      const storedCreatorName = String(customer.createdBy || '').trim();
      const currentCreatorName = String(creator?.fullName || creator?.employeeName || '').trim();

      return {
        ...customer,
        createdBy: currentCreatorName || storedCreatorName,
        createdById: creator?._id ? String(creator._id) : customer.createdById ? String(customer.createdById) : null,
      };
    });

    res.status(200).json({
      success: true,
      data: customerData,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getInventoryCustomerOptions = async (_req, res) => {
  try {
    const customers = await Customer.find({})
      .select({
        _id: 1,
        companyName: 1,
        contacts: 1,
        billToAddress: 1,
        shipToSameAsBilling: 1,
        shipToAddress: 1,
        gstNumber: 1,
        email: 1,
      })
      .sort({ companyName: 1, _id: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: customers.map(({
        _id,
        companyName,
        contacts = [],
        billToAddress = {},
        shipToSameAsBilling = true,
        shipToAddress = {},
        gstNumber = '',
        email = '',
      }) => {
        const customerContacts = Array.isArray(contacts) ? contacts : [];
        const contactPersons = customerContacts
          .map((contact) => String(contact?.name || '').trim())
          .filter(Boolean);
        const primaryContactPerson =
          customerContacts.find((contact) => String(contact?.contactType || '').trim().toLowerCase() === 'primary')
            ?.name?.trim() || contactPersons[0] || '';
        const customerCompanyName = String(companyName || '').trim() || 'Untitled Customer';

        return {
          id: String(_id),
          customerName: customerCompanyName,
          companyName: customerCompanyName,
          contactPersons,
          primaryContactPerson,
          billToAddress,
          shipToSameAsBilling,
          shipToAddress,
          gstNumber,
          email,
        };
      }),
    });
  } catch (error) {
    console.error('Unable to load Inventory customer options:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to load customer names.',
    });
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findOne({ $and: [{ _id: req.params.id }, customerScope(req)] }).select({ __v: 0 }).lean();
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
    await ensureCustomerIds();
    const payload = parsePayload(req.body);
    Object.assign(payload, creatorFields(req));
    delete payload.assignedEmployees;
    const duplicate = await findDuplicateCustomer(payload);
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'This customer already exists.' });
    }
    if (req.files && req.files.length) {
      payload.documents = req.files.map((file) => ({
        fileName: file.originalname,
        filePath: `/uploads/${file.filename}`,
        documentType: file.mimetype,
      }));
    }

    let customer;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        customer = await Customer.create({ ...payload, customerId: await getNextCustomerId() });
        break;
      } catch (error) {
        if (error.code !== 11000 || attempt === 4) throw error;
      }
    }
    res.status(201).json({ success: true, message: 'Customer created successfully', data: customer });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'This customer already exists.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const payload = parsePayload(req.body);
    delete payload.customerId;
    delete payload.createdBy;
    delete payload.createdById;
    delete payload.assignedEmployees;
    const existingCustomer = await Customer.findOne({ $and: [{ _id: req.params.id }, customerScope(req)] }).select({ _id: 1 }).lean();
    if (!existingCustomer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    const duplicate = await findDuplicateCustomer(payload, req.params.id);
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'This customer already exists.' });
    }
    if (req.files && req.files.length) {
      payload.documents = req.files.map((file) => ({
        fileName: file.originalname,
        filePath: `/uploads/${file.filename}`,
        documentType: file.mimetype,
      }));
    }

    const customer = await Customer.findOneAndUpdate(
      { $and: [{ _id: req.params.id }, customerScope(req)] },
      payload,
      { new: true, runValidators: true }
    );
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: customer,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOneAndDelete({ $and: [{ _id: req.params.id }, customerScope(req)] });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.status(200).json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
