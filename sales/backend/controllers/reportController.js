const OPF = require('../models/OPF');
const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const Contact = require('../models/Contact');
const Activity = require('../models/Activity');
const { DEFAULT_PAGE_SIZE, parsePagination, escapeRegex } = require('../utils/queryUtils');
const { buildReportOwnerScope, getManagedReportEmployees, resolveCreatorNames } = require('../utils/accessScope');
const XLSX = require('xlsx');

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

const rangeFromDates = (startDate = '', endDate = '') => {
  if (!startDate && !endDate) return null;
  const parseDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Report dates must use YYYY-MM-DD format.');
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      throw new Error('Report date range is invalid.');
    }
    return date;
  };
  const start = startDate ? parseDate(String(startDate)) : null;
  const end = endDate ? parseDate(String(endDate)) : null;
  if (start && end && start > end) throw new Error('Report start date must not be after end date.');
  if (end) end.setDate(end.getDate() + 1);
  return { ...(start ? { $gte: start } : {}), ...(end ? { $lt: end } : {}) };
};

const applyDateFilters = (query, { createdDate = '', startDate = '', endDate = '' } = {}) => {
  const ranges = [dateRange(createdDate), rangeFromDates(startDate, endDate)].filter(Boolean);
  if (!ranges.length) return;
  const lowerBounds = ranges.map((range) => range.$gte).filter(Boolean);
  const upperBounds = ranges.map((range) => range.$lt).filter(Boolean);
  const lower = lowerBounds.length ? new Date(Math.max(...lowerBounds.map((date) => date.getTime()))) : null;
  const upper = upperBounds.length ? new Date(Math.min(...upperBounds.map((date) => date.getTime()))) : null;
  if (lower && upper && lower >= upper) {
    query.createdDate = { $gte: lower, $lt: lower };
    return;
  }
  query.createdDate = { ...(lower ? { $gte: lower } : {}), ...(upper ? { $lt: upper } : {}) };
};

const buildOpfQuery = ({ createdBy = '', createdDate = '', customerName = '', product = '', startDate = '', endDate = '' } = {}) => {
  const query = {};
  if (createdBy && createdBy !== 'all') query.createdBy = new RegExp(`^${escapeRegex(createdBy)}$`, 'i');
  if (customerName && customerName !== 'all') query.customerName = new RegExp(`^${escapeRegex(customerName)}$`, 'i');
  if (product && product !== 'all') query.product = new RegExp(`^${escapeRegex(product)}$`, 'i');
  applyDateFilters(query, { createdDate, startDate, endDate });
  return query;
};

const buildLeadQuery = ({ createdBy = '', createdDate = '', customerName = '', product = '', startDate = '', endDate = '' } = {}) => {
  const query = {};
  if (createdBy && createdBy !== 'all') query.createdBy = new RegExp(`^${escapeRegex(createdBy)}$`, 'i');
  if (customerName && customerName !== 'all') query.companyName = new RegExp(`^${escapeRegex(customerName)}$`, 'i');
  if (product && product !== 'all') query['products.productName'] = new RegExp(`^${escapeRegex(product)}$`, 'i');
  applyDateFilters(query, { createdDate, startDate, endDate });
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

const reportOptions = async (opfRecords, req) => {
  const [customerScope, employeeRecords] = await Promise.all([
    buildReportOwnerScope(req, {
      extraClauses: req.user?.id ? [{ 'assignedEmployees.employeeId': String(req.user.id) }] : [],
    }),
    getManagedReportEmployees(req),
  ]);
  const customers = await Customer.find({ $and: [{}, customerScope] }).select('companyName customerName').sort({ companyName: 1 }).lean();
  const employeeNames = employeeRecords.flatMap((employee) => [employee.employeeName, employee.fullName]);
  return {
    createdBy: uniqueValues(employeeNames.concat(opfRecords.map((record) => record.createdBy))),
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
    const search = String(req.query.search || '').trim().toLowerCase();
    const sortBy = String(req.query.sortBy || '');
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const dateFilters = {
      createdDate,
      startDate: String(req.query.startDate || ''),
      endDate: String(req.query.endDate || ''),
    };
    if (reportKey === 'team-analysis') {
      return res.status(200).json({ success: true, data: [], unavailable: true, message: 'Team-level data is not available because this CRM has no Team entity.' });
    }

    const [scope, leadScope, customerScope, activityScope, contactScope] = await Promise.all([
      buildReportOwnerScope(req),
      buildReportOwnerScope(req, {
        extraClauses: [
          ...(req.user?.name ? [{ assignedTo: String(req.user.name) }] : []),
          ...(req.user?.id ? [{ assignedToId: String(req.user.id) }] : []),
        ],
      }),
      buildReportOwnerScope(req, {
        extraClauses: req.user?.id ? [{ 'assignedEmployees.employeeId': String(req.user.id) }] : [],
      }),
      buildReportOwnerScope(req, {
        extraClauses: [
          ...(req.user?.name ? [{ assignedUser: String(req.user.name) }] : []),
          ...(req.user?.id ? [{ assignedUserId: String(req.user.id) }] : []),
        ],
      }),
      buildReportOwnerScope(req),
    ]);
    const opfQuery = buildOpfQuery({ createdBy, customerName, product, ...dateFilters });
    const rawOpfRecords = await OPF.find({ $and: [opfQuery, scope] })
      .select('createdBy createdById createdDate customerName product quantity unitPrice vendorPrice revenue margin')
      .sort({ createdDate: -1 })
      .lean();
    const opfRecords = (await resolveCreatorNames(rawOpfRecords)).map(enrichOpfRecord);
    const options = await reportOptions(opfRecords, req);
    let rows;

    if (reportKey === 'top-customers') rows = aggregateBy(opfRecords, 'customerName', 'customer');
    else if (reportKey === 'top-employees') rows = aggregateBy(opfRecords, 'createdBy', 'employee');
    else if (reportKey === 'top-products' || reportKey === 'product-analysis') rows = aggregateBy(opfRecords, 'product', 'product');
    else if (reportKey === 'funnel-analysis') {
      const leads = await Lead.find({ $and: [buildLeadQuery({ createdBy, customerName, product, ...dateFilters }), leadScope] }).select('leadStatus products createdDate').lean();
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
      const usageDateQuery = {};
      applyDateFilters(usageDateQuery, dateFilters);
      const usageDate = usageDateQuery.createdDate;
      const usageCreatedBy = createdBy && createdBy !== 'all' ? new RegExp(`^${escapeRegex(createdBy)}$`, 'i') : undefined;
      const [employees, customerRecords, contactRecords, leadRecords, activityRecords] = await Promise.all([
        getManagedReportEmployees(req),
        Customer.find({ $and: [{ ...(usageCreatedBy ? { createdBy: usageCreatedBy } : {}), ...(usageDate ? { createdAt: usageDate } : {}) }, customerScope] }).select('createdBy createdById').lean(),
        Contact.find({ $and: [{ ...(usageCreatedBy ? { createdBy: usageCreatedBy } : {}), ...(usageDate ? { createdAt: usageDate } : {}) }, contactScope] }).select('createdBy createdById').lean(),
        Lead.find({ $and: [{ ...(usageCreatedBy ? { createdBy: usageCreatedBy } : {}), ...(usageDate ? { createdDate: usageDate } : {}) }, leadScope] }).select('createdBy createdById').lean(),
        Activity.find({ $and: [{ deletedAt: null, ...(usageCreatedBy ? { createdBy: usageCreatedBy } : {}), ...(usageDate ? { createdAt: usageDate } : {}) }, activityScope] }).select('createdBy createdById').lean(),
      ]);
      const [customers, contacts, leads, activities] = await Promise.all([
        resolveCreatorNames(customerRecords),
        resolveCreatorNames(contactRecords),
        resolveCreatorNames(leadRecords),
        resolveCreatorNames(activityRecords),
      ]);
      const names = uniqueValues(
        employees.flatMap((employee) => [employee.employeeName, employee.fullName])
          .concat(opfRecords.map((record) => record.createdBy))
      );
      rows = names.map((employee) => ({
        employee,
        customersCreated: customers.filter((item) => item.createdBy === employee).length,
        contactsCreated: contacts.filter((item) => item.createdBy === employee).length,
        quotations: leads.filter((item) => item.createdBy === employee).length,
        sales: opfRecords.filter((item) => item.createdBy === employee).length,
        activities: activities.filter((item) => item.createdBy === employee).length,
      }));
    } else {
      return res.status(400).json({ success: false, message: `Unknown report: ${reportKey}` });
    }

    if (search) {
      rows = rows.filter((row) => Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(search)));
    }
    if (sortBy && rows.length && Object.prototype.hasOwnProperty.call(rows[0], sortBy)) {
      rows = rows.sort((left, right) => {
        const a = left[sortBy];
        const b = right[sortBy];
        if (typeof a === 'number' && typeof b === 'number') return (a - b) * sortOrder;
        return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true }) * sortOrder;
      });
    } else {
      rows = rows.sort((a, b) => Number(b.revenue || b.profit || b.amount || b.count || 0) - Number(a.revenue || a.profit || a.amount || a.count || 0));
    }
    if (reportKey === 'top-customers' || reportKey === 'top-employees' || reportKey === 'top-products') {
      rows = rows.slice(0, 10).map((row, index) => ({ ...row, rank: index + 1 }));
    }
    if (req.query.format === 'xlsx') {
      const title = ({
        'top-customers': 'Top 10 Customers',
        'top-employees': 'Top 10 Employees',
        'top-products': 'Top 10 Products',
        'product-analysis': 'Product Analysis',
        'funnel-analysis': 'Funnel Analysis',
        usage: 'Usage Report',
        usages: 'Usage Report',
      })[reportKey] || 'Sales Report';
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet([
        [title],
        ['Created date range', dateFilters.startDate || dateFilters.createdDate || 'All', dateFilters.endDate || ''],
        [],
        ...[...new Set(rows.flatMap((row) => Object.keys(row)))].length
          ? [[...[...new Set(rows.flatMap((row) => Object.keys(row)))]]]
          : [['No authorized records for the selected filters.']],
        ...rows.map((row) => Object.values(row)),
      ]);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Report');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${reportKey}-report.xlsx"`);
      return res.status(200).send(buffer);
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
      startDate = '',
      endDate = '',
      sortBy = '',
      sortOrder = 'desc',
    } = req.query;

    const query = {};
    if (createdBy && createdBy !== 'all') query.createdBy = new RegExp(`^${escapeRegex(createdBy)}$`, 'i');
    if (customerName && customerName !== 'all') query.customerName = new RegExp(`^${escapeRegex(customerName)}$`, 'i');
    if (product && product !== 'all') query.product = new RegExp(`^${escapeRegex(product)}$`, 'i');
    applyDateFilters(query, { createdDate, startDate: String(startDate || ''), endDate: String(endDate || '') });

    const scope = await buildReportOwnerScope(req);
    const [customerScope, employees] = await Promise.all([
      buildReportOwnerScope(req, {
        extraClauses: req.user?.id ? [{ 'assignedEmployees.employeeId': String(req.user.id) }] : [],
      }),
      getManagedReportEmployees(req),
    ]);
    const [records, optionRecords, customers] = await Promise.all([
      OPF.find({ $and: [query, scope] })
        .select('createdBy createdById createdDate customerName product revenue margin quantity unitPrice vendorPrice')
        .sort({ createdBy: 1, createdDate: -1 })
        .lean(),
      OPF.find({ $and: [{}, scope] })
        .select('createdBy createdById createdDate customerName product')
        .sort({ createdBy: 1 })
        .lean(),
      Customer.find({ $and: [{}, customerScope] }).select('companyName customerName').sort({ companyName: 1 }).lean(),
    ]);

    const [resolvedRecords, resolvedOptionRecords] = await Promise.all([
      resolveCreatorNames(records),
      resolveCreatorNames(optionRecords),
    ]);
    const rows = resolvedRecords.map((record) => {
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
    const sortMultiplier = sortOrder === 'asc' ? 1 : -1;
    const allowedSortFields = ['createdBy', 'customer', 'product', 'quantity', 'revenue', 'cost', 'profit', 'marginPercent'];
    const sortedRows = allowedSortFields.includes(String(sortBy))
      ? searchedRows.sort((left, right) => {
        const a = left[sortBy];
        const b = right[sortBy];
        if (typeof a === 'number' && typeof b === 'number') return (a - b) * sortMultiplier;
        return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true }) * sortMultiplier;
      })
      : searchedRows;
    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit });
    const pagedRows = sortedRows.slice(skip, skip + limitNum);

    if (req.query.format === 'xlsx') {
      const workbook = XLSX.utils.book_new();
      const reportRows = sortedRows.map((row) => ({
        CreatedBy: row.createdBy,
        Customer: row.customer,
        Product: row.product,
        Quantity: row.quantity,
        Revenue: row.revenue,
        Cost: row.cost,
        Profit: row.profit,
        'Margin %': row.marginPercent,
      }));
      const sheet = XLSX.utils.aoa_to_sheet([
        ['Revenue & Margin Report'],
        ['Date range', startDate || createdDate || 'All', endDate || ''],
        [],
        ...reportRows.length ? [Object.keys(reportRows[0])] : [['No authorized records for the selected filters.']],
        ...reportRows.map((row) => Object.values(row)),
      ]);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Revenue & Margin');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="revenue-margin-report.xlsx"');
      return res.status(200).send(buffer);
    }

    const unique = (values) => Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const createdDates = unique(resolvedOptionRecords.map((record) => {
      if (!record.createdDate) return '';
      const date = new Date(record.createdDate);
      return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
    }));

    res.status(200).json({
      success: true,
      data: pagedRows,
      options: {
      createdBy: unique(employees.flatMap((employee) => [employee.employeeName, employee.fullName]).concat(resolvedOptionRecords.map((record) => record.createdBy))),
        createdDates,
        customerNames: unique(customers.flatMap((customer) => [customer.companyName, customer.customerName]).concat(resolvedOptionRecords.map((record) => record.customerName))),
        products: unique(resolvedOptionRecords.map((record) => record.product)),
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
