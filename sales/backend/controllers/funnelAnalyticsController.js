const Lead = require('../models/Lead');
const Employee = require('../models/Employee');
const { ownerScope } = require('../utils/accessScope');

const DAY_MS = 24 * 60 * 60 * 1000;
const FUNNEL_STAGES = [
  'Pitching',
  'Demo/POC',
  'Quotation',
  'Upside',
  'Commit',
  'PO Received',
  'OPF',
  'Won',
  'Lost',
  'Hold',
];
const STAGE_ORDER = [
  ...FUNNEL_STAGES,
  'New',
  'Contacted',
  'Follow-up',
  'Interested',
  'Qualified',
  'Proposal Sent',
  'Negotiation',
  'Scrapped',
];
const TERMINAL_STAGES = new Set(['OPF', 'Won', 'Lost', 'Hold', 'Scrapped']);

const text = (value) => String(value ?? '').trim();
const dateKey = (value) => {
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = value instanceof Date ? value : new Date(value || '');
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
};
const validDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const addDays = (value, amount) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};
const differenceInDays = (start, end) => Math.floor(
  (Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / DAY_MS,
);
const parseRange = (query, now = new Date()) => {
  const end = text(query.endDate) || dateKey(now);
  const start = text(query.startDate) || `${end.slice(0, 4)}-01-01`;
  if (!validDateKey(start) || !validDateKey(end) || start > end) return null;
  return { start, end };
};
const getStage = (record) => text(record.quotationDetails?.stage || record.leadStatus) || 'Not recorded';
const getRevenue = (record) => {
  const details = record.quotationDetails || {};
  for (const rawValue of [details.revenue, details.value]) {
    if (rawValue === null || rawValue === undefined || text(rawValue) === '') continue;
    const value = Number(rawValue);
    if (Number.isFinite(value)) return value;
  }
  const products = Array.isArray(record.products) ? record.products : [];
  if (!products.length) return null;
  let total = 0;
  for (const product of products) {
    if (product?.quantity === null || product?.quantity === undefined || text(product.quantity) === ''
      || product?.unitPrice === null || product?.unitPrice === undefined || text(product.unitPrice) === '') return null;
    const quantity = Number(product.quantity);
    const unitPrice = Number(product.unitPrice);
    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return null;
    total += quantity * unitPrice;
  }
  return total;
};
const getMarginPercent = (record) => {
  const rawValue = record.quotationDetails?.marginPercent;
  if (rawValue === null || rawValue === undefined || text(rawValue) === '') return null;
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
};
const getMargin = (record, revenue) => {
  if (revenue === null) return null;
  const marginPercent = getMarginPercent(record);
  return marginPercent === null ? null : revenue * marginPercent / 100;
};
const getProducts = (record) => Array.isArray(record.products) ? record.products : [];
const getProductRevenue = (product) => {
  if (product?.quantity === null || product?.quantity === undefined || text(product.quantity) === ''
    || product?.unitPrice === null || product?.unitPrice === undefined || text(product.unitPrice) === '') return null;
  const quantity = Number(product?.quantity);
  const unitPrice = Number(product?.unitPrice);
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return null;
  return quantity * unitPrice;
};
const isQuotationGenerated = (record) => Boolean(text(record.quotationId))
  || (Array.isArray(record.timeline) && record.timeline.some(
    (entry) => text(entry?.title).toLowerCase() === 'quotation generated',
  ));
const isDemoConducted = (record) => text(record.quotationDetails?.demo).toLowerCase() === 'yes';
const isOpen = (record) => !TERMINAL_STAGES.has(getStage(record))
  && !record.isConverted
  && !record.isScrapped;
const isWon = (record) => ['OPF', 'Won'].includes(getStage(record))
  || (Boolean(record.isConverted) && !['Lost', 'Hold', 'Scrapped'].includes(getStage(record)));
const getStageStart = (record) => {
  const stage = getStage(record);
  const stageEvents = (Array.isArray(record.timeline) ? record.timeline : [])
    .map((entry) => {
      const title = text(entry?.title).toLowerCase();
      const description = text(entry?.description);
      let changedStage = '';
      if (title === 'status updated') changedStage = description.match(/^Moved to (.+)$/i)?.[1] || '';
      else if (title === 'moved to funnel') changedStage = 'Qualified';
      else if (title === 'moved to activity') changedStage = 'Follow-up';
      else if (title === 'quotation generated') changedStage = 'Proposal Sent';
      else if (title === 'lead scrapped') changedStage = 'Scrapped';
      else if (title === 'converted to customer') changedStage = 'Won';
      return { changedStage: text(changedStage), at: entry?.createdAt };
    })
    .filter((entry) => entry.changedStage === stage && dateKey(entry.at))
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
  return stageEvents[0]?.at || null;
};

const toBucketKey = (value, granularity) => {
  const key = dateKey(value);
  if (!key) return '';
  if (granularity === 'monthly') return key.slice(0, 7);
  if (granularity === 'weekly') {
    const date = new Date(`${key}T00:00:00.000Z`);
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - daysSinceMonday);
    return date.toISOString().slice(0, 10);
  }
  return key;
};
const bucketLabel = (key, granularity) => {
  if (granularity === 'monthly') {
    const [year, month] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, month - 1, 1)));
  }
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${key}T00:00:00.000Z`));
};
const buildBucketKeys = (range, granularity) => {
  const keys = [];
  const seen = new Set();
  for (let day = range.start; day <= range.end; day = addDays(day, 1)) {
    const key = toBucketKey(day, granularity);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
};
const buildTrend = (currentRecords, previousRecords, range, granularity) => {
  const previousDays = differenceInDays(range.start, range.end) + 1;
  const previousEnd = addDays(range.start, -1);
  const previousRange = { start: addDays(previousEnd, -(previousDays - 1)), end: previousEnd };
  const currentKeys = buildBucketKeys(range, granularity);
  const previousKeys = buildBucketKeys(previousRange, granularity);
  const currentCounts = new Map();
  const previousCounts = new Map();
  currentRecords.forEach((record) => {
    const key = toBucketKey(record.createdDate || record.createdAt, granularity);
    if (key) currentCounts.set(key, (currentCounts.get(key) || 0) + 1);
  });
  previousRecords.forEach((record) => {
    const key = toBucketKey(record.createdDate || record.createdAt, granularity);
    if (key) previousCounts.set(key, (previousCounts.get(key) || 0) + 1);
  });
  const size = Math.max(currentKeys.length, previousKeys.length);
  return Array.from({ length: size }, (_unused, index) => {
    const currentKey = currentKeys[index];
    const previousKey = previousKeys[index];
    return {
      label: currentKey ? bucketLabel(currentKey, granularity) : `Period ${index + 1}`,
      current: currentKey ? currentCounts.get(currentKey) || 0 : null,
      previous: previousKey ? previousCounts.get(previousKey) || 0 : null,
    };
  });
};

const buildAnalytics = ({ records, employees, filters, range, today, granularity }) => {
  const employeesById = new Map();
  const employeesByName = new Map();
  employees.forEach((employee) => {
    const id = String(employee._id || '');
    const name = text(employee.employeeName || employee.fullName);
    if (id) employeesById.set(id, employee);
    if (name) employeesByName.set(name.toLowerCase(), employee);
  });
  const employeeFor = (record) => {
    const ids = [text(record.assignedToId), text(record.createdById)].filter(Boolean);
    const names = [text(record.assignedTo), text(record.createdBy)].filter(Boolean);
    return ids.map((id) => employeesById.get(id)).find(Boolean)
      || names.map((name) => employeesByName.get(name.toLowerCase())).find(Boolean)
      || null;
  };
  const inDateRange = (record, start, end) => {
    const created = dateKey(record.createdDate || record.createdAt);
    return Boolean(created && created >= start && created <= end);
  };
  const inFilters = (record) => {
    const employee = employeeFor(record);
    const accountManagerId = text(record.assignedToId || record.createdById);
    const accountManagerName = text(record.assignedTo || record.createdBy);
    return (!filters.stage || getStage(record) === filters.stage)
      && (!filters.resource || text(record.quotationDetails?.tagResource) === filters.resource)
      && (!filters.accountManager || accountManagerId === filters.accountManager || accountManagerName === filters.accountManager)
      && (!filters.sbu || text(record.quotationDetails?.sbu) === filters.sbu)
      && (!filters.oem || text(record.quotationDetails?.oem) === filters.oem)
      && (!filters.branch || text(employee?.branchCode) === filters.branch);
  };
  const allInRange = records.filter((record) => inDateRange(record, range.start, range.end));
  const selected = allInRange.filter(inFilters);
  const previousDays = differenceInDays(range.start, range.end) + 1;
  const previousEnd = addDays(range.start, -1);
  const previousStart = addDays(previousEnd, -(previousDays - 1));
  const previous = records.filter((record) => inDateRange(record, previousStart, previousEnd) && inFilters(record));
  const stages = new Map(FUNNEL_STAGES.map((stage) => [
    stage,
    { stage, count: 0, revenue: 0, revenueCount: 0, margin: 0, marginCount: 0, ageDays: 0, ageCount: 0 },
  ]));
  const sbus = new Map();
  const customers = new Map();
  const products = new Map();
  const representatives = new Map();
  const branchNames = new Map();
  let revenueCount = 0;
  let marginCount = 0;
  let totalRevenue = 0;
  let totalMargin = 0;
  let expiredFunnels = 0;
  let closedFunnels = 0;
  let lostFunnels = 0;
  let demoConducted = 0;
  let quotationsGenerated = 0;
  const todayDate = dateKey(today);

  selected.forEach((record) => {
    const stage = getStage(record);
    const revenue = getRevenue(record);
    const margin = getMargin(record, revenue);
    const expectedClosure = dateKey(record.quotationDetails?.expectedClosure);
    const employee = employeeFor(record);
    const employeeId = text(record.assignedToId || record.createdById);
    const employeeName = text(record.assignedTo || employee?.employeeName || employee?.fullName || record.createdBy) || 'Unassigned';
    const branch = text(employee?.branchCode);

    const stageGroup = stages.get(stage) || { stage, count: 0, revenue: 0, revenueCount: 0, margin: 0, marginCount: 0, ageDays: 0, ageCount: 0 };
    stageGroup.count += 1;
    if (revenue !== null) {
      stageGroup.revenue += revenue;
      stageGroup.revenueCount += 1;
      totalRevenue += revenue;
      revenueCount += 1;
    }
    if (margin !== null) {
      stageGroup.margin += margin;
      stageGroup.marginCount += 1;
      totalMargin += margin;
      marginCount += 1;
    }
    const stageStarted = dateKey(getStageStart(record));
    const ageDays = stageStarted ? Math.max(0, differenceInDays(stageStarted, todayDate)) : null;
    if (ageDays !== null) {
      stageGroup.ageDays += ageDays;
      stageGroup.ageCount += 1;
    }
    stages.set(stage, stageGroup);

    if (revenue !== null && text(record.companyName)) {
      const key = text(record.companyName).toLowerCase();
      const group = customers.get(key) || { customer: text(record.companyName), revenue: 0, margin: 0, count: 0, hasRevenue: false, hasMargin: false };
      group.count += 1;
      group.revenue += revenue;
      group.hasRevenue = true;
      if (margin !== null) {
        group.margin += margin;
        group.hasMargin = true;
      }
      customers.set(key, group);
    }

    const sbu = text(record.quotationDetails?.sbu) || 'Not recorded';
    const sbuGroup = sbus.get(sbu) || { sbu, count: 0, revenue: 0, revenueCount: 0 };
    sbuGroup.count += 1;
    if (revenue !== null) {
      sbuGroup.revenue += revenue;
      sbuGroup.revenueCount += 1;
    }
    sbus.set(sbu, sbuGroup);

    const productRows = getProducts(record);
    const totalProductRevenue = productRows.reduce((sum, product) => sum + (getProductRevenue(product) || 0), 0);
    const recordMarginPercent = getMarginPercent(record);
    productRows.forEach((product) => {
      const name = text(product?.productName || product?.product || product?.name);
      if (!name) return;
      const key = name.toLowerCase();
      const group = products.get(key) || { product: name, funnels: new Set(), revenue: 0, margin: 0, hasRevenue: false, hasMargin: false };
      group.funnels.add(String(record._id));
      const productRevenue = getProductRevenue(product);
      if (productRevenue !== null) {
        group.revenue += productRevenue;
        group.hasRevenue = true;
        if (recordMarginPercent !== null) {
          group.margin += productRevenue * recordMarginPercent / 100;
          group.hasMargin = true;
        }
      } else if (revenue !== null && productRows.length === 1) {
        group.revenue += revenue;
        group.hasRevenue = true;
        if (margin !== null) {
          group.margin += margin;
          group.hasMargin = true;
        }
      } else if (revenue !== null && totalProductRevenue > 0) {
        const allocation = revenue * (getProductRevenue(product) || 0) / totalProductRevenue;
        group.revenue += allocation;
        group.hasRevenue = true;
        if (margin !== null) {
          group.margin += margin * allocation / revenue;
          group.hasMargin = true;
        }
      }
      products.set(key, group);
    });

    const repKey = (employeeId || employeeName).toLowerCase();
    const rep = representatives.get(repKey) || { employee: employeeName, employeeId, deals: 0, revenue: 0, revenueCount: 0 };
    rep.deals += 1;
    if (revenue !== null) {
      rep.revenue += revenue;
      rep.revenueCount += 1;
    }
    representatives.set(repKey, rep);

    if (isWon(record)) closedFunnels += 1;
    if (['Lost', 'Hold'].includes(stage)) lostFunnels += 1;
    if (expectedClosure && expectedClosure < todayDate && isOpen(record)) expiredFunnels += 1;
    if (isDemoConducted(record)) demoConducted += 1;
    if (isQuotationGenerated(record)) quotationsGenerated += 1;
    if (branch) branchNames.set(branch, branch);
  });

  const orderedStages = [...stages.values()].sort((left, right) => {
    const leftIndex = STAGE_ORDER.indexOf(left.stage);
    const rightIndex = STAGE_ORDER.indexOf(right.stage);
    if (leftIndex === -1 && rightIndex === -1) return left.stage.localeCompare(right.stage);
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
  const totalFunnels = selected.length;
  const wonLostCount = selected.filter((record) => isWon(record) || ['Lost', 'Hold'].includes(getStage(record))).length;
  const accountManagerOptions = new Map();
  records.forEach((record) => {
    const id = text(record.assignedToId || record.createdById);
    const employee = employeeFor(record);
    const name = text(record.assignedTo || employee?.employeeName || employee?.fullName || record.createdBy);
    if (name) accountManagerOptions.set(id || name, { id: id || name, name });
  });
  const unique = (values) => [...new Set(values.map(text).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  return {
    range,
    granularity,
    filters,
    filterOptions: {
      stages: unique([...FUNNEL_STAGES, ...records.map(getStage)]),
      resources: unique(records.map((record) => record.quotationDetails?.tagResource)),
      accountManagers: [...accountManagerOptions.values()].sort((a, b) => a.name.localeCompare(b.name)),
      sbus: unique(records.map((record) => record.quotationDetails?.sbu)),
      oems: unique(records.map((record) => record.quotationDetails?.oem)),
      branches: unique(records.map((record) => text(employeeFor(record)?.branchCode))),
    },
    kpis: {
      totalFunnels,
      openFunnels: selected.filter(isOpen).length,
      quotationsGenerated,
      closedFunnels,
      lostFunnels,
      totalRevenue: revenueCount ? totalRevenue : null,
      totalMargin: marginCount ? totalMargin : null,
      expiredFunnels,
      demoConducted,
      conversionRate: wonLostCount ? (closedFunnels / wonLostCount) * 100 : 0,
      revenueAvailableCount: revenueCount,
      marginAvailableCount: marginCount,
    },
    trend: buildTrend(selected, previous, range, granularity),
    stages: orderedStages.map((stage, index) => ({
      stage: stage.stage,
      count: stage.count,
      conversionPercent: totalFunnels ? stage.count / totalFunnels * 100 : 0,
      dropOffPercent: null,
      revenue: stage.count === 0 ? 0 : stage.revenueCount ? stage.revenue : null,
      margin: stage.count === 0 ? 0 : stage.marginCount ? stage.margin : null,
      averageDaysInStage: stage.ageCount ? stage.ageDays / stage.ageCount : null,
      averageDaysInStageCount: stage.ageCount,
      dropOffUnavailableReason: 'Historical stage exits are not consistently recorded in the current CRM.',
      order: index,
    })),
    revenueByStage: orderedStages.map((stage) => ({
      stage: stage.stage,
      revenue: stage.count === 0 ? 0 : stage.revenueCount ? stage.revenue : null,
    })),
    sbuAnalytics: [...sbus.values()]
      .sort((a, b) => b.count - a.count)
      .map((group) => ({ ...group, revenue: group.revenueCount ? group.revenue : null })),
    topCustomers: [...customers.values()]
      .sort((a, b) => b.revenue - a.revenue || a.customer.localeCompare(b.customer))
      .slice(0, 10)
      .map(({ hasRevenue, hasMargin, ...group }) => ({
        ...group,
        revenue: hasRevenue ? group.revenue : null,
        margin: hasMargin ? group.margin : null,
      })),
    topProducts: [...products.values()]
      .sort((a, b) => b.funnels.size - a.funnels.size || a.product.localeCompare(b.product))
      .slice(0, 10)
      .map((group) => ({
        product: group.product,
        funnelCount: group.funnels.size,
        revenue: group.hasRevenue ? group.revenue : null,
        margin: group.hasMargin ? group.margin : null,
      })),
    leaderboard: [...representatives.values()]
      .sort((a, b) => b.revenue - a.revenue || b.deals - a.deals || a.employee.localeCompare(b.employee))
      .slice(0, 10)
      .map((group, index) => ({ rank: index + 1, ...group, revenue: group.revenueCount ? group.revenue : null })),
  };
};

const getFunnelAnalytics = async (req, res) => {
  try {
    const range = parseRange(req.query);
    if (!range) return res.status(400).json({ success: false, message: 'A valid startDate/endDate range is required.' });
    const granularity = text(req.query.granularity || 'monthly').toLowerCase();
    if (!['daily', 'weekly', 'monthly'].includes(granularity)) {
      return res.status(400).json({ success: false, message: 'Granularity must be daily, weekly, or monthly.' });
    }
    const filters = {
      stage: text(req.query.stage),
      resource: text(req.query.resource),
      accountManager: text(req.query.accountManager),
      sbu: text(req.query.sbu),
      oem: text(req.query.oem),
      branch: text(req.query.branch),
    };
    const membership = {
      $or: [
        { 'quotationDetails.stage': { $exists: true, $nin: ['', null] } },
        { quotationId: { $exists: true, $nin: ['', null] } },
        { timeline: { $elemMatch: { title: 'Moved to funnel' } } },
      ],
    };
    const scope = ownerScope(req);
    const periodDays = differenceInDays(range.start, range.end) + 1;
    const previousEnd = addDays(range.start, -1);
    const queryStart = addDays(previousEnd, -(periodDays - 1));
    const queryEndExclusive = addDays(range.end, 1);
    const queryStartDate = new Date(`${queryStart}T00:00:00.000+05:30`);
    const queryEndDate = new Date(`${queryEndExclusive}T00:00:00.000+05:30`);
    const dateScope = {
      $or: [
        { createdDate: { $gte: queryStartDate, $lt: queryEndDate } },
        { createdDate: null, createdAt: { $gte: queryStartDate, $lt: queryEndDate } },
      ],
    };
    const query = { $and: [membership, scope, dateScope] };
    const records = await Lead.find(query)
      .select('_id leadId quotationId companyName leadStatus isConverted isScrapped createdBy createdById assignedTo assignedToId createdDate createdAt quotationDetails products timeline')
      .lean();
    const employeeIds = [...new Set(records
      .flatMap((record) => [record.assignedToId, record.createdById])
      .map(text)
      .filter((id) => /^[a-f\d]{24}$/i.test(id)))];
    const employees = employeeIds.length
      ? await Employee.find({ _id: { $in: employeeIds } }).select('employeeName fullName branchCode').lean()
      : [];
    const data = buildAnalytics({
      records,
      employees,
      filters,
      range,
      today: new Date(),
      granularity,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Unable to build Funnel analytics:', error);
    return res.status(500).json({ success: false, message: 'Unable to load Funnel analytics.' });
  }
};

module.exports = {
  getFunnelAnalytics,
  buildAnalytics,
  parseRange,
  getRevenue,
  getMargin,
  isOpen,
};
