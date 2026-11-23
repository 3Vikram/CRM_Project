const Activity = require('../models/Activity');
const Customer = require('../models/Customer');
const CompanyProfile = require('../models/CompanyProfile');
const Lead = require('../models/Lead');
const OPF = require('../models/OPF');
const {
  hasReportFullAccess,
  buildReportOwnerScope,
  getManagedReportEmployees,
  resolveActivityEmployeeNames,
  resolveCreatorNames,
} = require('../utils/accessScope');
const { getEffectiveStatus, getTodayInKolkata } = require('../utils/activityStatus');
const XLSX = require('xlsx');

const DAY_MS = 24 * 60 * 60 * 1000;
const REPORT_TIME_ZONE = 'Asia/Kolkata';
const PERIODS = ['daily', 'weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly', 'custom'];
const normalizeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getDateRange = (query, now = new Date()) => {
  const period = String(query.period || 'monthly');
  if (!PERIODS.includes(period)) throw new Error('Unsupported reporting period.');

  if (period === 'custom') {
    const startValue = String(query.startDate || '');
    const endValue = String(query.endDate || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startValue) || !/^\d{4}-\d{2}-\d{2}$/.test(endValue)) {
      throw new Error('Custom reports require a valid start date and end date.');
    }
    const start = dateFromKey(startValue);
    const end = dateFromKey(endValue);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end
      || localDateKey(start) !== startValue || localDateKey(end) !== endValue) {
      throw new Error('Custom report dates are invalid.');
    }
    end.setUTCDate(end.getUTCDate() + 1);
    return { period, start, end };
  }

  const start = dateFromKey(kolkataDateKey(now));
  const end = new Date(start);
  if (period === 'daily') end.setUTCDate(end.getUTCDate() + 1);
  else if (period === 'weekly') {
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    end.setTime(start.getTime());
    end.setUTCDate(end.getUTCDate() + 7);
  } else if (period === 'monthly') {
    start.setUTCDate(1);
    end.setUTCFullYear(start.getUTCFullYear(), start.getUTCMonth() + 1, 1);
  } else if (period === 'quarterly') {
    start.setUTCMonth(Math.floor(start.getUTCMonth() / 3) * 3, 1);
    end.setUTCFullYear(start.getUTCFullYear(), start.getUTCMonth() + 3, 1);
  } else if (period === 'half-yearly') {
    start.setUTCMonth(start.getUTCMonth() < 6 ? 0 : 6, 1);
    end.setUTCFullYear(start.getUTCFullYear(), start.getUTCMonth() + 6, 1);
  } else if (period === 'yearly') {
    start.setUTCMonth(0, 1);
    end.setUTCFullYear(start.getUTCFullYear() + 1, 0, 1);
  }
  return { period, start, end };
};

const getComparisonRange = (range) => {
  const end = new Date(range.start);
  const start = new Date(range.start);
  if (range.period === 'daily') start.setUTCDate(start.getUTCDate() - 1);
  else if (range.period === 'weekly') start.setUTCDate(start.getUTCDate() - 7);
  else if (range.period === 'monthly') start.setUTCMonth(start.getUTCMonth() - 1);
  else if (range.period === 'quarterly') start.setUTCMonth(start.getUTCMonth() - 3);
  else if (range.period === 'half-yearly') start.setUTCMonth(start.getUTCMonth() - 6);
  else if (range.period === 'yearly') start.setUTCFullYear(start.getUTCFullYear() - 1);
  else {
    const days = Math.round((
      Date.UTC(range.end.getUTCFullYear(), range.end.getUTCMonth(), range.end.getUTCDate())
      - Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), range.start.getUTCDate())
    ) / DAY_MS);
    start.setUTCDate(start.getUTCDate() - days);
  }
  return { period: range.period, start, end };
};

const parseRecordDate = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return dateFromKey(value);
  }
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? null : dateFromKey(kolkataDateKey(date));
};
const recordDate = (record, field = 'createdDate') => {
  return parseRecordDate(record[field] ?? (field === 'createdDate' ? record.createdAt : undefined));
};
const isInRange = (record, range, field) => {
  const date = recordDate(record, field);
  return Boolean(date && date >= range.start && date < range.end);
};
const isQuotation = (lead) => Boolean(lead.quotationId || lead.leadStatus === 'Proposal Sent');
const getRevenue = (opf) => opf.revenue !== undefined && opf.revenue !== null && opf.revenue !== ''
  ? normalizeNumber(opf.revenue)
  : normalizeNumber(opf.quantity) * normalizeNumber(opf.unitPrice)
    + normalizeNumber(opf.serviceCost) + normalizeNumber(opf.freightCost);
const getMargin = (opf) => opf.margin !== undefined && opf.margin !== null && opf.margin !== ''
  ? normalizeNumber(opf.margin)
  : getRevenue(opf) - normalizeNumber(opf.quantity) * normalizeNumber(opf.vendorPrice)
    - normalizeNumber(opf.serviceCost) - normalizeNumber(opf.freightCost);
const groupRevenue = (records, field, key) => {
  const groups = new Map();
  records.forEach((record) => {
    const label = String(record[field] || 'Not recorded').trim() || 'Not recorded';
    const current = groups.get(label) || { [key]: label, revenue: 0, deals: 0 };
    current.revenue += getRevenue(record);
    current.deals += 1;
    groups.set(label, current);
  });
  return Array.from(groups.values()).sort((left, right) => right.revenue - left.revenue);
};
const localDateKey = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
const dateFromKey = (dateKey) => {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};
const kolkataDateKey = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const monthKey = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
const quarterKey = (date) => `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
const buildSeries = (records, range, granularity) => {
  const grouped = new Map();
  records.forEach((record) => {
    const date = recordDate(record);
    if (!date) return;
    const key = granularity === 'day' ? localDateKey(date) : granularity === 'quarter' ? quarterKey(date) : monthKey(date);
    grouped.set(key, (grouped.get(key) || 0) + getRevenue(record));
  });

  const result = [];
  const cursor = new Date(range.start);
  if (granularity === 'day') {
    while (cursor < range.end) {
      const key = localDateKey(cursor);
      result.push({ label: key, revenue: grouped.get(key) || 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else if (granularity === 'quarter') {
    cursor.setUTCMonth(Math.floor(cursor.getUTCMonth() / 3) * 3, 1);
    while (cursor < range.end) {
      const key = quarterKey(cursor);
      result.push({ label: key, revenue: grouped.get(key) || 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 3);
    }
  } else {
    cursor.setUTCDate(1);
    while (cursor < range.end) {
      const key = monthKey(cursor);
      result.push({ label: key, revenue: grouped.get(key) || 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  return result;
};

const buildActivityHeatmap = (activityCounts, range) => {
  if ((range.end.getTime() - range.start.getTime()) / DAY_MS > 366) {
    return Array.from(activityCounts, ([date, count]) => ({ date, count }))
      .sort((left, right) => left.date.localeCompare(right.date));
  }
  const entries = [];
  const cursor = new Date(range.start);
  while (cursor < range.end) {
    const date = localDateKey(cursor);
    entries.push({ date, count: activityCounts.get(date) || 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return entries;
};

const buildCountSeries = (records, range, granularity, field = 'createdDate') => {
  const grouped = new Map();
  records.forEach((record) => {
    const date = recordDate(record, field);
    if (!date) return;
    const key = granularity === 'day' ? localDateKey(date) : monthKey(date);
    grouped.set(key, (grouped.get(key) || 0) + 1);
  });

  const result = [];
  const cursor = new Date(range.start);
  if (granularity === 'day') {
    while (cursor < range.end) {
      const key = localDateKey(cursor);
      result.push({ label: key, count: grouped.get(key) || 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else {
    cursor.setUTCDate(1);
    while (cursor < range.end) {
      const key = monthKey(cursor);
      result.push({ label: key, count: grouped.get(key) || 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  return result;
};

const buildFinancialSeries = (records, range) => {
  const grouped = new Map();
  records.forEach((record) => {
    const date = recordDate(record);
    if (!date) return;
    const key = monthKey(date);
    const current = grouped.get(key) || { revenue: 0, margin: 0 };
    current.revenue += getRevenue(record);
    current.margin += getMargin(record);
    grouped.set(key, current);
  });

  const result = [];
  const cursor = new Date(range.start);
  cursor.setUTCDate(1);
  while (cursor < range.end) {
    const label = monthKey(cursor);
    const totals = grouped.get(label) || { revenue: 0, margin: 0 };
    result.push({ label, ...totals });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
};

const buildProductSeries = (records, range) => {
  const topProducts = groupRevenue(records, 'product', 'product').slice(0, 5).map((row) => row.product);
  const months = buildSeries(records, range, 'month').map((row) => row.label);
  return topProducts.map((product) => ({
    product,
    values: months.map((label) => {
      const monthRecords = records.filter((record) => {
        const date = recordDate(record);
        const recordProduct = String(record.product || 'Not recorded').trim() || 'Not recorded';
        return recordProduct === product && date && monthKey(date) === label;
      });
      return { label, revenue: monthRecords.reduce((sum, record) => sum + getRevenue(record), 0) };
    }),
  }));
};

const percentageChange = (current, previous) => previous
  ? ((current - previous) / Math.abs(previous)) * 100
  : null;

const countActivitiesByStatus = (records, today) => {
  const counts = new Map();
  records.forEach((activity) => {
    const effectiveStatus = getEffectiveStatus(activity, today);
    const key = effectiveStatus.startsWith('Overdue - ') ? 'Overdue' : effectiveStatus;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts, ([status, count]) => ({ status, count }));
};

const getAnalyticsData = async (req) => {
  const range = getDateRange(req.query);
  const comparisonRange = getComparisonRange(range);
  const fullAccess = hasReportFullAccess(req.user);
  const [leadScope, customerScope, activityScope, employees] = await Promise.all([
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
    getManagedReportEmployees(req),
  ]);

  const [leadsRaw, activities, customers, companyProfile] = await Promise.all([
    Lead.find(leadScope).select('quotationId leadStatus createdDate createdAt createdBy createdById assignedTo assignedToId quotationDetails products isConverted source sourceOfLead').lean(),
    Activity.find({ $and: [{ deletedAt: null }, activityScope] }).select('activityDate followUpDate activityType status assignedUser assignedUserId createdAt createdBy createdById').lean(),
    Customer.find(customerScope).select('createdAt status accountType').lean(),
    CompanyProfile.findOne({}).select('companyName').lean(),
  ]);
  const quotationReferences = Array.from(new Set(leadsRaw.flatMap((lead) => [
    String(lead.quotationId || '').trim(),
    String(lead.leadId || '').trim(),
  ]).filter(Boolean)));
  const customerIds = customers.map((customer) => String(customer._id || '').trim()).filter(Boolean);
  const opfClauses = [
    ...(quotationReferences.length ? [{ $or: [
      { quotationId: { $in: quotationReferences } },
      { quotationNumber: { $in: quotationReferences } },
    ] }] : []),
    ...(customerIds.length ? [{ customerId: { $in: customerIds } }] : []),
  ];
  const opfScope = await buildReportOwnerScope(req, { extraClauses: opfClauses });
  const opfsRaw = await OPF.find(opfScope)
    .select('createdBy createdById createdDate createdAt quotationNumber quotationId customerId customerName product quantity unitPrice vendorPrice revenue margin serviceCost freightCost')
    .lean();
  const [leads, opfs, resolvedActivities] = await Promise.all([
    resolveCreatorNames(leadsRaw),
    resolveCreatorNames(opfsRaw),
    resolveActivityEmployeeNames(activities),
  ]);
  const scopedActivities = resolvedActivities;
  const rangeLeads = leads.filter((lead) => isInRange(lead, range));
  const pipelineLeads = leads.filter((lead) => {
    const date = recordDate(lead);
    return date && date < range.end;
  });
  const pipelineOpportunities = pipelineLeads.filter((lead) => !isQuotation(lead));
  const rangeOPFs = opfs.filter((opf) => isInRange(opf, range));
  const leadsByQuotationReference = new Map();
  leads.forEach((lead) => {
    [lead.quotationId, lead.leadId].map((value) => String(value || '').trim()).filter(Boolean)
      .forEach((reference) => leadsByQuotationReference.set(reference, lead));
  });
  const rangeOPFsWithSalesOwner = rangeOPFs.map((opf) => {
    const reference = String(opf.quotationNumber || opf.quotationId || '').trim();
    const quotation = leadsByQuotationReference.get(reference);
    return {
      ...opf,
      reportEmployee: quotation?.assignedTo || opf.createdBy,
      reportEmployeeId: quotation?.assignedToId || opf.createdById,
    };
  });
  const rangeActivities = scopedActivities.filter((activity) => isInRange(activity, range, 'activityDate'));
  const rangeFollowUps = scopedActivities.filter((activity) => isInRange(activity, range, 'followUpDate'));
  const followUpActivityById = new Map();
  [...rangeActivities, ...rangeFollowUps].forEach((activity) => {
    const key = activity._id || activity.activityId || activity;
    if (!followUpActivityById.has(key)) followUpActivityById.set(key, activity);
  });
  const periodFollowUpActivities = Array.from(followUpActivityById.values());
  const priorLeads = leads.filter((lead) => isInRange(lead, comparisonRange));
  const priorOPFs = opfs.filter((opf) => isInRange(opf, comparisonRange));
  const priorActivities = scopedActivities.filter((activity) => isInRange(activity, comparisonRange, 'activityDate'));
  const priorFollowUps = scopedActivities.filter((activity) => isInRange(activity, comparisonRange, 'followUpDate'));
  const priorCustomers = customers.filter((customer) => {
    const date = recordDate(customer, 'createdAt');
    return date && date < comparisonRange.end;
  });
  const customersAsOfPeriodEnd = customers.filter((customer) => {
    const date = recordDate(customer, 'createdAt');
    return date && date < range.end;
  });
  const opportunities = rangeLeads.filter((lead) => !isQuotation(lead));
  const convertedLeads = opportunities.filter((lead) => lead.isConverted || lead.leadStatus === 'Won');
  const quotations = rangeLeads.filter(isQuotation);
  const wonDeals = rangeLeads.filter((lead) => lead.leadStatus === 'Won');
  const lostDeals = rangeLeads.filter((lead) => lead.leadStatus === 'Lost');
  const pendingQuotations = quotations.filter((lead) => !['Won', 'Lost', 'Scrapped'].includes(lead.leadStatus || ''));
  const revenue = rangeOPFs.reduce((sum, opf) => sum + getRevenue(opf), 0);
  const wonAndLost = wonDeals.length + lostDeals.length;
  const activityCounts = new Map();
  const today = getTodayInKolkata();
  rangeActivities.forEach((activity) => {
    const activityDate = recordDate(activity, 'activityDate');
    if (activityDate) {
      const key = localDateKey(activityDate);
      activityCounts.set(key, (activityCounts.get(key) || 0) + 1);
    }
  });

  const chartGranularity = ['daily', 'weekly'].includes(range.period) ? 'day' : 'month';
  const revenueTrend = buildSeries(rangeOPFs, range, chartGranularity);
  const quarterlyRevenue = buildSeries(rangeOPFs, range, 'quarter');
  const funnel = ['New', 'Contacted', 'Follow-up', 'Interested', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Scrapped']
    .map((stage) => ({ stage, count: pipelineLeads.filter((lead) => lead.leadStatus === stage).length }))
    .filter((row) => row.count > 0);
  const leadStatus = Array.from(pipelineLeads.reduce((counts, lead) => {
    const status = String(lead.leadStatus || 'Not recorded').trim() || 'Not recorded';
    counts.set(status, (counts.get(status) || 0) + 1);
    return counts;
  }, new Map()), ([status, count]) => ({ status, count }));
  const leadSources = Array.from(pipelineOpportunities.reduce((counts, lead) => {
    const source = String(lead.sourceOfLead || lead.source || 'Not recorded').trim() || 'Not recorded';
    counts.set(source, (counts.get(source) || 0) + 1);
    return counts;
  }, new Map()), ([source, count]) => ({ source, count })).sort((left, right) => right.count - left.count);
  const employeeRevenue = groupRevenue(rangeOPFsWithSalesOwner, 'reportEmployee', 'employee');
  const customerRevenue = groupRevenue(rangeOPFs, 'customerName', 'customer').slice(0, 10);
  const productRevenue = groupRevenue(rangeOPFs, 'product', 'product').slice(0, 10);
  const productQuantity = new Map();
  rangeOPFs.forEach((opf) => {
    const product = String(opf.product || 'Not recorded').trim() || 'Not recorded';
    productQuantity.set(product, (productQuantity.get(product) || 0) + normalizeNumber(opf.quantity));
  });
  const productQuantities = Array.from(productQuantity, ([product, quantity]) => ({ product, quantity }))
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 10);
  const productQuotationDemand = new Map();
  quotations.forEach((lead) => {
    (Array.isArray(lead.products) ? lead.products : []).forEach((item) => {
      const product = String(item?.productName || item?.product || item?.name || '').trim();
      if (!product) return;
      productQuotationDemand.set(product, (productQuotationDemand.get(product) || 0) + normalizeNumber(item.quantity || 1));
    });
  });
  const productQuotationCounts = Array.from(productQuotationDemand, ([product, quantity]) => ({ product, quantity }))
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 10);
  const quotationsByCustomer = Array.from(quotations.reduce((counts, lead) => {
    const customer = String(lead.companyName || 'Not recorded').trim() || 'Not recorded';
    const key = customer.toLowerCase();
    const current = counts.get(key) || { customer, quotations: 0 };
    current.quotations += 1;
    counts.set(key, current);
    return counts;
  }, new Map()).values()).sort((left, right) => right.quotations - left.quotations).slice(0, 10);

  const employeeById = new Map();
  const employeeLabels = new Map();
  employees.forEach((employee) => {
    const id = String(employee._id || '').trim();
    const name = String(employee.employeeName || employee.fullName || '').trim();
    if (id && name) employeeById.set(id, name);
    if (name) employeeLabels.set(name.toLowerCase(), name);
  });
  const ensureEmployee = (idValue, nameValue) => {
    const id = String(idValue || '').trim();
    const name = String(nameValue || '').trim();
    const resolved = (id && employeeById.get(id)) || name || (id && (fullAccess ? id : 'Assigned employee'));
    if (!resolved) return 'Unassigned';
    const canonicalName = employeeLabels.get(resolved.toLowerCase()) || resolved;
    employeeLabels.set(canonicalName.toLowerCase(), canonicalName);
    return canonicalName;
  };
  const employeeMetrics = new Map();
  const getEmployeeMetric = (employee) => {
    const key = employee.toLowerCase();
    if (!employeeMetrics.has(key)) {
      employeeMetrics.set(key, {
        employee,
        revenue: 0,
        deals: 0,
        leadsAssigned: 0,
        leadsConverted: 0,
        activitiesCompleted: 0,
      });
    }
    return employeeMetrics.get(key);
  };
  employees.forEach((employee) => {
    const name = String(employee.employeeName || employee.fullName || '').trim();
    if (name) getEmployeeMetric(name);
  });
  employeeRevenue.forEach((row) => {
    const name = ensureEmployee('', row.employee);
    const metric = getEmployeeMetric(name);
    metric.revenue += row.revenue;
    metric.deals += row.deals;
  });
  opportunities.forEach((lead) => {
    const employee = ensureEmployee(lead.assignedToId, lead.assignedTo);
    const metric = getEmployeeMetric(employee);
    metric.leadsAssigned += 1;
    if (!isQuotation(lead) && (lead.isConverted || lead.leadStatus === 'Won')) {
      metric.leadsConverted += 1;
    }
  });
  rangeActivities.forEach((activity) => {
    if (getEffectiveStatus(activity, today) !== 'Completed') return;
    const employee = ensureEmployee(activity.assignedUserId, activity.assignedUser || activity.createdBy);
    getEmployeeMetric(employee).activitiesCompleted += 1;
  });
  const employeePerformance = Array.from(employeeMetrics.values())
    .sort((left, right) => right.revenue - left.revenue || right.leadsAssigned - left.leadsAssigned)
    .slice(0, 10);
  const leadsAssignedByEmployee = employeePerformance
    .filter((row) => row.leadsAssigned > 0)
    .map(({ employee, leadsAssigned: count }) => ({ employee, count }))
    .sort((left, right) => right.count - left.count);
  const leadsConvertedByEmployee = employeePerformance
    .filter((row) => row.leadsConverted > 0)
    .map(({ employee, leadsConverted: count }) => ({ employee, count }))
    .sort((left, right) => right.count - left.count);
  const completedActivitiesByEmployee = employeePerformance
    .filter((row) => row.activitiesCompleted > 0)
    .map(({ employee, activitiesCompleted: count }) => ({ employee, count }))
    .sort((left, right) => right.count - left.count);
  const employeeBreakdown = employeeRevenue;
  const customerBreakdown = groupRevenue(rangeOPFs, 'customerName', 'customer');
  const productBreakdown = groupRevenue(rangeOPFs, 'product', 'product');
  const dealTarget = null;
  const periodLabel = `${localDateKey(range.start)} – ${localDateKey(new Date(range.end.getTime() - DAY_MS))}`;

  const previousOpportunities = priorLeads.filter((lead) => !isQuotation(lead));
  const previousQuotations = priorLeads.filter(isQuotation);
  const previousWon = priorLeads.filter((lead) => lead.leadStatus === 'Won').length;
  const previousLost = priorLeads.filter((lead) => lead.leadStatus === 'Lost').length;
  const previousDecided = previousWon + previousLost;
  const previousRevenue = priorOPFs.reduce((sum, opf) => sum + getRevenue(opf), 0);
  const previousMargin = priorOPFs.reduce((sum, opf) => sum + getMargin(opf), 0);
  const pendingFollowUpStatuses = new Set(['Follow-Up Required', 'Awaiting Client', 'Rescheduled / No-Show', 'Follow-Up Today']);
  const pendingFollowUps = periodFollowUpActivities.filter((activity) => {
    const status = getEffectiveStatus(activity, today);
    return pendingFollowUpStatuses.has(status) || status.startsWith('Overdue - ');
  });
  const overdueActivities = periodFollowUpActivities.filter((activity) => getEffectiveStatus(activity, today).startsWith('Overdue - '));
  const priorActivityById = new Map();
  [...priorActivities, ...priorFollowUps].forEach((activity) => {
    const key = activity._id || activity.activityId || activity;
    if (!priorActivityById.has(key)) priorActivityById.set(key, activity);
  });
  const priorFollowUpActivities = Array.from(priorActivityById.values());
  const previousPendingFollowUps = priorFollowUpActivities.filter((activity) => {
    const status = getEffectiveStatus(activity, today);
    return pendingFollowUpStatuses.has(status) || status.startsWith('Overdue - ');
  });
  const followUpOverdue = [
    { label: 'Pending follow-ups', count: pendingFollowUps.length },
    { label: 'Overdue activities', count: overdueActivities.length },
  ];
  const leadConversion = [
    { status: 'Converted', count: pipelineOpportunities.filter((lead) => lead.isConverted || lead.leadStatus === 'Won').length },
    { status: 'Pending', count: pipelineOpportunities.filter((lead) => !lead.isConverted && !['Won', 'Lost', 'Scrapped'].includes(lead.leadStatus || '')).length },
    { status: 'Closed - Lost', count: pipelineOpportunities.filter((lead) => lead.leadStatus === 'Lost' || lead.leadStatus === 'Scrapped').length },
  ].filter((row) => row.count > 0);
  const decidedQuotations = quotations.filter((lead) => ['Won', 'Lost'].includes(lead.leadStatus || ''));
  const customerStatus = ['Active', 'Inactive'].map((status) => ({
    status,
    count: customersAsOfPeriodEnd.filter((customer) => customer.status === status).length,
  }));
  const customerDistribution = Array.from(customersAsOfPeriodEnd.reduce((counts, customer) => {
    const accountType = String(customer.accountType || 'Not recorded').trim() || 'Not recorded';
    counts.set(accountType, (counts.get(accountType) || 0) + 1);
    return counts;
  }, new Map()), ([accountType, count]) => ({ accountType, count })).sort((left, right) => right.count - left.count);
  const quotationStatus = ['Draft', 'Sent', 'Approved', 'Rejected'].map((status) => ({
    status,
    count: quotations.filter((lead) => {
      const leadStatus = String(lead.leadStatus || '');
      if (status === 'Draft') return ['New', 'Contacted', 'Follow-up', 'Interested', 'Qualified'].includes(leadStatus);
      if (status === 'Sent') return leadStatus === 'Proposal Sent';
      if (status === 'Approved') return leadStatus === 'Won';
      return leadStatus === 'Lost';
    }).length,
  }));
  const activityByType = Array.from(rangeActivities.reduce((counts, activity) => {
    const type = String(activity.activityType || 'Not recorded').trim() || 'Not recorded';
    counts.set(type, (counts.get(type) || 0) + 1);
    return counts;
  }, new Map()), ([type, count]) => ({ type, count }));
  const activityCompletion = [
    { status: 'Completed', count: rangeActivities.filter((activity) => getEffectiveStatus(activity, today) === 'Completed').length },
    { status: 'Pending', count: rangeActivities.filter((activity) => !['Completed', 'Cancelled'].includes(getEffectiveStatus(activity, today))).length },
    { status: 'Cancelled', count: rangeActivities.filter((activity) => getEffectiveStatus(activity, today) === 'Cancelled').length },
  ].filter((row) => row.count > 0);
  const activityByEmployee = Array.from(rangeActivities.reduce((counts, activity) => {
    const employee = String(activity.assignedUser || activity.createdBy || 'Not recorded').trim() || 'Not recorded';
    counts.set(employee, (counts.get(employee) || 0) + 1);
    return counts;
  }, new Map()), ([employee, count]) => ({ employee, count })).sort((left, right) => right.count - left.count).slice(0, 10);
  const employeeQuotationCounts = new Map();
  quotations.forEach((lead) => {
    const employee = String(lead.createdBy || lead.assignedTo || 'Not recorded').trim() || 'Not recorded';
    const current = employeeQuotationCounts.get(employee) || { employee, quotations: 0, won: 0 };
    current.quotations += 1;
    if (lead.leadStatus === 'Won') current.won += 1;
    employeeQuotationCounts.set(employee, current);
  });
  const employeeQuotations = Array.from(employeeQuotationCounts.values()).sort((left, right) => right.quotations - left.quotations).slice(0, 10);
  const activityGranularity = ['daily', 'weekly'].includes(range.period) ? 'day' : 'month';

  return {
    companyName: String(companyProfile?.companyName || 'Company').trim(),
    period: range.period,
    periodLabel,
    comparison: {
      periodLabel: `${localDateKey(comparisonRange.start)} – ${localDateKey(new Date(comparisonRange.end.getTime() - DAY_MS))}`,
      totalRevenue: priorOPFs.reduce((sum, opf) => sum + getRevenue(opf), 0),
      totalMargin: previousMargin,
      totalDeals: priorLeads.length,
      totalQuotations: previousQuotations.length,
      totalLeads: previousOpportunities.length,
      convertedLeads: priorLeads.filter((lead) => !isQuotation(lead) && (lead.isConverted || lead.leadStatus === 'Won')).length,
      pendingQuotations: previousQuotations.filter((lead) => !['Won', 'Lost', 'Scrapped'].includes(lead.leadStatus || '')).length,
      wonDeals: previousWon,
      lostDeals: previousLost,
      conversionRate: previousDecided ? (previousWon / previousDecided) * 100 : 0,
      customers: priorCustomers.length,
      activities: priorActivities.length,
      orders: priorOPFs.length,
      pendingFollowUps: previousPendingFollowUps.length,
    },
    generatedAt: new Date().toISOString(),
    kpis: {
      totalRevenue: revenue,
      totalDeals: rangeLeads.length,
      totalLeads: opportunities.length,
      convertedLeads: convertedLeads.length,
      totalQuotations: quotations.length,
      conversionRate: wonAndLost ? (wonDeals.length / wonAndLost) * 100 : 0,
      quotationConversionRate: decidedQuotations.length
        ? (decidedQuotations.filter((lead) => lead.leadStatus === 'Won').length / decidedQuotations.length) * 100
        : 0,
      pendingQuotations: pendingQuotations.length,
      wonDeals: wonDeals.length,
      lostDeals: lostDeals.length,
      orders: rangeOPFs.length,
      totalMargin: rangeOPFs.reduce((sum, opf) => sum + getMargin(opf), 0),
      customers: customersAsOfPeriodEnd.length,
      activities: rangeActivities.length,
      opportunities: opportunities.length,
      pendingFollowUps: pendingFollowUps.length,
    },
    changes: {
      totalRevenue: percentageChange(revenue, previousRevenue),
      totalMargin: percentageChange(rangeOPFs.reduce((sum, opf) => sum + getMargin(opf), 0), previousMargin),
      totalQuotations: percentageChange(quotations.length, previousQuotations.length),
      customers: percentageChange(customersAsOfPeriodEnd.length, priorCustomers.length),
      activities: percentageChange(rangeActivities.length, priorActivities.length),
      opportunities: percentageChange(opportunities.length, previousOpportunities.length),
      convertedLeads: percentageChange(
        convertedLeads.length,
        priorLeads.filter((lead) => !isQuotation(lead) && (lead.isConverted || lead.leadStatus === 'Won')).length,
      ),
      conversionRate: previousDecided ? (wonAndLost ? (wonDeals.length / wonAndLost) * 100 : 0) - ((previousWon / previousDecided) * 100) : null,
      orders: percentageChange(rangeOPFs.length, priorOPFs.length),
      pendingFollowUps: percentageChange(pendingFollowUps.length, previousPendingFollowUps.length),
    },
    charts: {
      revenueTrend,
      monthlyRevenue: buildSeries(rangeOPFs, range, 'month'),
      revenueMarginByMonth: buildFinancialSeries(rangeOPFs, range),
      quarterlyRevenue,
      funnel,
      leadConversion,
      leadStatus,
      leadSources,
      customerRevenue,
      customerDistribution,
      customerStatus,
      quotationsByCustomer,
      employeeRevenue: employeeRevenue.slice(0, 10),
      employeePerformance,
      leadsAssignedByEmployee,
      leadsConvertedByEmployee,
      completedActivitiesByEmployee,
      targetAchievement: { target: dealTarget, achieved: revenue, percentage: null },
      productRevenue,
      productQuantities,
      productQuotationCounts,
      productTrend: buildProductSeries(rangeOPFs, range),
      customerAcquisition: buildCountSeries(customers.filter((customer) => isInRange(customer, range, 'createdAt')), range, activityGranularity, 'createdAt'),
      quotationTrend: buildCountSeries(quotations, range, activityGranularity),
      quotationStatus,
      activityByType,
      activityCompletion,
      activityByEmployee,
      activityByStatus: countActivitiesByStatus(rangeActivities, today),
      followUpOverdue,
      activityTrend: buildCountSeries(rangeActivities, range, activityGranularity, 'activityDate'),
      employeeQuotations,
      upcomingFollowUps: periodFollowUpActivities
        .filter((activity) => {
          const status = getEffectiveStatus(activity, today);
          return activity.followUpDate > today
            && !['Completed', 'Cancelled'].includes(status);
        })
        .sort((left, right) => String(left.followUpDate).localeCompare(String(right.followUpDate)))
        .slice(0, 8)
        .map((activity) => ({
          customer: String(activity.customerName || 'Not recorded'),
          employee: String(activity.assignedUser || activity.createdBy || 'Not recorded'),
          followUpDate: String(activity.followUpDate),
          status: getEffectiveStatus(activity, today),
        })),
      expectedRevenueByStage: [],
      activityHeatmap: buildActivityHeatmap(activityCounts, range),
    },
    breakdown: {
      revenue: rangeOPFsWithSalesOwner.map((opf) => ({
        employee: String(opf.reportEmployee || 'Not recorded'),
        customer: String(opf.customerName || 'Not recorded'),
        product: String(opf.product || 'Not recorded'),
        revenue: getRevenue(opf),
        margin: getMargin(opf),
        date: recordDate(opf) ? localDateKey(recordDate(opf)) : '',
      })),
      employees: employeeBreakdown,
      customers: customerBreakdown,
      products: productBreakdown,
      funnel,
    },
  };
};

const handleRequestError = (res, error) => {
  if (/report|custom/i.test(error.message)) {
    return res.status(400).json({ success: false, message: error.message });
  }
  console.error('Sales analytics request failed:', error);
  return res.status(500).json({ success: false, message: 'Unable to load Sales analytics.' });
};

exports.getAnalytics = async (req, res) => {
  try {
    const data = await getAnalyticsData(req);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleRequestError(res, error);
  }
};

exports.exportAnalytics = async (req, res) => {
  try {
    const data = await getAnalyticsData(req);
    const workbook = XLSX.utils.book_new();
    const summary = [
      [`${data.companyName} Sales Analytics Report`],
      ['Reporting period', data.periodLabel],
      ['Generated', new Date(data.generatedAt).toLocaleString('en-IN', { timeZone: REPORT_TIME_ZONE })],
      [],
      ['Metric', 'Value'],
      ['Total Revenue', data.kpis.totalRevenue],
      ['Total Deals', data.kpis.totalDeals],
      ['Total Leads', data.kpis.totalLeads],
      ['Converted Leads', data.kpis.convertedLeads],
      ['Total Quotations', data.kpis.totalQuotations],
      ['Conversion Rate (%)', data.kpis.conversionRate],
      ['Pending Quotations', data.kpis.pendingQuotations],
      ['Won Deals', data.kpis.wonDeals],
      ['Lost Deals', data.kpis.lostDeals],
      ['Orders / Won Deals', data.kpis.orders],
      ['Total Margin', data.kpis.totalMargin],
      ['Total Customers as of period end', data.kpis.customers],
      ['Sales Activities', data.kpis.activities],
      ['Funnel Opportunities', data.kpis.opportunities],
      ['Pending Follow-ups', data.kpis.pendingFollowUps],
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summary), 'Summary');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.breakdown.revenue), 'Revenue Breakdown');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.breakdown.funnel), 'Sales Funnel');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.charts.leadConversion), 'Lead Conversion');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.charts.leadSources), 'Lead Sources');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.charts.revenueTrend), 'Revenue Trend');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.charts.revenueMarginByMonth), 'Revenue and Margin');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.charts.productTrend.flatMap((row) => row.values.map((value) => ({ product: row.product, ...value })))), 'Product Trend');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.breakdown.customers), 'Customer Breakdown');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.breakdown.employees), 'Employee Breakdown');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.charts.employeePerformance), 'Employee Performance');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.charts.leadsAssignedByEmployee), 'Leads Assigned');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.charts.leadsConvertedByEmployee), 'Leads Converted');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.charts.completedActivitiesByEmployee), 'Activities Completed');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.breakdown.products), 'Product Breakdown');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.charts.productQuotationCounts), 'Products in Quotations');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.charts.customerAcquisition), 'Customer Acquisition');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.charts.customerDistribution), 'Customer Distribution');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.charts.quotationsByCustomer), 'Quotations by Customer');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.charts.quotationStatus), 'Quotation Status');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.charts.activityByType), 'Activity Types');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.charts.activityByStatus), 'Activity Status');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.charts.activityCompletion), 'Activity Completion');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.charts.upcomingFollowUps), 'Upcoming Follow-ups');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="sales-analytics.xlsx"');
    return res.status(200).send(buffer);
  } catch (error) {
    return handleRequestError(res, error);
  }
};

const sanitizeAssistantError = (error) => String(error?.message || error || 'Unknown error')
  .replace(/mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi, '[MongoDB URI]')
  .replace(/(authorization\s*:\s*bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
  .replace(/((?:api[_-]?key|token|password|secret)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
  .replace(/_mongodb\._tcp\.[^\s]+/gi, 'MongoDB SRV host')
  .replace(/[\r\n\t]+/g, ' ')
  .slice(0, 500);

const getAssistantFailure = (phase, error) => {
  const code = String(error?.code || error?.cause?.code || '').toUpperCase();
  const detail = sanitizeAssistantError(error);
  if (phase === 'sales-data') {
    if (/querysrv/i.test(detail)) {
      return {
        status: 503,
        message: 'Unable to retrieve authorized Sales data: MongoDB SRV DNS lookup failed. Check backend DNS/network access to the configured MongoDB cluster.',
      };
    }
    return {
      status: 503,
      message: `Unable to retrieve authorized Sales data from MongoDB: ${detail}`,
    };
  }
  if (phase === 'ai-provider') {
    if (['AbortError', 'TimeoutError'].includes(String(error?.name || ''))) {
      return {
        status: 504,
        message: 'The Sales AI service timed out. Check that the configured model is loaded and can answer requests.',
      };
    }
    if (['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EHOSTUNREACH'].includes(code)) {
      return {
        status: 503,
        message: `The configured local Sales AI service is unavailable (${code}). Start the inference service and verify SALES_AI_BASE_URL and SALES_AI_MODEL.`,
      };
    }
    if (code === 'ETIMEDOUT' || /timed?\s*out|timeout/i.test(detail)) {
      return {
        status: 504,
        message: 'The Sales AI service timed out. Check that the configured model is loaded and can answer requests.',
      };
    }
    return {
      status: 502,
      message: `Sales AI request failed: ${detail}`,
    };
  }
  return {
    status: 503,
    message: `Sales AI configuration failed: ${detail}`,
  };
};

// Compact summary sent to the local model so it reads far fewer tokens (keeps CPU-only answers fast).
const buildCompactAnalytics = (analytics) => {
  const charts = analytics?.charts || {};
  return {
    periodLabel: analytics?.periodLabel,
    kpis: analytics?.kpis,
    changes: analytics?.changes,
    employeeRevenue: (charts.employeeRevenue || []).slice(0, 5),
    employeePerformance: (charts.employeePerformance || []).slice(0, 5),
    customerRevenue: (charts.customerRevenue || []).slice(0, 5),
    productRevenue: (charts.productRevenue || []).slice(0, 5),
    leadConversion: charts.leadConversion || [],
    leadStatus: charts.leadStatus || [],
    quotationStatus: charts.quotationStatus || [],
    activityCompletion: charts.activityCompletion || [],
    employeeQuotations: charts.employeeQuotations || [],
    activityByEmployee: charts.activityByEmployee || [],
    customerAcquisition: charts.customerAcquisition || [],
    followUpOverdue: charts.followUpOverdue || [],
  };
};

// Only the first 15 matching records go to the model; the full list is still returned to the page in "details".
const buildModelRecords = (relevantRecords) => {
  const modelRecords = {};
  Object.entries(relevantRecords).forEach(([key, value]) => {
    const records = Array.isArray(value?.records) ? value.records : [];
    modelRecords[key] = {
      records: records.slice(0, 15),
      truncated: Boolean(value?.truncated) || records.length > 15,
      totalMatching: records.length,
    };
  });
  return modelRecords;
};

const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const formatChange = (value) => (value === null || value === undefined || !Number.isFinite(Number(value))
  ? '—'
  : `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(1)}%`);
const formatPoints = (value) => (value === null || value === undefined || !Number.isFinite(Number(value))
  ? '—'
  : `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(1)} pts`);

// Turns the small model's text into clean plain text (real line breaks, no leaked fields, no invented "null" lines).
const cleanAnswerText = (value) => String(value)
  .replace(/\\+n/g, '\n')
  .replace(/\s*chartKey\s*:\s*\w+\s*$/i, '')
  .replace(/\$(?=\d)/g, '')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !/\bis null\b/i.test(line))
  .join('\n');

const parseAssistantJson = (value) => {
  const content = String(value || '').trim();
  const fencedContent = content.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1];
  const candidate = fencedContent || content;
  const start = candidate.indexOf('{');
  if (start < 0) throw new SyntaxError('Assistant response did not contain a JSON object.');

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < candidate.length; index += 1) {
    const character = candidate[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(candidate.slice(start, index + 1));
    }
  }
  throw new SyntaxError('Assistant response contained an incomplete JSON object.');
};

const getAssistantResponseShape = (content) => {
  const text = String(content || '').trim();
  return {
    length: text.length,
    format: /^```(?:json)?/i.test(text) ? 'markdown-fenced'
      : text.startsWith('{') ? 'json-object'
        : text.includes('{') ? 'text-with-json'
          : 'non-json',
    endsWithObject: text.endsWith('}'),
  };
};

// Answers the common questions straight from the CRM numbers: instant, exact, and returned as a table.
const buildDirectAnswer = (question, analytics, relevantRecords) => {
  const q = question.toLowerCase().replace(/[^a-z0-9\s%-]/g, ' ');
  const kpis = analytics?.kpis || {};
  const changes = analytics?.changes || {};
  const charts = analytics?.charts || {};
  const period = analytics?.periodLabel || 'the selected period';

  if (/\bleads?\b|\bconversion\b/.test(q) && relevantRecords.pendingLeads) {
    const { records, truncated } = relevantRecords.pendingLeads;
    return {
      answer: records.length
        ? `${records.length}${truncated ? '+' : ''} lead${records.length === 1 ? ' is' : 's are'} pending conversion in ${period}.`
        : `No leads are pending conversion in ${period}.`,
      chartKey: records.length ? 'funnel' : null,
      table: records.length ? {
        title: 'Pending leads',
        columns: ['Lead ID', 'Company', 'Status', 'Assigned To', 'Follow-up Date'],
        rows: records.map((lead) => [lead.leadId || '—', lead.company, lead.status, lead.assignedTo, lead.followUpDate || '—']),
      } : null,
    };
  }

  if (/\bactivit(?:y|ies)\b|\bfollow[\s-]?ups?\b|\boverdue\b/.test(q) && relevantRecords.activities) {
    const { records, truncated } = relevantRecords.activities;
    const label = /\boverdue\b/.test(q) ? 'overdue' : 'open';
    return {
      answer: records.length
        ? `${records.length}${truncated ? '+' : ''} ${label} activit${records.length === 1 ? 'y' : 'ies'} in ${period}.`
        : `No ${label} activities in ${period}.`,
      chartKey: records.length ? 'activities' : null,
      table: records.length ? {
        title: label === 'overdue' ? 'Overdue activities' : 'Open activities',
        columns: ['Activity ID', 'Customer', 'Type', 'Assigned To', 'Follow-up Date', 'Status'],
        rows: records.map((item) => [item.activityId || '—', item.customer, item.type, item.assignedTo, item.followUpDate || '—', item.status]),
      } : null,
    };
  }

  if (/\bemployees?\b|\bsales ?(?:person|rep)/.test(q) && /\b(?:revenue|highest|top|best|most)\b/.test(q)) {
    const rows = (charts.employeeRevenue || []).slice(0, 5);
    if (!rows.length) return { answer: `No revenue was recorded in ${period}.`, chartKey: null, table: null };
    const top = rows[0];
    return {
      answer: `${top.employee} generated the highest revenue in ${period}: ${formatNumber(top.revenue)} from ${top.deals} deal${top.deals === 1 ? '' : 's'}.`,
      chartKey: 'employees',
      table: {
        title: 'Revenue by employee',
        columns: ['Employee', 'Revenue', 'Deals'],
        rows: rows.map((row) => [row.employee, formatNumber(row.revenue), String(row.deals)]),
      },
    };
  }

  if (/\b(?:total\s+)?revenue\b/.test(q) || /\bsales\s+(?:performance|summary|overview)\b/.test(q)) {
    if (/\bcompare\b|\bversus\b|\bprevious month\b|\bthis month\b.*\b(?:last|previous)\s+month\b/.test(q)) {
      const current = formatNumber(kpis.totalRevenue);
      const previous = formatNumber(changes.totalRevenue === null ? 0 : (kpis.totalRevenue || 0) / (1 + (changes.totalRevenue || 0) / 100));
      return {
        answer: `Revenue in ${period} is ${current}. Change versus the previous period: ${formatChange(changes.totalRevenue)}.`,
        chartKey: 'revenueTrend',
        table: {
          title: 'Revenue comparison',
          columns: ['Period', 'Revenue', 'Change'],
          rows: [['Selected period', current, formatChange(changes.totalRevenue)], ['Previous period', previous, '—']],
        },
      };
    }
    return {
      answer: `Total revenue in ${period} is ${formatNumber(kpis.totalRevenue)}.`,
      chartKey: 'revenueTrend',
      table: {
        title: `Revenue (${period})`,
        columns: ['Metric', 'Value'],
        rows: [['Total revenue', formatNumber(kpis.totalRevenue)], ['Total margin', formatNumber(kpis.totalMargin)], ['Change from previous period', formatChange(changes.totalRevenue)]],
      },
    };
  }

  if (/\bquotations?\b/.test(q)) {
    const statuses = (charts.quotationStatus || []);
    return {
      answer: `${formatNumber(kpis.totalQuotations)} quotation${kpis.totalQuotations === 1 ? ' was' : 's were'} generated in ${period}.`,
      chartKey: 'quotations',
      table: {
        title: `Quotations (${period})`,
        columns: ['Status', 'Count'],
        rows: statuses.length ? statuses.map((row) => [row.status || 'Unknown', formatNumber(row.count)]) : [['Total generated', formatNumber(kpis.totalQuotations)]],
      },
    };
  }

  if (/\b(?:open|pending|currently)\s+(?:opportunities?|deals?)\b|\bopportunities?\b.*\bopen\b/.test(q)) {
    const rows = (charts.funnel || []).filter((row) => !/won|lost|closed/i.test(row.stage || ''));
    const count = rows.reduce((sum, row) => sum + Number(row.count || 0), 0);
    return {
      answer: `${count} opportunity${count === 1 ? ' is' : 'ies are'} currently open in ${period}.`,
      chartKey: 'funnel',
      table: {
        title: 'Open opportunities',
        columns: ['Stage', 'Count'],
        rows: rows.map((row) => [row.stage, formatNumber(row.count)]),
      },
    };
  }

  if (/\b(?:qualified|qualifying)\s+leads?\b/.test(q)) {
    const rows = (charts.leadStatus || []).filter((row) => /qualified/i.test(row.status || ''));
    const count = rows.reduce((sum, row) => sum + Number(row.count || 0), 0);
    return { answer: `${count} qualified lead${count === 1 ? '' : 's'} in ${period}.`, chartKey: 'funnel', table: { title: 'Qualified leads', columns: ['Status', 'Count'], rows: rows.map((row) => [row.status, formatNumber(row.count)]) } };
  }

  if (/\b(?:converted|conversion)\s+(?:leads?|customers?)\b|\bleads?\b.*\b(?:converted|customers?)\b/.test(q)) {
    return {
      answer: `${formatNumber(kpis.convertedLeads)} lead${kpis.convertedLeads === 1 ? ' was' : 's were'} converted into customers in ${period}.`,
      chartKey: 'funnel',
      table: {
        title: 'Lead conversion',
        columns: ['Status', 'Count'],
        rows: (charts.leadConversion || []).map((row) => [row.status, formatNumber(row.count)]),
      },
    };
  }

  if (/\b(?:how many|total)\s+(?:leads?|customers?)\b|\bleads?\s+(?:do we have|assigned)\b|\bcustomers?\s+do we have\b/.test(q)) {
    const leads = /lead/.test(q);
    return {
      answer: leads
        ? `${formatNumber(kpis.totalLeads)} total lead${kpis.totalLeads === 1 ? '' : 's'} in ${period}.`
        : `${formatNumber(kpis.customers)} customer${kpis.customers === 1 ? '' : 's'} in ${period}.`,
      chartKey: leads ? 'funnel' : 'customers',
      table: leads
        ? { title: 'Leads', columns: ['Status', 'Count'], rows: (charts.leadStatus || []).map((row) => [row.status, formatNumber(row.count)]) }
        : { title: 'Customer summary', columns: ['Metric', 'Count'], rows: [['Customers', formatNumber(kpis.customers)]] },
    };
  }

  if (/\bleads?\b.*\b(?:assigned|employee|employees)\b|\bassigned\b.*\bleads?\b/.test(q)) {
    const rows = (charts.leadsAssignedByEmployee || []);
    return {
      answer: rows.length ? `Leads are assigned across ${rows.length} employee${rows.length === 1 ? '' : 's'} in ${period}.` : `No employee lead assignments were found in ${period}.`,
      chartKey: 'employees',
      table: { title: 'Leads assigned by employee', columns: ['Employee', 'Leads'], rows: rows.map((row) => [row.employee, formatNumber(row.count)]) },
    };
  }

  if (/\b(?:monthly|month)\b.*\b(?:revenue|sales)\b|\brevenue\b.*\bmonth\b/.test(q)) {
    const rows = (charts.monthlyRevenue || []);
    return {
      answer: `Monthly revenue performance for ${period} is summarized below.`,
      chartKey: 'revenueTrend',
      table: { title: 'Monthly revenue', columns: ['Month', 'Revenue'], rows: rows.map((row) => [row.label, formatNumber(row.revenue)]) },
    };
  }

  if (/\b(?:employee|sales person|sales rep)\b.*\b(?:performance|quotation|quotations|pending activities|activities)\b|\b(?:employee-wise|employee wise)\b/.test(q)) {
    if (/quotation/.test(q)) {
      const rows = (charts.employeeQuotations || []).slice(0, 10);
      return { answer: `Employee-wise quotation details for ${period}.`, chartKey: 'quotations', table: { title: 'Employee quotations', columns: ['Employee', 'Quotations'], rows: rows.map((row) => [row.employee, formatNumber(row.quotations)]) } };
    }
    if (/pending\s+activities|most\s+pending/.test(q)) {
      const rows = (charts.activityByEmployee || []).slice(0, 10);
      return { answer: `Employee-wise open activity details for ${period}.`, chartKey: 'activities', table: { title: 'Pending activities by employee', columns: ['Employee', 'Activities'], rows: rows.map((row) => [row.employee, formatNumber(row.count)]) } };
    }
    const rows = (charts.employeePerformance || []).slice(0, 10);
    return { answer: `Employee-wise sales performance for ${period}.`, chartKey: 'employees', table: { title: 'Employee performance', columns: ['Employee', 'Revenue', 'Leads Assigned', 'Leads Converted', 'Activities Completed'], rows: rows.map((row) => [row.employee, formatNumber(row.revenue), formatNumber(row.leadsAssigned), formatNumber(row.leadsConverted), formatNumber(row.activitiesCompleted)]) } };
  }

  if (/\bcustomers?\b/.test(q)) {
    const rows = (charts.customerRevenue || []).slice(0, 10);
    if (/recent|newly|added/.test(q)) {
      const recent = (charts.customerAcquisition || []).slice(-5);
      return { answer: `Recently added customer activity for ${period} is summarized below.`, chartKey: 'customers', table: { title: 'Recent customer additions', columns: ['Period', 'Customers'], rows: recent.map((row) => [row.label, formatNumber(row.count)]) } };
    }
    if (/highest|business value|highest value|top/.test(q) && rows.length) {
      return { answer: `Highest customer business value in ${period}: ${rows[0].customer} with ${formatNumber(rows[0].revenue)}.`, chartKey: 'customers', table: { title: 'Customer business value', columns: ['Customer', 'Revenue'], rows: rows.map((row) => [row.customer, formatNumber(row.revenue)]) } };
    }
    return { answer: `${formatNumber(kpis.customers)} customer${kpis.customers === 1 ? '' : 's'} in ${period}.`, chartKey: 'customers', table: { title: 'Customer summary', columns: ['Metric', 'Value'], rows: [['Customers', formatNumber(kpis.customers)], ['Sales activities', formatNumber(kpis.activities)]] } };
  }

  if (/\bsuggest|\brecommend|attention|needs action|what should i\b/.test(q)) {
    const suggestions = [];
    if (Number(kpis.pendingFollowUps || 0) > 0) suggestions.push(`${formatNumber(kpis.pendingFollowUps)} pending or overdue follow-up${kpis.pendingFollowUps === 1 ? ' needs' : 's need'} attention.`);
    if (Number(kpis.pendingQuotations || 0) > 0) suggestions.push(`${formatNumber(kpis.pendingQuotations)} quotation${kpis.pendingQuotations === 1 ? ' is' : 's are'} awaiting action.`);
    const topEmployee = (charts.employeeRevenue || []).slice(0, 1)[0];
    if (topEmployee) suggestions.push(`${topEmployee.employee} leads employee revenue in ${period}.`);
    if (!suggestions.length) suggestions.push(`No immediate CRM follow-up issues were found in ${period}.`);
    return { answer: `Sales suggestions for ${period}:`, chartKey: null, table: { title: 'Suggested actions', columns: ['Priority', 'Suggestion'], rows: suggestions.map((item, index) => [String(index + 1), item]) } };
  }

  if (/\b(?:performance|overview|summary)\b/.test(q)) {
    return {
      answer: `Sales performance for ${period}: revenue ${formatNumber(kpis.totalRevenue)} from ${kpis.orders || 0} order${kpis.orders === 1 ? '' : 's'}, with ${kpis.totalLeads || 0} lead${kpis.totalLeads === 1 ? '' : 's'} and ${kpis.totalQuotations || 0} quotation${kpis.totalQuotations === 1 ? '' : 's'}.`,
      chartKey: 'revenueTrend',
      table: {
        title: `Sales performance (${period})`,
        columns: ['Metric', 'This period', 'Change vs previous period'],
        rows: [
          ['Total revenue', formatNumber(kpis.totalRevenue), formatChange(changes.totalRevenue)],
          ['Total margin', formatNumber(kpis.totalMargin), formatChange(changes.totalMargin)],
          ['Orders', formatNumber(kpis.orders), formatChange(changes.orders)],
          ['Leads', formatNumber(kpis.totalLeads), formatChange(changes.opportunities)],
          ['Converted leads', formatNumber(kpis.convertedLeads), formatChange(changes.convertedLeads)],
          ['Quotations', formatNumber(kpis.totalQuotations), formatChange(changes.totalQuotations)],
          ['Won deals', formatNumber(kpis.wonDeals), '—'],
          ['Lost deals', formatNumber(kpis.lostDeals), '—'],
          ['Conversion rate', `${Number(kpis.conversionRate || 0).toFixed(1)}%`, formatPoints(changes.conversionRate)],
          ['Customers', formatNumber(kpis.customers), formatChange(changes.customers)],
          ['Sales activities', formatNumber(kpis.activities), formatChange(changes.activities)],
          ['Pending follow-ups', formatNumber(kpis.pendingFollowUps), formatChange(changes.pendingFollowUps)],
        ],
      },
    };
  }

  return null;
};

const GREETING_PATTERN = /^\s*(?:(?:hi+|hii+|hello+|helo+|hlo+|hey+|hola|namaste)(?:\s+(?:there|everyone))?|good\s+(?:morning|afternoon|evening)(?:\s+(?:to\s+you|there|everyone))?|(?:thanks?(?:\s+you)?|thank\s+(?:you|u))(?:\s+(?:so\s+much|a\s+lot|for\s+(?:your\s+)?help))?|ok(?:ay)?(?:\s+thanks?)?|(?:bye|goodbye|good\s+bye)(?:\s+(?:for\s+now|now))?|have\s+(?:a\s+)?(?:great|good)\s+(?:day|evening))\s*[!.?]*\s*$/i;
const ISSUE_PATTERN = /\b(?:problem|issue|bug|not working|isn'?t working|doesn'?t work|don'?t work|broken|crash(?:es|ed|ing)?|stuck|can'?t|cannot|unable to|report (?:a |an )?(?:problem|issue|bug)|contact (?:the )?(?:developer|support))\b|\b(?:got|getting|see|seeing|shows|showing)\b.{0,30}\b(?:error|failed)\b/i;
const CRM_PATTERN = /\b(?:revenue|sales?|leads?|quotations?|customers?|employees?|activit(?:y|ies)|follow[\s-]?ups?|conversion|opf|orders?|margin|deals?|pipeline|funnel|products?|target|performance|reports?|overdue|pending|won|lost|campaigns?|renewals?|contacts?|suppliers?|summary|overview)\b/i;
const REPORT_UI_CHANGE_PATTERN = /\b(?:change|changes|modify|update|edit|remove|delete|add|move|hide|rearrange|customi[sz]e)\b.{0,80}\b(?:reports?|page|cards?|charts?|sections?)\b|\b(?:reports?|page|cards?|charts?|sections?)\b.{0,80}\b(?:change|changes|modify|update|edit|remove|delete|add|move|hide|rearrange|customi[sz]e)\b/i;
const REPORT_UI_FOLLOW_UP_PATTERN = /\b(?:remove|delete|add|move|hide|change|edit|update|one|another|card|chart|section)\b/i;

const isContextualFollowUp = (question, history = []) => (
  /\b(?:and|what about|how about|then|that|those|these|compare|previous|last|same|more|it|them|this|one|another)\b/i.test(question)
  && history.some((item) => item.role === 'user' && CRM_PATTERN.test(item.content))
);

const getRelevantAssistantHistory = (question, history = []) => {
  const lastUserIndex = history.map((item) => item.role).lastIndexOf('user');
  if (lastUserIndex >= 0 && isContextualFollowUp(question, history)) {
    return history.slice(lastUserIndex);
  }
  if (!REPORT_UI_CHANGE_PATTERN.test(question)
    && /\b(?:clarification|explain|help|which)\b/i.test(question)
    && /\breports?\b/i.test(question)) {
    const relevantAssistantIndex = history.map((item) => item.role === 'assistant' && /\breports?\b/i.test(item.content))
      .lastIndexOf(true);
    if (relevantAssistantIndex >= 0) return history.slice(relevantAssistantIndex);
  }
  return [];
};

const detectAssistantIntent = (question, history = []) => {
  if (GREETING_PATTERN.test(question)) return 'greeting';
  if (ISSUE_PATTERN.test(question)) return 'issue';
  const lastUserQuestion = [...history].reverse().find((item) => item.role === 'user')?.content || '';
  if (REPORT_UI_CHANGE_PATTERN.test(question)
    || (REPORT_UI_CHANGE_PATTERN.test(lastUserQuestion) && REPORT_UI_FOLLOW_UP_PATTERN.test(question))) return 'chat';
  if (CRM_PATTERN.test(question) || isContextualFollowUp(question, history)) return 'crm';
  return 'chat';
};
const createSalesAssistantHandler = ({
  loadAnalytics = getAnalyticsData,
  fetchProvider = (...args) => fetch(...args),
} = {}) => async (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (!question || question.length > 1000) {
    return res.status(400).json({ success: false, message: 'Enter a question of 1–1000 characters.' });
  }
  let phase = 'configuration';
  try {
    const aiUrl = new URL(process.env.SALES_AI_BASE_URL || 'http://127.0.0.1:11434/v1/chat/completions');
    if (aiUrl.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(aiUrl.hostname)) {
      return res.status(503).json({ success: false, message: 'The Sales AI endpoint must be a local, self-hosted service.' });
    }
    const conversationHistory = (Array.isArray(req.body?.history) ? req.body.history : [])
      .filter((item) => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
      .slice(-6)
      .map((item) => ({ role: item.role, content: item.content.slice(0, 300) }));
    const priorMessages = getRelevantAssistantHistory(question, conversationHistory);
    const intent = detectAssistantIntent(question, conversationHistory);
    if (['greeting', 'chat', 'issue'].includes(intent)) {
      phase = 'ai-provider';
      const history = priorMessages.slice(-4);
      const chatMessages = [
        {
          role: 'system',
          content: `You are the friendly assistant built into this company's Sales CRM. Answer the latest user message directly and use prior messages only to resolve relevant follow-ups. Do not reuse names, chart labels, or facts from an unrelated earlier answer. Chat naturally and vary your wording based on the conversation. Answer greetings, thanks, and general questions naturally. If a request to change a page or report is unclear, ask one relevant clarification question. Use one to three concise sentences unless detail is requested. You can help with questions about CRM sales data; never invent CRM numbers or records. If the user reports a problem, tell them to use the "Send to developer" button.`,
        },
        ...history,
        { role: 'user', content: question },
      ];
      let chatText = '';
      let partialChatText = '';
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const chatResponse = await fetchProvider(aiUrl, {
          method: 'POST',
          headers: {
            ...(process.env.SALES_AI_API_KEY ? { Authorization: 'Bearer ' + process.env.SALES_AI_API_KEY } : {}),
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(120000),
          body: JSON.stringify({
            model: process.env.SALES_AI_MODEL || 'llama3.1',
            temperature: 0.4,
            max_tokens: attempt === 0 ? 1200 : 1800,
            messages: attempt === 0
              ? chatMessages
              : [
                ...chatMessages,
                { role: 'assistant', content: partialChatText },
                { role: 'user', content: 'Continue and complete your answer naturally without repeating the text already written.' },
              ],
          }),
        });
        if (!chatResponse.ok) {
          const providerBody = await chatResponse.text().catch(() => '');
          const providerMessage = sanitizeAssistantError(providerBody);
          throw new Error(`Provider returned HTTP ${chatResponse.status}${chatResponse.statusText ? ` ${chatResponse.statusText}` : ''}${providerMessage ? `: ${providerMessage}` : ''}`);
        }
        const chatResult = await chatResponse.json();
        const choice = chatResult.choices?.[0];
        chatText = String(choice?.message?.content || '').trim();
        if (choice?.finish_reason !== 'length') {
          if (partialChatText) chatText = `${partialChatText}\n${chatText}`.trim();
          break;
        }
        console.warn('Sales AI conversational response reached its token limit:', {
          attempt: attempt + 1,
          model: process.env.SALES_AI_MODEL || 'llama3.1',
          usage: chatResult.usage || null,
          response: getAssistantResponseShape(chatText),
        });
        if (attempt === 1) throw new Error('The Sales AI service could not complete its response. Please retry with a shorter question.');
        partialChatText = chatText;
      }
      if (!chatText) throw new Error('Sales AI provider returned an empty answer.');
      return res.status(200).json({
        success: true,
        data: { answer: chatText, chartKey: null, table: null, intent, generatedAt: new Date().toISOString(), details: {} },
      });
    }
    const analyticsRequest = { ...req, query: req.body?.filters || {} };
    phase = 'sales-data';
    const analytics = await loadAnalytics(analyticsRequest);
    const normalizedQuestion = question.toLowerCase();
    const relevantRecords = {};
    if (/\blead|conversion\b/.test(normalizedQuestion)) {
      const range = getDateRange(analyticsRequest.query);
      const leadScope = await buildReportOwnerScope(analyticsRequest, {
        extraClauses: [
          ...(req.user?.name ? [{ assignedTo: String(req.user.name) }] : []),
          ...(req.user?.id ? [{ assignedToId: String(req.user.id) }] : []),
        ],
      });
      const leadRecords = await Lead.find({
        $and: [
          { createdDate: { $gte: range.start, $lt: range.end } },
          leadScope,
        ],
      })
        .select('leadId companyName leadStatus assignedTo followUpDate quotationId isConverted')
        .sort({ createdDate: -1 })
        .limit(51)
        .lean();
      const pendingLeads = leadRecords.filter((lead) => !lead.isConverted && !['Won', 'Lost', 'Scrapped'].includes(lead.leadStatus || ''));
      relevantRecords.pendingLeads = {
        records: pendingLeads.slice(0, 50).map((lead) => ({
          leadId: String(lead.leadId || ''),
          company: String(lead.companyName || 'Not recorded'),
          status: String(lead.leadStatus || 'Not recorded'),
          assignedTo: String(lead.assignedTo || 'Unassigned'),
          followUpDate: String(lead.followUpDate || ''),
        })),
        truncated: leadRecords.length > 50,
      };
    }
    if (/\bactivit(?:y|ies)\b|\bfollow[\s-]?ups?\b|\boverdue\b/.test(normalizedQuestion)) {
      const range = getDateRange(analyticsRequest.query);
      const activityScope = await buildReportOwnerScope(analyticsRequest, {
        extraClauses: [
          ...(req.user?.name ? [{ assignedUser: String(req.user.name) }] : []),
          ...(req.user?.id ? [{ assignedUserId: String(req.user.id) }] : []),
        ],
      });
      const activityRecords = await Activity.find({
        $and: [
          {
            deletedAt: null,
            $or: [
              { activityDate: { $gte: localDateKey(range.start), $lt: localDateKey(range.end) } },
              { followUpDate: { $gte: localDateKey(range.start), $lt: localDateKey(range.end) } },
            ],
          },
          activityScope,
        ],
      })
        .select('activityId customerName activityType activityDate followUpDate status assignedUser assignedUserId')
        .sort({ activityDate: -1 })
        .limit(101)
        .lean();
      const activitiesWithEmployeeNames = await resolveActivityEmployeeNames(activityRecords);
      const overdueOnly = /\boverdue\b/.test(normalizedQuestion);
      const relevantActivities = activitiesWithEmployeeNames
        .map((activity) => ({ activity, effectiveStatus: getEffectiveStatus(activity, getTodayInKolkata()) }))
        .filter(({ effectiveStatus }) => overdueOnly
          ? effectiveStatus.startsWith('Overdue - ')
          : !['Completed', 'Cancelled'].includes(effectiveStatus))
        .slice(0, 100)
        .map(({ activity, effectiveStatus }) => ({
          activityId: String(activity.activityId || ''),
          customer: String(activity.customerName || 'Not recorded'),
          type: String(activity.activityType || 'Not recorded'),
          assignedTo: String(activity.assignedUser || 'Unassigned'),
          followUpDate: String(activity.followUpDate || ''),
          status: effectiveStatus,
        }));
      relevantRecords.activities = {
        records: relevantActivities,
        truncated: activityRecords.length > 100,
      };
    }
    const directAnswer = buildDirectAnswer(question, analytics, relevantRecords);
    phase = 'ai-provider';
    const analyticsMessages = [
      {
        role: 'system',
        content: 'You are the CRM Sales analytics assistant. Answer only from the supplied authorized, date-filtered CRM aggregates and relevant records. Never invent or infer unprovided values. If the records cannot answer the question, say so. If a relevant record list is truncated, say that only a limited set is shown. Return one valid JSON object with an answer string and chartKey, which must be one of revenueTrend, customers, quotations, employees, funnel, products, activities, or null. Use null unless a chart materially helps. State the reporting period when useful. The answer can include concise headings or bullets as escaped characters inside its JSON string. Keep it relevant and under 200 words. If computedAnswerFromAuthorizedCRM is provided, preserve its facts and values.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          question,
          conversationHistory: priorMessages,
          reportingPeriod: analytics.periodLabel,
          computedAnswerFromAuthorizedCRM: directAnswer || undefined,
          authorizedSalesAnalytics: buildCompactAnalytics(analytics),
          relevantRecords: buildModelRecords(relevantRecords),
        }),
      },
    ];
    let providerResult;
    let content;
    let answer;
    let parseError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const requestMessages = attempt === 0
        ? analyticsMessages
        : [
          ...analyticsMessages,
          {
            role: 'user',
            content: 'Your previous response was incomplete or invalid. Regenerate the answer as one complete, valid JSON object with an answer string and chartKey. Keep the answer concise and do not add markdown fences or text outside the JSON object.',
          },
        ];
      const response = await fetchProvider(aiUrl, {
        method: 'POST',
        headers: {
          ...(process.env.SALES_AI_API_KEY ? { Authorization: 'Bearer ' + process.env.SALES_AI_API_KEY } : {}),
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(240000),
        body: JSON.stringify({
          model: process.env.SALES_AI_MODEL || 'llama3.1',
          temperature: 0.1,
          max_tokens: attempt === 0 ? 1200 : 1800,
          response_format: { type: 'json_object' },
          messages: requestMessages,
        }),
      });
      if (!response.ok) {
        const providerBody = await response.text().catch(() => '');
        const providerMessage = sanitizeAssistantError(providerBody);
        throw new Error(`Provider returned HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}${providerMessage ? `: ${providerMessage}` : ''}`);
      }
      providerResult = await response.json();
      const choice = providerResult.choices?.[0];
      content = choice?.message?.content;
      if (typeof content !== 'string') throw new Error('Sales AI provider returned an invalid response.');
      try {
        if (choice.finish_reason === 'length') throw new SyntaxError('Provider completion reached its token limit.');
        answer = parseAssistantJson(content);
        parseError = null;
        break;
      } catch (error) {
        parseError = error;
        console.warn('Sales AI returned an incomplete or malformed structured response:', {
          attempt: attempt + 1,
          model: process.env.SALES_AI_MODEL || 'llama3.1',
          finishReason: choice.finish_reason || 'not-provided',
          usage: providerResult.usage || null,
          response: getAssistantResponseShape(content),
          parseError: sanitizeAssistantError(error),
        });
      }
    }
    if (parseError) {
      throw new Error('The Sales AI service returned an incomplete or invalid response after retry.');
    }
    if (Array.isArray(answer.answer)) answer.answer = answer.answer.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n');
    else if (answer.answer && typeof answer.answer === 'object') answer.answer = JSON.stringify(answer.answer);
    const allowedCharts = ['revenueTrend', 'customers', 'quotations', 'employees', 'funnel', 'products', 'activities', null];
    const leakedChart = String(answer.answer || '').match(/chartKey\s*:\s*(\w+)/i);
    if (typeof answer.answer === 'string') answer.answer = cleanAnswerText(answer.answer);
    if (typeof answer.answer !== 'string' || answer.answer.length === 0) {
      console.error('Sales AI provider returned an empty answer:', {
        model: process.env.SALES_AI_MODEL || 'llama3.1',
        response: getAssistantResponseShape(content),
      });
      throw new Error('Sales AI provider returned an empty answer.');
    }
    if (!allowedCharts.includes(answer.chartKey)) answer.chartKey = null;
    if (!answer.chartKey && leakedChart && allowedCharts.includes(leakedChart[1])) answer.chartKey = leakedChart[1];
    return res.status(200).json({
      success: true,
      data: { answer: answer.answer, chartKey: answer.chartKey, table: directAnswer?.table || null, generatedAt: analytics.generatedAt, details: relevantRecords },
    });
  } catch (error) {
    const failure = getAssistantFailure(phase, error);
    console.error('Sales AI assistant failed:', {
      phase,
      errorName: error?.name || 'Error',
      errorCode: error?.code || error?.cause?.code || null,
      errorMessage: sanitizeAssistantError(error),
    });
    return res.status(failure.status).json({ success: false, message: failure.message });
  }
};

exports.askSalesAssistant = createSalesAssistantHandler();
exports._getDateRange = getDateRange;
exports._getComparisonRange = getComparisonRange;
exports._getRevenue = getRevenue;
exports._getAnalyticsData = getAnalyticsData;
exports._createSalesAssistantHandler = createSalesAssistantHandler;
