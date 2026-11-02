const Activity = require('../models/Activity');
const Customer = require('../models/Customer');
const Employee = require('../models/Employee');
const Lead = require('../models/Lead');
const OPF = require('../models/OPF');
const { ownerScope } = require('../utils/accessScope');
const { getPermissionValue } = require('../middleware/authMiddleware');

const normalizeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const recordDate = (record) => {
  const date = new Date(record.createdDate || record.createdAt || '');
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getPeriodRange = (period, now) => {
  if (period === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)];
  if (period === 'quarter') {
    const quarterStart = Math.floor(now.getMonth() / 3) * 3;
    return [new Date(now.getFullYear(), quarterStart, 1), new Date(now.getFullYear(), quarterStart + 3, 1)];
  }
  if (period === 'year') return [new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear() + 1, 0, 1)];
  return null;
};

const inRange = (date, range) => Boolean(date && (!range || (date >= range[0] && date < range[1])));
const isQuotation = (lead) => Boolean(lead.quotationId || lead.leadStatus === 'Proposal Sent');
const isOpenOpportunity = (lead) => !isQuotation(lead) && !['Won', 'Lost', 'Scrapped'].includes(lead.leadStatus || '');
const fullAccess = (req) => req.user?.role === 'admin';
const canRead = (req, moduleName) => fullAccess(req) || getPermissionValue(req.user?.permissions, moduleName, 'view');

const getOPFRevenue = (opf) => {
  if (opf.revenue !== undefined && opf.revenue !== null && opf.revenue !== '') return normalizeNumber(opf.revenue);
  return normalizeNumber(opf.quantity) * normalizeNumber(opf.unitPrice)
    + normalizeNumber(opf.serviceCost)
    + normalizeNumber(opf.freightCost);
};

const getOPFMargin = (opf) => {
  if (opf.margin !== undefined && opf.margin !== null && opf.margin !== '') return normalizeNumber(opf.margin);
  return getOPFRevenue(opf)
    - normalizeNumber(opf.quantity) * normalizeNumber(opf.vendorPrice)
    - normalizeNumber(opf.serviceCost)
    - normalizeNumber(opf.freightCost);
};

const getProductRevenue = (product) => normalizeNumber(product.quantity) * normalizeNumber(product.unitPrice);
const getLocalDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const getInitials = (value) => String(value || '')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0] || '')
  .join('')
  .toUpperCase();

const followUpEntry = ({ id, category, title, detail, assignedTo, dueDate, href }) => ({
  id: String(id),
  category,
  title,
  detail,
  assignedTo: assignedTo || 'Unassigned',
  dueDate,
  href,
});

const filterCounts = (entries, now) => {
  const today = getLocalDate(now);
  return {
    all: entries.length,
    overdue: entries.filter((entry) => entry.dueDate < today).length,
    today: entries.filter((entry) => entry.dueDate === today).length,
    upcoming: entries.filter((entry) => entry.dueDate > today).length,
  };
};

const addToGroup = (groups, key, label, amount) => {
  const current = groups.get(key) || { label, revenue: 0 };
  current.revenue += amount;
  groups.set(key, current);
};

exports.getDashboard = async (req, res) => {
  try {
    const period = ['all', 'month', 'quarter', 'year'].includes(String(req.query.period)) ? String(req.query.period) : 'all';
    const now = new Date();
    const range = getPeriodRange(period, now);
    const year = now.getFullYear();
    const today = getLocalDate(now);
    const canReadLeads = canRead(req, 'leads');
    const canReadQuotations = canRead(req, 'quotations');
    const canReadActivities = canRead(req, 'activities');
    const canReadCustomers = canRead(req, 'customers');
    const canReadOPFs = canRead(req, 'opf');
    const canReadRenewals = canRead(req, 'renewals');
    const leadScope = ownerScope(req);
    const activityScope = ownerScope(req, {
      extraClauses: req.user?.name ? [{ assignedUser: req.user.name }] : [],
    });
    const customerScope = ownerScope(req, {
      extraClauses: req.user?.id ? [{ 'assignedEmployees.employeeId': String(req.user.id) }] : [],
    });
    const opfScope = ownerScope(req);

    const [leadRecords, opfRecords, activityRecords, customers, employee] = await Promise.all([
      canReadLeads || canReadQuotations
        ? Lead.find(leadScope)
          .select('leadId quotationId leadStatus companyName assignedTo createdBy createdDate createdAt followUpDate products quotationDetails isConverted isScrapped')
          .lean()
        : [],
      canReadOPFs || canReadRenewals
        ? OPF.find(opfScope)
          .select('opfNo quotationNumber quotationId customerName product quantity unitPrice vendorPrice revenue margin serviceCost freightCost createdBy createdDate createdAt renewalDate')
          .lean()
        : [],
      canReadActivities
        ? Activity.find({ $and: [{ deletedAt: null }, activityScope] })
          .select('activityId activityType activityDate followUpDate customerName company leadId status assignedUser createdBy createdAt')
          .sort({ createdAt: -1 })
          .lean()
        : [],
      canReadCustomers ? Customer.find(customerScope).select('status createdAt').lean() : [],
      /^[a-f\d]{24}$/i.test(String(req.user?.id || ''))
        ? Employee.findById(req.user.id).select('designation department branchCode profilePhoto').lean()
        : null,
    ]);

    const leads = canReadLeads ? leadRecords.filter((lead) => !isQuotation(lead)) : [];
    const quotations = canReadQuotations ? leadRecords.filter(isQuotation) : [];
    const opfs = canReadOPFs ? opfRecords : [];
    const renewals = canReadRenewals ? opfRecords : [];
    const currentYearLeadCount = leads.filter((lead) => recordDate(lead)?.getFullYear() === year).length;
    const previousYearLeadCount = leads.filter((lead) => recordDate(lead)?.getFullYear() === year - 1).length;
    const currentYearQuotationCount = quotations.filter((lead) => recordDate(lead)?.getFullYear() === year).length;
    const previousYearQuotationCount = quotations.filter((lead) => recordDate(lead)?.getFullYear() === year - 1).length;
    const currentYearOPFCount = opfs.filter((opf) => recordDate(opf)?.getFullYear() === year).length;
    const previousYearOPFCount = opfs.filter((opf) => recordDate(opf)?.getFullYear() === year - 1).length;
    const currentYearMeetings = activityRecords.filter((activity) =>
      /meeting/i.test(activity.activityType || '') && (dateValue(activity.activityDate) || recordDate(activity))?.getFullYear() === year
    ).length;
    const previousYearMeetings = activityRecords.filter((activity) =>
      /meeting/i.test(activity.activityType || '') && (dateValue(activity.activityDate) || recordDate(activity))?.getFullYear() === year - 1
    ).length;

    const monthlyOPFs = opfs.filter((opf) => {
      const date = recordDate(opf);
      return date && date.getFullYear() === year && date.getMonth() === now.getMonth();
    });
    const monthlyRevenue = monthlyOPFs.reduce((sum, opf) => sum + getOPFRevenue(opf), 0);
    const periodOPFs = opfs.filter((opf) => inRange(recordDate(opf), range));
    const periodLeads = [...leads, ...quotations].filter((lead) => inRange(recordDate(lead), range));

    const revenueByMonth = new Map();
    const startMonth = range
      ? new Date(range[0].getFullYear(), range[0].getMonth(), 1)
      : new Date(year, now.getMonth() - 11, 1);
    const endMonth = range
      ? new Date(range[1].getFullYear(), range[1].getMonth(), 1)
      : new Date(year, now.getMonth() + 1, 1);
    for (const cursor = new Date(startMonth); cursor < endMonth; cursor.setMonth(cursor.getMonth() + 1)) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      revenueByMonth.set(key, { month: key, funnelsCreated: 0, funnelsClosed: 0, revenue: 0, margin: 0 });
    }
    periodOPFs.forEach((opf) => {
      const date = recordDate(opf);
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const row = revenueByMonth.get(key);
      if (!row) return;
      row.revenue += getOPFRevenue(opf);
      row.margin += getOPFMargin(opf);
      row.funnelsClosed += 1;
    });
    periodLeads.filter((lead) => !isQuotation(lead)).forEach((lead) => {
      const date = recordDate(lead);
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const row = revenueByMonth.get(key);
      if (row) row.funnelsCreated += 1;
    });

    const productGroups = new Map();
    const customerGroups = new Map();
    const oemGroups = new Map();
    const oemByQuotation = new Map(leadRecords
      .filter((lead) => lead.quotationId)
      .map((lead) => [String(lead.quotationId), String(lead.quotationDetails?.oem || '').trim()]));
    periodOPFs.forEach((opf) => {
      const revenue = getOPFRevenue(opf);
      const productName = String(opf.product || '').trim();
      const customerName = String(opf.customerName || '').trim();
      const oemName = oemByQuotation.get(String(opf.quotationNumber || opf.quotationId || '')) || '';
      if (productName) addToGroup(productGroups, productName.toLowerCase(), productName, revenue);
      if (customerName) addToGroup(customerGroups, customerName.toLowerCase(), customerName, revenue);
      addToGroup(oemGroups, oemName.toLowerCase() || 'unspecified', oemName || 'OEM not recorded', revenue);
    });

    const percentageRows = (groups) => {
      const values = Array.from(groups.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
      const total = values.reduce((sum, row) => sum + row.revenue, 0);
      return values.map((row) => ({ ...row, percentage: total ? (row.revenue / total) * 100 : 0 }));
    };

    const activitiesByToday = activityRecords.filter((activity) =>
      getLocalDate(dateValue(activity.activityDate) || recordDate(activity) || new Date(0)) === today
    );
    const todayFunnelCount = leads.filter((lead) => getLocalDate(recordDate(lead) || new Date(0)) === today).length;
    const todayQuotationCount = quotations.filter((lead) => getLocalDate(recordDate(lead) || new Date(0)) === today).length;
    const todayOPFCount = opfs.filter((opf) => getLocalDate(recordDate(opf) || new Date(0)) === today).length;
    const todayCustomerCount = customers.filter((customer) => getLocalDate(recordDate(customer) || new Date(0)) === today).length;

    const followUps = [];
    if (canReadActivities) {
      activityRecords.forEach((activity) => {
        const dueDate = String(activity.followUpDate || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || activity.status === 'Completed') return;
        followUps.push(followUpEntry({
          id: activity._id,
          category: 'Activity',
          title: activity.activityType || 'Activity follow-up',
          detail: activity.customerName || activity.company || activity.leadId || 'Customer follow-up',
          assignedTo: activity.assignedUser || activity.createdBy,
          dueDate,
          href: `/sales/activities/edit/${activity._id}`,
        }));
      });
    }
    if (canReadLeads) {
      leads.forEach((lead) => {
        const dueDate = String(lead.followUpDate || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return;
        followUps.push(followUpEntry({
          id: lead._id,
          category: 'Lead',
          title: lead.leadId || 'Lead follow-up',
          detail: lead.companyName || 'Lead',
          assignedTo: lead.assignedTo || lead.createdBy,
          dueDate,
          href: `/sales/leads/${lead._id}`,
        }));
      });
      leads.forEach((lead) => {
        const dueDate = String(lead.quotationDetails?.expectedClosure || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return;
        followUps.push(followUpEntry({
          id: `${lead._id}-funnel`,
          category: 'Funnel',
          title: lead.quotationDetails?.stage || 'Expected closure',
          detail: lead.companyName || 'Opportunity',
          assignedTo: lead.assignedTo || lead.createdBy,
          dueDate,
          href: `/sales/funnels`,
        }));
      });
    }
    if (canReadRenewals) {
      renewals.forEach((opf) => {
        const dueDate = opf.renewalDate ? getLocalDate(new Date(opf.renewalDate)) : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return;
        followUps.push(followUpEntry({
          id: opf._id,
          category: 'Renewal',
          title: opf.opfNo || 'OPF renewal',
          detail: opf.customerName || 'Customer renewal',
          assignedTo: opf.createdBy,
          dueDate,
          href: `/sales/opf/${opf._id}`,
        }));
      });
    }
    followUps.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const counts = filterCounts(followUps, now);

    const openTasks = canReadActivities
      ? activityRecords.filter((activity) => !['Completed', 'Closed'].includes(activity.status || ''))
        .slice(0, 8)
        .map((activity) => ({
          id: String(activity.activityId || activity._id),
          assignedTo: activity.assignedUser || activity.createdBy || 'Unassigned',
          title: activity.activityType || 'Open activity',
          detail: activity.customerName || activity.company || activity.leadId || 'No customer details',
          dueDate: activity.followUpDate || '',
          href: `/sales/activities/edit/${activity._id}`,
        }))
      : [];

    const expectedClosures = canReadQuotations
      ? quotations.filter((lead) => dateValue(lead.quotationDetails?.expectedClosure))
        .sort((a, b) => dateValue(a.quotationDetails.expectedClosure) - dateValue(b.quotationDetails.expectedClosure))
        .slice(0, 12)
        .map((lead) => ({
          id: String(lead._id),
          quoteNumber: lead.quotationId || lead.leadId || '—',
          company: lead.companyName || '—',
          accountManager: lead.assignedTo || lead.createdBy || 'Unassigned',
          revenue: (lead.products || []).reduce((sum, product) => sum + getProductRevenue(product), 0)
            + normalizeNumber(lead.quotationDetails?.serviceCost)
            + normalizeNumber(lead.quotationDetails?.freightCost),
          expectedClosureDate: lead.quotationDetails.expectedClosure,
          productDetails: (lead.products || []).map((product) => product.productName).filter(Boolean).join(', ') || '—',
          href: `/sales/quotations/view/${lead._id}`,
        }))
      : [];

    const profileName = String(req.user?.name || req.user?.email || 'Sales user');
    const dashboard = {
      user: {
        name: profileName,
        email: String(req.user?.email || ''),
        role: String(req.user?.employeeType || req.user?.role || 'Sales'),
        designation: employee?.designation || '',
        department: employee?.department || 'Sales',
        branch: employee?.branchCode || '',
        photo: employee?.profilePhoto || '',
        initials: getInitials(profileName),
      },
      summary: {
        opportunities: { total: leads.length, currentYear: currentYearLeadCount, previousYear: previousYearLeadCount, open: leads.filter(isOpenOpportunity).length },
        quotations: { total: quotations.length, currentYear: currentYearQuotationCount, previousYear: previousYearQuotationCount, open: quotations.filter((lead) => !['Won', 'Lost', 'Scrapped'].includes(lead.leadStatus || '')).length },
        opfs: { total: opfs.length, currentYear: currentYearOPFCount, previousYear: previousYearOPFCount },
        meetings: {
          total: activityRecords.filter((activity) => /meeting/i.test(activity.activityType || '')).length,
          currentYear: currentYearMeetings,
          previousYear: previousYearMeetings,
        },
      },
      earnings: { target: null, achievement: monthlyRevenue, revenue: monthlyRevenue },
      followUps: { counts, records: followUps.slice(0, 100) },
      openTasks,
      analytics: {
        period,
        revenueTrend: Array.from(revenueByMonth.values()),
        oemSales: percentageRows(oemGroups),
        topProducts: percentageRows(productGroups),
        topCustomers: percentageRows(customerGroups),
        today: {
          customers: todayCustomerCount,
          funnels: todayFunnelCount,
          quotations: todayQuotationCount,
          opfs: todayOPFCount,
          activities: activitiesByToday.length,
        },
      },
      expectedClosures,
    };

    return res.status(200).json({ success: true, data: dashboard });
  } catch (error) {
    console.error('Failed to load Sales dashboard:', error);
    return res.status(500).json({ success: false, message: 'Unable to load Sales dashboard data.' });
  }
};
