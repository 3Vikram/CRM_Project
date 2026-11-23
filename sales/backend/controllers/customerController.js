/**
 * customerController.js
 * Business logic for Customer CRUD operations, including
 * search, filtering, sorting, and pagination for the list view.
 */

const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const OPF = require('../models/OPF');
const { DEFAULT_PAGE_SIZE, parsePagination, normalizeSort, regexFromSearch, escapeRegex: escapeQueryRegex } = require('../utils/queryUtils');
const { ownerScope, creatorFields } = require('../utils/accessScope');
const { customerDuplicateConditions, customerIdentityKeys } = require('../utils/customerDuplicates');

const customerScope = (req) => {
  const id = String(req.user?.id || '').trim();
  return ownerScope(req, { extraClauses: id ? [{ 'assignedEmployees.employeeId': id }] : [] });
};

const isDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const addDateDays = (dateKey, days) => {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const todayInKolkata = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const parseAnalyticsRange = (query) => {
  const today = todayInKolkata();
  const hasStart = Boolean(query.startDate);
  const hasEnd = Boolean(query.endDate);
  if (hasStart !== hasEnd) return null;
  if (!hasStart) {
    const firstOfCurrentMonth = `${today.slice(0, 7)}-01`;
    const startDate = new Date(`${firstOfCurrentMonth}T00:00:00.000Z`);
    startDate.setUTCMonth(startDate.getUTCMonth() - 11);
    return { start: startDate.toISOString().slice(0, 10), end: today };
  }
  const start = String(query.startDate);
  const end = String(query.endDate);
  if (!isDateKey(start) || !isDateKey(end) || start > end) return null;
  return { start, end };
};

const dateBoundary = (dateKey) => new Date(`${dateKey}T00:00:00.000+05:30`);
const normalizeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const getOpfRevenue = (opf) => opf.revenue !== undefined && opf.revenue !== null && opf.revenue !== ''
  ? normalizeNumber(opf.revenue)
  : normalizeNumber(opf.quantity) * normalizeNumber(opf.unitPrice)
    + normalizeNumber(opf.serviceCost) + normalizeNumber(opf.freightCost);
const getOpfMargin = (opf) => opf.margin !== undefined && opf.margin !== null && opf.margin !== ''
  ? normalizeNumber(opf.margin)
  : getOpfRevenue(opf) - normalizeNumber(opf.quantity) * normalizeNumber(opf.vendorPrice)
    - normalizeNumber(opf.serviceCost) - normalizeNumber(opf.freightCost);

const buildCustomerAnalytics = ({ customers, leads, opfs, range }) => {
  const start = dateBoundary(range.start);
  const endExclusive = dateBoundary(addDateDays(range.end, 1));
  const periodDuration = endExclusive.getTime() - start.getTime();
  const previousStart = new Date(start.getTime() - periodDuration);
  const previousEnd = start;
  const inDateRange = (value, from, to) => {
    const date = value ? new Date(value) : null;
    return Boolean(date && !Number.isNaN(date.getTime()) && date >= from && date < to);
  };
  const currentCustomers = customers.filter((customer) => inDateRange(customer.createdAt, start, endExclusive));
  const previousCustomers = customers.filter((customer) => inDateRange(customer.createdAt, previousStart, previousEnd));
  const previousByIndustry = new Map();
  for (const customer of previousCustomers) {
    const industry = String(customer.industry || 'Not recorded').trim() || 'Not recorded';
    previousByIndustry.set(industry, (previousByIndustry.get(industry) || 0) + 1);
  }

  const sectorCounts = new Map();
  const statusCounts = { active: 0, inactive: 0 };
  const monthCounts = new Map();
  const monthFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  });
  for (const customer of currentCustomers) {
    const industry = String(customer.industry || 'Not recorded').trim() || 'Not recorded';
    sectorCounts.set(industry, (sectorCounts.get(industry) || 0) + 1);
    if (customer.status === 'Active') statusCounts.active += 1;
    if (customer.status === 'Inactive') statusCounts.inactive += 1;
    const monthParts = Object.fromEntries(monthFormatter.formatToParts(new Date(customer.createdAt))
      .map(({ type, value }) => [type, value]));
    const monthKey = `${monthParts.year}-${monthParts.month}`;
    monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1);
  }

  const sectorDistribution = [...sectorCounts.entries()]
    .map(([industry, count]) => ({ industry, count }))
    .sort((left, right) => right.count - left.count || left.industry.localeCompare(right.industry));
  const leadingSector = sectorDistribution[0];
  const previousLeadingSectorCount = leadingSector ? previousByIndustry.get(leadingSector.industry) || 0 : 0;
  const sectorChangePercent = leadingSector && previousLeadingSectorCount
    ? Math.round(((leadingSector.count - previousLeadingSectorCount) / previousLeadingSectorCount) * 1000) / 10
    : null;

  const customerById = new Map(customers.map((customer) => [String(customer._id), customer]));
  const customerNameCounts = new Map();
  for (const customer of customers) {
    const name = String(customer.companyName || '').trim().toLocaleLowerCase();
    if (name) customerNameCounts.set(name, (customerNameCounts.get(name) || 0) + 1);
  }
  const customerByUniqueName = new Map(customers
    .filter((customer) => {
      const name = String(customer.companyName || '').trim().toLocaleLowerCase();
      return name && customerNameCounts.get(name) === 1;
    })
    .map((customer) => [String(customer.companyName).trim().toLocaleLowerCase(), customer]));
  const leadById = new Map(leads.map((lead) => [String(lead._id), lead]));
  const leadByCustomerId = new Map(
    leads.filter((lead) => lead.isConverted && lead.customerId)
      .map((lead) => [String(lead.customerId), lead]),
  );
  const leadForCustomer = (customer) => leadById.get(String(customer.sourceLeadId || ''))
    || leadByCustomerId.get(String(customer._id));
  const customerRevenue = new Map();
  const industryRevenue = new Map();
  let hasMarginData = false;
  for (const opf of opfs) {
    const linkedCustomer = (opf.customerId && customerById.get(String(opf.customerId)))
      || (!opf.customerId && customerByUniqueName.get(String(opf.customerName || '').trim().toLocaleLowerCase()));
    if (!linkedCustomer) continue;
    const revenue = getOpfRevenue(opf);
    const margin = getOpfMargin(opf);
    const customerKey = String(linkedCustomer._id);
    const customerGroup = customerRevenue.get(customerKey) || {
      customer: String(linkedCustomer.companyName || 'Customer'),
      revenue: 0,
      margin: 0,
      recordCount: 0,
      marginRecordCount: 0,
    };
    customerGroup.revenue += revenue;
    customerGroup.recordCount += 1;
    const hasOpfMargin = (opf.margin !== undefined && opf.margin !== null && opf.margin !== '')
      || normalizeNumber(opf.vendorPrice) > 0;
    if (hasOpfMargin) {
      customerGroup.margin += margin;
      customerGroup.marginRecordCount += 1;
    }
    customerRevenue.set(customerKey, customerGroup);

    const industry = String(linkedCustomer.industry || '').trim();
    if (industry) industryRevenue.set(industry, (industryRevenue.get(industry) || 0) + revenue);
    if (hasOpfMargin) hasMarginData = true;
  }

  const industryRevenueRanking = [...industryRevenue.entries()]
    .map(([industry, revenue]) => ({ industry, revenue }))
    .sort((left, right) => right.revenue - left.revenue);

  const conversionCounts = { convertedLeads: 0, directCustomers: 0 };
  const leadSources = new Map();
  for (const customer of currentCustomers) {
    const lead = leadForCustomer(customer);
    if (!lead) {
      conversionCounts.directCustomers += 1;
      continue;
    }
    conversionCounts.convertedLeads += 1;
    const source = String(lead.sourceOfLead || lead.source || 'Not recorded').trim() || 'Not recorded';
    leadSources.set(source, (leadSources.get(source) || 0) + 1);
  }

  const firstMonth = range.start.slice(0, 7);
  const lastMonth = range.end.slice(0, 7);
  const growthTrend = [];
  let month = firstMonth;
  while (month <= lastMonth) {
    const date = new Date(`${month}-01T00:00:00.000Z`);
    growthTrend.push({
      month,
      label: date.toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
      customers: monthCounts.get(month) || 0,
    });
    date.setUTCMonth(date.getUTCMonth() + 1);
    month = date.toISOString().slice(0, 7);
  }

  const previousTotal = previousCustomers.length;
  const totalChangePercent = previousTotal
    ? Math.round(((currentCustomers.length - previousTotal) / previousTotal) * 1000) / 10
    : null;
  return {
    range,
    kpis: {
      totalCustomers: currentCustomers.length,
      totalChangePercent,
      leadingSector: leadingSector ? {
        name: leadingSector.industry,
        count: leadingSector.count,
        changePercent: sectorChangePercent,
      } : null,
      leadingIndustryRevenue: industryRevenueRanking[0] || null,
      activeCustomers: statusCounts.active,
      inactiveCustomers: statusCounts.inactive,
    },
    charts: {
      sectorDistribution,
      topCustomers: [...customerRevenue.values()]
        .map((customer) => ({
          ...customer,
          ...(hasMarginData && customer.recordCount === customer.marginRecordCount && customer.revenue !== 0
            ? { marginPercent: Math.round((customer.margin / customer.revenue) * 1000) / 10 }
            : {}),
        }))
        .map(({ recordCount: _recordCount, marginRecordCount: _marginRecordCount, ...customer }) => customer)
        .sort((left, right) => right.revenue - left.revenue)
        .slice(0, 10),
      growthTrend,
      statusDistribution: [
        { status: 'Active', count: statusCounts.active },
        { status: 'Inactive', count: statusCounts.inactive },
      ],
      conversionOverview: {
        convertedLeads: conversionCounts.convertedLeads,
        directCustomers: conversionCounts.directCustomers,
        convertedActivitiesAvailable: false,
      },
      leadAcquisitionSources: [...leadSources.entries()]
        .map(([source, count]) => ({ source, count }))
        .sort((left, right) => right.count - left.count),
      marginAvailable: hasMarginData,
    },
  };
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

const findDuplicateCustomer = async (customer = {}, excludeId = null) => {
  const conditions = customerDuplicateConditions(customer);
  if (!conditions.length) return null;
  const query = { $or: conditions };
  if (excludeId) query._id = { $ne: excludeId };
  return Customer.findOne(query)
    .select({ _id: 1, customerId: 1, companyName: 1, customerName: 1, email: 1, phone: 1, contacts: 1 })
    .lean();
};

const getVisibleDuplicate = (req, duplicate) => duplicate
  ? Customer.findOne({ $and: [{ _id: duplicate._id }, customerScope(req)] })
    .select({ _id: 1, customerId: 1, companyName: 1, customerName: 1, email: 1, phone: 1, contacts: 1 })
    .lean()
  : null;

const respondWithDuplicate = async (req, res, duplicate) => {
  const customer = await getVisibleDuplicate(req, duplicate);
  return res.status(409).json({
    success: false,
    message: 'This customer is already created.',
    ...(customer ? { duplicateCustomer: customer } : {}),
  });
};

exports.checkCustomerDuplicate = async (req, res) => {
  try {
    const payload = parsePayload(req.body);
    const duplicate = await findDuplicateCustomer(payload);
    if (!duplicate) return res.status(200).json({ success: true, duplicate: false, customer: null });
    const customer = await getVisibleDuplicate(req, duplicate);
    return res.status(200).json({
      success: true,
      duplicate: true,
      message: 'This customer is already created.',
      customer: customer || null,
    });
  } catch (error) {
    console.error('Customer duplicate validation failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to validate this customer.' });
  }
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
      industry: 1,
      assignedEmployees: 1,
      approvalStatus: 1,
      approvedBy: 1,
      approvedAt: 1,
      approval: 1,
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

exports.getCustomerSummary = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const scope = customerScope(req);
    const count = (criteria = {}) => Customer.countDocuments(
      Object.keys(scope).length ? { $and: [criteria, scope] } : criteria
    );

    const [total, active, inactive, newThisMonth] = await Promise.all([
      count(),
      count({ status: 'Active' }),
      count({ status: 'Inactive' }),
      count({ createdAt: { $gte: startOfMonth, $lte: now } }),
    ]);

    return res.status(200).json({ success: true, data: { total, active, inactive, newThisMonth } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCustomerAnalytics = async (req, res) => {
  const range = parseAnalyticsRange(req.query || {});
  if (!range) {
    return res.status(400).json({
      success: false,
      message: 'Enter a valid start date and end date for customer analytics.',
    });
  }

  try {
    const visibleCustomers = await Customer.find(customerScope(req))
      .select('_id companyName industry status createdAt sourceLeadId')
      .lean();
    const start = dateBoundary(range.start);
    const end = dateBoundary(addDateDays(range.end, 1));
    const visibleCustomerIds = visibleCustomers.map((customer) => String(customer._id));
    const currentCustomers = visibleCustomers.filter((customer) => {
      const createdAt = new Date(customer.createdAt || '');
      return !Number.isNaN(createdAt.getTime()) && createdAt >= start && createdAt < end;
    });
    const currentCustomerIds = currentCustomers.map((customer) => String(customer._id));
    const leadClauses = [
      ...currentCustomers.map((customer) => String(customer.sourceLeadId || '')).filter(Boolean)
        .map((sourceLeadId) => ({ _id: sourceLeadId })),
      ...(currentCustomerIds.length ? [{ customerId: { $in: currentCustomerIds }, isConverted: true }] : []),
    ];
    const visibleNameCounts = new Map();
    visibleCustomers.forEach((customer) => {
      const name = String(customer.companyName || '').trim();
      if (name) visibleNameCounts.set(name.toLocaleLowerCase(), (visibleNameCounts.get(name.toLocaleLowerCase()) || 0) + 1);
    });
    const customerNames = [...new Set(visibleCustomers
      .map((customer) => String(customer.companyName || '').trim())
      .filter((name) => name && visibleNameCounts.get(name.toLocaleLowerCase()) === 1))];
    const customerLinks = [
      ...(visibleCustomerIds.length ? [{ customerId: { $in: visibleCustomerIds } }] : []),
      ...(customerNames.length ? [{ customerId: null, customerName: { $in: customerNames } }] : []),
    ];

    const [leads, opfs] = await Promise.all([
      leadClauses.length
        ? Lead.find({ $or: leadClauses }).select('_id customerId source sourceOfLead isConverted').lean()
        : Promise.resolve([]),
      customerLinks.length
        ? OPF.find({
          $and: [
            { $or: customerLinks },
            { $or: [
              { createdDate: { $gte: start, $lt: end } },
              { createdDate: { $in: [null] }, createdAt: { $gte: start, $lt: end } },
            ] },
            ownerScope(req),
          ],
        })
          .select('customerId customerName createdDate createdAt quantity unitPrice vendorPrice revenue margin serviceCost freightCost')
          .lean()
        : Promise.resolve([]),
    ]);

    const analytics = buildCustomerAnalytics({
      customers: visibleCustomers,
      leads,
      opfs,
      range,
    });
    return res.status(200).json({ success: true, data: analytics });
  } catch (error) {
    console.error('Unable to load customer analytics:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to load customer analytics.',
    });
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
    delete payload.duplicateKeys;
    delete payload.sourceLeadId;
    const duplicate = await findDuplicateCustomer(payload);
    if (duplicate) return respondWithDuplicate(req, res, duplicate);
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
        customer = await Customer.create({
          ...payload,
          duplicateKeys: customerIdentityKeys(payload),
          customerId: await getNextCustomerId(),
        });
        break;
      } catch (error) {
        if (error.code !== 11000 || error.keyPattern?.duplicateKeys || attempt === 4) throw error;
      }
    }
    res.status(201).json({ success: true, message: 'Customer created successfully', data: customer });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.duplicateKeys) {
      const payload = parsePayload(req.body);
      const duplicate = await findDuplicateCustomer(payload);
      return respondWithDuplicate(req, res, duplicate);
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
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
    delete payload.sourceLeadId;
    const existingCustomer = await Customer.findOne({ $and: [{ _id: req.params.id }, customerScope(req)] }).select('+duplicateKeys');
    if (!existingCustomer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    const existingValues = existingCustomer.toObject();
    const updatedValues = { ...existingValues, ...payload };
    const previousKeys = customerIdentityKeys(existingValues).sort();
    const updatedKeys = customerIdentityKeys(updatedValues).sort();
    const identityChanged = JSON.stringify(previousKeys) !== JSON.stringify(updatedKeys);
    if (identityChanged) {
      const duplicate = await findDuplicateCustomer(updatedValues, req.params.id);
      if (duplicate) return respondWithDuplicate(req, res, duplicate);
      payload.duplicateKeys = updatedKeys;
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
    if (error.code === 11000 && error.keyPattern?.duplicateKeys) {
      const payload = parsePayload(req.body);
      const existing = await Customer.findOne({ _id: req.params.id }).select('+duplicateKeys').lean();
      const duplicate = await findDuplicateCustomer({ ...existing, ...payload }, req.params.id);
      return respondWithDuplicate(req, res, duplicate);
    }
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

exports._buildCustomerAnalytics = buildCustomerAnalytics;
exports._parseCustomerAnalyticsRange = parseAnalyticsRange;
