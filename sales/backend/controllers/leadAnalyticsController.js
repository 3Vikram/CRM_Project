const Lead = require('../models/Lead');
const Activity = require('../models/Activity');
const Employee = require('../models/Employee');
const { ownerScope } = require('../utils/accessScope');

const LEAD_STATUSES = [
  'New',
  'Contacted',
  'Follow-up',
  'Interested',
  'Qualified',
  'Proposal Sent',
  'Negotiation',
  'Won',
  'Lost',
  'Scrapped',
];
const OPEN_STATUSES = new Set(LEAD_STATUSES.filter((status) => !['Won', 'Lost', 'Scrapped'].includes(status)));
const DAY_MS = 24 * 60 * 60 * 1000;

const isDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const dateKeyInKolkata = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const addDays = (dateKey, amount) => {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

const parseRange = (query, now = new Date()) => {
  const end = String(query.endDate || dateKeyInKolkata(now));
  const start = String(query.startDate || `${end.slice(0, 4)}-01-01`);
  return isDateKey(start) && isDateKey(end) && start <= end ? { start, end } : null;
};

const dateAtKolkataStart = (dateKey) => new Date(`${dateKey}T00:00:00.000+05:30`);
const getCreatedDate = (lead) => lead.createdDate || lead.createdAt || null;
const getLeadSource = (lead) => String(lead.sourceOfLead || lead.source || '').trim() || 'Not recorded';
const getLeadAgeDays = (lead, today) => {
  const created = new Date(getCreatedDate(lead) || '');
  if (Number.isNaN(created.getTime())) return null;
  const createdKey = dateKeyInKolkata(created);
  return Math.max(0, Math.floor((Date.parse(`${today}T00:00:00.000Z`) - Date.parse(`${createdKey}T00:00:00.000Z`)) / DAY_MS));
};
const isOpenLead = (lead) => OPEN_STATUSES.has(lead.leadStatus || 'New')
  && !lead.isConverted && !lead.isScrapped;
const getPipelineValue = (lead) => {
  const details = lead.quotationDetails || {};
  for (const rawValue of [details.value, details.revenue]) {
    if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') continue;
    const explicitValue = Number(rawValue);
    if (Number.isFinite(explicitValue)) return explicitValue;
  }
  if (Array.isArray(lead.products) && lead.products.length) {
    let hasCompleteValues = true;
    const productValue = lead.products.reduce((sum, product) => {
      if (product?.quantity === undefined || product?.quantity === null || String(product.quantity).trim() === ''
        || product?.unitPrice === undefined || product?.unitPrice === null || String(product.unitPrice).trim() === '') {
        hasCompleteValues = false;
        return sum;
      }
      const quantity = Number(product?.quantity);
      const unitPrice = Number(product?.unitPrice);
      if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) {
        hasCompleteValues = false;
        return sum;
      }
      return sum + quantity * unitPrice;
    }, 0);
    return hasCompleteValues ? productValue : null;
  }
  return null;
};

const getProductLabels = (lead) => {
  const products = Array.isArray(lead.products) ? lead.products : [];
  const labels = products.map((product) => String(product?.productName || product?.product || '').trim()).filter(Boolean);
  if (labels.length) return [...new Set(labels)];
  const sbu = String(lead.quotationDetails?.sbu || '').trim();
  return sbu ? [sbu] : [];
};

const hasTimelineAction = (lead, title) => Array.isArray(lead.timeline)
  && lead.timeline.some((entry) => String(entry?.title || '').trim().toLowerCase() === title.toLowerCase());

const buildLeadAnalytics = ({ leads, activities, employees, filters, range, today }) => {
  const selected = leads.filter((lead) => {
    const created = new Date(getCreatedDate(lead) || '');
    if (Number.isNaN(created.getTime())) return false;
    const createdKey = dateKeyInKolkata(created);
    return createdKey >= range.start && createdKey <= range.end
      && (filters.status === 'All' || (lead.leadStatus || 'New') === filters.status)
      && (filters.source === 'All' || getLeadSource(lead) === filters.source)
      && (!filters.employeeId || String(lead.assignedToId || '') === filters.employeeId)
      && (!filters.employeeName || String(lead.assignedTo || '') === filters.employeeName);
  });
  const selectedOpen = selected.filter(isOpenLead);
  const converted = selected.filter((lead) => lead.isConverted || lead.leadStatus === 'Won');
  const sourceCounts = new Map();
  const monthCounts = new Map();
  const employeeGroups = new Map();
  const funnelCounts = new Map();
  const productGroups = new Map();
  const ageGroups = [
    { age: '0–7 days', min: 0, max: 7, count: 0 },
    { age: '8–15 days', min: 8, max: 15, count: 0 },
    { age: '16–30 days', min: 16, max: 30, count: 0 },
    { age: '31–60 days', min: 31, max: 60, count: 0 },
    { age: 'More than 60 days', min: 61, max: Infinity, count: 0 },
  ];
  const activityLeadReferences = new Set();
  const leadRefToId = new Map();
  selected.forEach((lead) => {
    leadRefToId.set(String(lead._id), String(lead._id));
    if (lead.leadId) leadRefToId.set(String(lead.leadId), String(lead._id));
  });
  activities.forEach((activity) => {
    const leadId = leadRefToId.get(String(activity.leadId || ''));
    if (leadId) activityLeadReferences.add(leadId);
  });

  const currentMonth = today.slice(0, 7);
  const thisMonthStart = `${currentMonth}-01`;
  const firstMonthDate = new Date(`${range.start.slice(0, 7)}-01T00:00:00.000Z`);
  const lastMonthDate = new Date(`${range.end.slice(0, 7)}-01T00:00:00.000Z`);
  for (const lead of selected) {
    const source = getLeadSource(lead);
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    const created = new Date(getCreatedDate(lead));
    const monthKey = dateKeyInKolkata(created).slice(0, 7);
    monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1);
    const assignedTo = String(lead.assignedTo || '').trim() || 'Unassigned';
    const employeeKey = String(lead.assignedToId || assignedTo);
    const employee = employeeGroups.get(employeeKey) || {
      employeeId: String(lead.assignedToId || ''),
      employee: assignedTo,
      leadCount: 0,
      pipelineValue: 0,
      pipelineValueCount: 0,
    };
    employee.leadCount += 1;
    const pipelineValue = getPipelineValue(lead);
    if (pipelineValue !== null) {
      employee.pipelineValue += pipelineValue;
      employee.pipelineValueCount += 1;
    }
    employeeGroups.set(employeeKey, employee);
    const stage = lead.leadStatus || 'New';
    funnelCounts.set(stage, (funnelCounts.get(stage) || 0) + 1);

    for (const label of getProductLabels(lead)) {
      const productKey = label.toLocaleLowerCase();
      const group = productGroups.get(productKey) || { name: label, total: 0, converted: 0, scrapped: 0 };
      group.total += 1;
      if (lead.isConverted || stage === 'Won') group.converted += 1;
      if (lead.isScrapped || stage === 'Scrapped') group.scrapped += 1;
      productGroups.set(productKey, group);
    }
  }

  const leadAges = [];
  for (const lead of selectedOpen) {
    const ageDays = getLeadAgeDays(lead, today);
    if (ageDays === null) continue;
    leadAges.push(ageDays);
    const group = ageGroups.find((item) => ageDays >= item.min && ageDays <= item.max);
    if (group) group.count += 1;
  }
  const openCount = selectedOpen.length;
  const overdueFollowUps = selectedOpen.filter((lead) => isDateKey(lead.followUpDate) && lead.followUpDate < today).length;
  const unscheduledFollowUps = selectedOpen.filter((lead) => !isDateKey(lead.followUpDate)).length;
  const expiringFollowUps = selectedOpen.filter((lead) => isDateKey(lead.followUpDate)
    && lead.followUpDate >= today && lead.followUpDate <= addDays(today, 7)).length;
  const leadsThisMonth = selected.filter((lead) => {
    const created = new Date(getCreatedDate(lead) || '');
    if (Number.isNaN(created.getTime())) return false;
    const createdKey = dateKeyInKolkata(created);
    return createdKey >= thisMonthStart && createdKey <= today;
  }).length;
  const monthlyFollowUps = selected.filter((lead) => isDateKey(lead.followUpDate)
    && lead.followUpDate.slice(0, 7) === currentMonth).length;
  const funnelStages = ['New', 'Contacted', 'Follow-up', 'Interested', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Scrapped'];
  const monthlyTrend = [];
  for (let date = new Date(firstMonthDate); date <= lastMonthDate; date.setUTCMonth(date.getUTCMonth() + 1)) {
    const month = date.toISOString().slice(0, 7);
    monthlyTrend.push({
      month,
      label: date.toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
      count: monthCounts.get(month) || 0,
    });
  }
  const convertedToFunnel = selected.filter((lead) => hasTimelineAction(lead, 'Moved to funnel')).length;
  const convertedToQuotation = selected.filter((lead) => hasTimelineAction(lead, 'Quotation generated')).length;

  return {
    filters: { ...filters },
    range,
    kpis: {
      totalLeads: selected.length,
      openLeads: openCount,
      conversionRate: selected.length ? Math.round((converted.length / selected.length) * 1000) / 10 : 0,
      expiringFollowUps,
      leadsThisMonth,
      convertedToActivity: activityLeadReferences.size,
      convertedToFunnel,
      convertedToQuotation,
      leadsScrapped: selected.filter((lead) => lead.isScrapped || lead.leadStatus === 'Scrapped').length,
      monthlyFollowUps,
    },
    charts: {
      leadsBySource: [...sourceCounts.entries()].map(([source, count]) => ({ source, count }))
        .sort((left, right) => right.count - left.count || left.source.localeCompare(right.source)),
      monthlyTrend,
      topEmployees: [...employeeGroups.values()].map((employee) => ({
        ...employee,
        employee: employees.get(employee.employeeId) || employee.employee,
        pipelineValueAvailable: employee.pipelineValueCount === employee.leadCount,
        pipelineValue: employee.pipelineValueCount === employee.leadCount ? employee.pipelineValue : null,
      })).sort((left, right) => right.leadCount - left.leadCount || left.employee.localeCompare(right.employee)).slice(0, 10),
      leadFunnel: funnelStages.map((stage) => ({
        stage,
        count: funnelCounts.get(stage) || 0,
        percent: selected.length ? Math.round(((funnelCounts.get(stage) || 0) / selected.length) * 1000) / 10 : 0,
      })),
      followUpAnalysis: { overdue: overdueFollowUps, unscheduled: unscheduledFollowUps },
      leadAging: {
        groups: ageGroups.map(({ age, count }) => ({
          age,
          count,
          percent: openCount ? Math.round((count / openCount) * 1000) / 10 : 0,
        })),
        activeWithin15Days: leadAges.filter((age) => age <= 15).length,
        staleMoreThan30Days: leadAges.filter((age) => age > 30).length,
        totalOpenLeads: openCount,
        averageLeadAge: leadAges.length ? Math.round((leadAges.reduce((sum, age) => sum + age, 0) / leadAges.length) * 10) / 10 : null,
      },
      productAnalysis: [...productGroups.values()].map((group) => ({
        ...group,
        conversionPercent: group.total ? Math.round((group.converted / group.total) * 1000) / 10 : 0,
      })).sort((left, right) => right.total - left.total || left.name.localeCompare(right.name)),
      productAvailable: selected.some((lead) => getProductLabels(lead).length > 0),
      pipelineValueAvailable: [...employeeGroups.values()].some((employee) => employee.pipelineValueCount === employee.leadCount),
    },
  };
};

const getLeadAnalytics = async (req, res) => {
  const status = String(req.query.status || 'All');
  const source = String(req.query.source || 'All');
  const employeeId = String(req.query.employeeId || '').trim();
  const employeeName = String(req.query.employeeName || '').trim();
  if (status !== 'All' && !LEAD_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: 'Select a valid lead status.' });
  }
  const range = parseRange(req.query);
  if (!range) return res.status(400).json({ success: false, message: 'Enter a valid lead analytics date range.' });
  const today = dateKeyInKolkata(new Date());
  const start = dateAtKolkataStart(range.start);
  const end = dateAtKolkataStart(addDays(range.end, 1));

  try {
    const queryConditions = [
      ownerScope(req),
      req.leadResourceFilter || {},
      { $or: [
        { createdDate: { $gte: start, $lt: end } },
        { createdDate: { $in: [null] }, createdAt: { $gte: start, $lt: end } },
      ] },
    ];
    const leads = await Lead.find({ $and: queryConditions })
      .select('_id leadId leadStatus source sourceOfLead assignedTo assignedToId createdDate createdAt followUpDate isConverted isScrapped quotationId quotationDetails products timeline')
      .lean();
    const references = [...new Set(leads.flatMap((lead) => [String(lead._id), String(lead.leadId || '')]).filter(Boolean))];
    const activityQuery = {
      $and: [
        { deletedAt: null },
        ownerScope(req),
        { leadId: { $in: references } },
      ],
    };
    const activities = references.length
      ? await Activity.find(activityQuery).select('leadId').lean()
      : [];
    const employeeIds = [...new Set(leads.map((lead) => String(lead.assignedToId || '').trim())
      .filter((id) => /^[a-f\d]{24}$/i.test(id)))];
    const employeeRecords = employeeIds.length
      ? await Employee.find({ _id: { $in: employeeIds } }).select('employeeName fullName').lean()
      : [];
    const employeeNames = new Map(employeeRecords.map((employee) => [
      String(employee._id),
      String(employee.employeeName || employee.fullName || ''),
    ]));
    const availableStatuses = LEAD_STATUSES.filter((stage) => leads.some((lead) => lead.leadStatus === stage));
    const availableSources = [...new Set(leads.map(getLeadSource))]
      .sort((left, right) => left.localeCompare(right));
    const availableEmployees = [...new Map(leads.map((lead) => {
      const id = String(lead.assignedToId || '');
      return [id || String(lead.assignedTo || 'Unassigned'), {
        id,
        name: employeeNames.get(id) || String(lead.assignedTo || 'Unassigned'),
      }];
    })).values()].sort((left, right) => left.name.localeCompare(right.name));

    const data = buildLeadAnalytics({
      leads,
      activities,
      employees: employeeNames,
      filters: { status, source, employeeId, employeeName },
      range,
      today,
    });
    return res.status(200).json({
      success: true,
      data: {
        ...data,
        filters: {
          ...data.filters,
          availableStatuses,
          availableSources,
          availableEmployees,
        },
      },
    });
  } catch (error) {
    console.error('Unable to load lead analytics:', error);
    return res.status(500).json({ success: false, message: 'Unable to load lead analytics.' });
  }
};

module.exports = {
  getLeadAnalytics,
  _buildLeadAnalytics: buildLeadAnalytics,
  _parseLeadAnalyticsRange: parseRange,
  _getPipelineValue: getPipelineValue,
};
