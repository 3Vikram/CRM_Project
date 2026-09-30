const OPF = require('../models/OPF');
const Employee = require('../models/Employee');
const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const Contact = require('../models/Contact');
const Activity = require('../models/Activity');
const { DEFAULT_PAGE_SIZE, parsePagination, escapeRegex } = require('../utils/queryUtils');

const normalizeNumber = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const calculateFinancials = (opf) => {
  const quantity = normalizeNumber(opf.quantity);
  const revenue = opf.revenue !== undefined && opf.revenue !== null && opf.revenue !== ''
    ? Number(opf.revenue)
    : quantity * normalizeNumber(opf.unitPrice);
  const derivedMargin = revenue - (quantity * normalizeNumber(opf.vendorPrice));
  const margin = opf.margin !== undefined && opf.margin !== null && opf.margin !== ''
    ? Number(opf.margin)
    : derivedMargin;

  return {
    revenue: Number.isFinite(revenue) ? revenue : 0,
    margin: Number.isFinite(margin) ? margin : 0,
  };
};

const dateRange = (value) => {
  if (!value || value === 'all') return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return {
    $gte: date,
    $lt: new Date(date.getTime() + 24 * 60 * 60 * 1000),
  };
};

const buildOpfQuery = ({ createdBy = '', createdDate = '', customerName = '', product = '' } = {}) => {
  const query = {};
  if (createdBy && createdBy !== 'all') query.createdBy = new RegExp(`^${escapeRegex(createdBy)}$`, 'i');
  if (customerName && customerName !== 'all') query.customerName = new RegExp(`^${escapeRegex(customerName)}$`, 'i');
  if (product && product !== 'all') query.product = new RegExp(`^${escapeRegex(product)}$`, 'i');
  const createdDateRange = dateRange(createdDate);
  if (createdDateRange) query.createdDate = createdDateRange;
  return query;
};

const buildLeadQuery = ({ createdBy = '', createdDate = '', customerName = '', product = '' } = {}) => {
  const query = {};
  if (createdBy && createdBy !== 'all') query.createdBy = new RegExp(`^${escapeRegex(createdBy)}$`, 'i');
  if (customerName && customerName !== 'all') query.companyName = new RegExp(`^${escapeRegex(customerName)}$`, 'i');
  if (product && product !== 'all') query['products.productName'] = new RegExp(`^${escapeRegex(product)}$`, 'i');
  const createdDateRange = dateRange(createdDate);
  if (createdDateRange) query.createdDate = createdDateRange;
  return query;
};

const uniqueValues = (values) => Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

const enrichOpfRecord = (record) => {
  const financials = calculateFinancials(record);
  const quantity = normalizeNumber(record.quantity);
  const cost = quantity * normalizeNumber(record.vendorPrice);
  return { ...record, quantity, cost, ...financials };
};

const aggregateBy = (records, key, label) => {
  const groups = new Map();
  records.forEach((record) => {
    const groupValue = String(record[key] || 'Unknown').trim() || 'Unknown';
    const current = groups.get(groupValue) || { [label]: groupValue, orders: 0, quantity: 0, revenue: 0, cost: 0, profit: 0 };
    current.orders += 1;
    current.quantity += record.quantity;
    current.revenue += record.revenue;
    current.cost += record.cost;
    current.profit += record.margin;
    groups.set(groupValue, current);
  });
  return Array.from(groups.values()).map((row, index) => ({
    rank: index + 1,
    ...row,
    marginPercent: row.revenue ? (row.profit / row.revenue) * 100 : 0,
  }));
};

const reportOptions = async (opfRecords) => {
  const [employees, customers] = await Promise.all([
    Employee.find({}).select('employeeName fullName').sort({ employeeName: 1 }).lean(),
    Customer.find({}).select('companyName customerName').sort({ companyName: 1 }).lean(),
  ]);
  return {
    createdBy: uniqueValues(employees.flatMap((employee) => [employee.employeeName, employee.fullName]).concat(opfRecords.map((record) => record.createdBy))),
    createdDates: uniqueValues(opfRecords.map((record) => record.createdDate ? new Date(record.createdDate).toISOString().slice(0, 10) : '')),
    customerNames: uniqueValues(customers.flatMap((customer) => [customer.companyName, customer.customerName]).concat(opfRecords.map((record) => record.customerName))),
    products: uniqueValues(opfRecords.map((record) => record.product)),
  };
};

const paginateRows = (rows, page, limit) => {
  const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit });
  return {
    data: rows.slice(skip, skip + limitNum),
    pagination: { total: rows.length, page: pageNum, limit: limitNum, totalPages: Math.max(1, Math.ceil(rows.length / limitNum)) },
  };
};

exports.getReport = async (req, res) => {
  try {
    const { reportKey } = req.params;
    const { page = 1, limit = DEFAULT_PAGE_SIZE, createdBy = '', createdDate = '', customerName = '', product = '' } = req.query;
    if (reportKey === 'team-analysis') {
      return res.status(200).json({ success: true, data: [], unavailable: true, message: 'Team-level data is not available because this CRM has no Team entity.' });
    }

    const opfQuery = buildOpfQuery({ createdBy, createdDate, customerName, product });
    const opfRecords = (await OPF.find(opfQuery).select('createdBy createdDate customerName product quantity unitPrice vendorPrice revenue margin').sort({ createdDate: -1 }).lean()).map(enrichOpfRecord);
    const options = await reportOptions(opfRecords);
    let rows;

    if (reportKey === 'top-customers') rows = aggregateBy(opfRecords, 'customerName', 'customer');
    else if (reportKey === 'top-employees') rows = aggregateBy(opfRecords, 'createdBy', 'employee');
    else if (reportKey === 'top-products' || reportKey === 'product-analysis') rows = aggregateBy(opfRecords, 'product', 'product');
    else if (reportKey === 'funnel-analysis') {
      const leads = await Lead.find(buildLeadQuery({ createdBy, createdDate, customerName, product })).select('leadStatus products createdDate').lean();
      const stages = new Map();
      leads.forEach((lead) => {
        const stage = lead.leadStatus || 'Unknown';
        const amount = (lead.products || []).reduce((sum, item) => sum + normalizeNumber(item.quantity) * normalizeNumber(item.unitPrice), 0);
        const current = stages.get(stage) || { stage, count: 0, amount: 0 };
        current.count += 1;
        current.amount += amount;
        stages.set(stage, current);
      });
      rows = Array.from(stages.values()).map((row, index, all) => ({ ...row, conversionPercent: index === 0 ? 100 : (row.count / (all[0]?.count || 1)) * 100 }));
    } else if (reportKey === 'usages' || reportKey === 'usage') {
      const usageDate = dateRange(createdDate);
      const usageCreatedBy = createdBy && createdBy !== 'all' ? new RegExp(`^${escapeRegex(createdBy)}$`, 'i') : undefined;
      const [employees, customers, contacts, leads, activities] = await Promise.all([
        Employee.find({}).select('employeeName fullName').lean(),
        Customer.find({ ...(usageCreatedBy ? { createdBy: usageCreatedBy } : {}), ...(usageDate ? { createdAt: usageDate } : {}) }).select('createdBy').lean(),
        Contact.find(usageDate ? { createdAt: usageDate } : {}).select('createdAt').lean(),
        Lead.find({ ...(usageCreatedBy ? { createdBy: usageCreatedBy } : {}), ...(usageDate ? { createdDate: usageDate } : {}) }).select('createdBy').lean(),
        Activity.find({ deletedAt: null, ...(usageCreatedBy ? { createdBy: usageCreatedBy } : {}), ...(usageDate ? { createdAt: usageDate } : {}) }).select('createdBy').lean(),
      ]);
      const names = uniqueValues(employees.flatMap((employee) => [employee.employeeName, employee.fullName]).concat(opfRecords.map((record) => record.createdBy)));
      rows = names.map((employee) => ({ employee, customersCreated: customers.filter((item) => item.createdBy === employee).length, quotations: leads.filter((item) => item.createdBy === employee).length, sales: opfRecords.filter((item) => item.createdBy === employee).length, activities: activities.filter((item) => item.createdBy === employee).length }));
    } else {
      return res.status(400).json({ success: false, message: `Unknown report: ${reportKey}` });
    }

    rows = rows.sort((a, b) => Number(b.revenue || b.profit || b.amount || b.count || 0) - Number(a.revenue || a.profit || a.amount || a.count || 0));
    if (reportKey === 'top-customers' || reportKey === 'top-employees' || reportKey === 'top-products') {
      rows = rows.slice(0, 10).map((row, index) => ({ ...row, rank: index + 1 }));
    }
    const result = paginateRows(rows, page, limit);
    return res.status(200).json({ success: true, ...result, options });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRevenueMarginReport = async (req, res) => {
  try {
    const {
      page = 1,
      limit = DEFAULT_PAGE_SIZE,
      search = '',
      createdBy = '',
      createdDate = '',
      customerName = '',
      product = '',
    } = req.query;

    const query = {};
    if (createdBy && createdBy !== 'all') query.createdBy = new RegExp(`^${escapeRegex(createdBy)}$`, 'i');
    if (customerName && customerName !== 'all') query.customerName = new RegExp(`^${escapeRegex(customerName)}$`, 'i');
    if (product && product !== 'all') query.product = new RegExp(`^${escapeRegex(product)}$`, 'i');
    const createdDateRange = dateRange(createdDate);
    if (createdDateRange) query.createdDate = createdDateRange;
    if (search) query.createdBy = new RegExp(escapeRegex(search), 'i');

    const [records, optionRecords, employees, customers] = await Promise.all([
      OPF.find(query)
        .select('createdBy createdDate customerName product revenue margin quantity unitPrice vendorPrice')
        .sort({ createdBy: 1, createdDate: -1 })
        .lean(),
      OPF.find({})
        .select('createdBy createdDate customerName product')
        .sort({ createdBy: 1 })
        .lean(),
      Employee.find({}).select('employeeName fullName').sort({ employeeName: 1 }).lean(),
      Customer.find({}).select('companyName customerName').sort({ companyName: 1 }).lean(),
    ]);

    const rows = records.map((record) => {
      const quantity = normalizeNumber(record.quantity);
      const financials = calculateFinancials(record);
      const cost = quantity * normalizeNumber(record.vendorPrice);
      return {
        createdBy: String(record.createdBy || 'Unknown').trim() || 'Unknown',
        customer: record.customerName || '—',
        product: record.product || '—',
        quantity,
        revenue: financials.revenue,
        cost,
        profit: financials.margin,
        marginPercent: financials.revenue ? (financials.margin / financials.revenue) * 100 : 0,
      };
    });
    const searchValue = String(search || '').trim().toLowerCase();
    const searchedRows = searchValue ? rows.filter((row) => row.createdBy.toLowerCase().includes(searchValue) || row.customer.toLowerCase().includes(searchValue) || row.product.toLowerCase().includes(searchValue)) : rows;
    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit });
    const pagedRows = searchedRows.slice(skip, skip + limitNum);

    const unique = (values) => Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const createdDates = unique(optionRecords.map((record) => {
      if (!record.createdDate) return '';
      const date = new Date(record.createdDate);
      return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
    }));

    res.status(200).json({
      success: true,
      data: pagedRows,
      options: {
        createdBy: unique(employees.flatMap((employee) => [employee.employeeName, employee.fullName]).concat(optionRecords.map((record) => record.createdBy))),
        createdDates,
        customerNames: unique(customers.flatMap((customer) => [customer.companyName, customer.customerName]).concat(optionRecords.map((record) => record.customerName))),
        products: unique(optionRecords.map((record) => record.product)),
      },
      pagination: {
        total: searchedRows.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(searchedRows.length / limitNum)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
