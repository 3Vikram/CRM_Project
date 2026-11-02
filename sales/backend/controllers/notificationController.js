const Activity = require('../models/Activity');
const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const OPF = require('../models/OPF');
const { hasFullAccess, ownerScope } = require('../utils/accessScope');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const localDateString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const sameName = (left, right) => String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
const dateOnly = (value) => {
  const date = parseDate(value);
  return date ? localDateString(date) : '';
};
const safeSource = async (label, operation) => {
  try {
    return await operation();
  } catch (error) {
    console.error(`[Sales notifications] Unable to load ${label}:`, error);
    return [];
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const name = String(req.user?.name || '').trim();
    const id = String(req.user?.id || '');
    const fullAccess = hasFullAccess(req.user);
    const now = new Date();
    const todayStr = localDateString(now);
    const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(today0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAhead = new Date(today0);
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
    const myName = new RegExp(`^${escapeRegex(name)}$`, 'i');
    const items = [];

    const approvals = await safeSource('pending OPF approvals', () => OPF.find({
      $and: [ownerScope(req), { approvalStatus: { $in: ['Pending', 'Under Review'] } }],
    }).select('_id opfNo customerName createdBy createdDate approvalStatus').sort({ createdDate: -1 }).limit(20).lean());
    items.push(...approvals.map((opf) => ({
      id: `approval:${opf._id}:${opf.approvalStatus}`,
      category: 'Approval',
      module: 'OPF',
      title: fullAccess ? 'Approval required' : 'Waiting for approval',
      description: `OPF ${opf.opfNo || ''} · ${opf.customerName || ''} · ${opf.createdBy || ''}`,
      createdAt: (parseDate(opf.createdDate) || now).toISOString(),
      link: `/sales/opf/${opf._id}`,
      mine: fullAccess || sameName(opf.createdBy, name),
    })));

    const assignedLeads = await safeSource('lead assignments', () => Lead.find({
      assignedTo: { $regex: myName },
      isScrapped: { $ne: true },
      leadStatus: 'New',
      createdDate: { $gte: sevenDaysAgo },
    }).select('_id companyName contactPerson createdDate assignedTo').sort({ createdDate: -1 }).limit(20).lean());
    items.push(...assignedLeads.map((lead) => ({
      id: `lead-assigned:${lead._id}`,
      category: 'Assignment',
      module: 'Leads',
      title: 'Lead assigned to you',
      description: `${lead.companyName || ''} · ${lead.contactPerson || ''}`,
      createdAt: (parseDate(lead.createdDate) || now).toISOString(),
      link: '/sales/leads',
      mine: true,
    })));

    if (fullAccess) {
      const otherLeads = await safeSource('other lead assignments', () => Lead.find({
        assignedTo: { $nin: ['Unassigned', '', null], $not: myName },
        isScrapped: { $ne: true },
        leadStatus: 'New',
        createdDate: { $gte: sevenDaysAgo },
      }).select('_id companyName contactPerson createdDate assignedTo').sort({ createdDate: -1 }).limit(20).lean());
      items.push(...otherLeads.map((lead) => ({
        id: `lead-assigned:${lead._id}`,
        category: 'Assignment',
        module: 'Leads',
        title: `Lead assigned to ${lead.assignedTo}`,
        description: `${lead.companyName || ''} · ${lead.contactPerson || ''}`,
        createdAt: (parseDate(lead.createdDate) || now).toISOString(),
        link: '/sales/leads',
        mine: false,
      })));
    }

    const assignedCustomers = await safeSource('customer assignments', () => Customer.find({
      'assignedEmployees.employeeId': id,
      updatedAt: { $gte: sevenDaysAgo },
    }).select('_id companyName updatedAt').sort({ updatedAt: -1 }).limit(20).lean());
    items.push(...assignedCustomers.map((customer) => ({
      id: `customer-assigned:${customer._id}`,
      category: 'Assignment',
      module: 'Customers',
      title: 'Customer assigned to you',
      description: customer.companyName || '',
      createdAt: (parseDate(customer.updatedAt) || now).toISOString(),
      link: '/sales/customers',
      mine: true,
    })));

    const activityFollowUps = await safeSource('activity follow-ups', () => Activity.find({
      $and: [ownerScope(req), {
        status: { $ne: 'Completed' },
        followUpDate: { $nin: ['', null], $lte: todayStr },
      }],
    }).select('_id customerName company contactPerson followUpDate createdBy').sort({ followUpDate: -1 }).limit(20).lean());
    items.push(...activityFollowUps.map((activity) => ({
      id: `followup-activity:${activity._id}:${activity.followUpDate}`,
      category: 'Follow-up',
      module: 'Activities',
      title: activity.followUpDate < todayStr ? 'Follow-up overdue' : 'Follow-up due today',
      description: `${activity.customerName || activity.company || ''} · ${activity.contactPerson || ''} · ${activity.followUpDate}`,
      createdAt: (parseDate(activity.followUpDate) || now).toISOString(),
      link: '/sales/activities',
      mine: sameName(activity.createdBy, name),
    })));

    const leadFollowUps = await safeSource('lead follow-ups', () => Lead.find({
      $and: [
        { $or: [ownerScope(req), { assignedTo: myName }] },
        {
          leadStatus: { $nin: ['Won', 'Lost', 'Scrapped'] },
          isScrapped: { $ne: true },
          followUpDate: { $nin: ['', null], $lte: todayStr },
        },
      ],
    }).select('_id quotationId companyName contactPerson followUpDate assignedTo createdBy').sort({ followUpDate: -1 }).limit(20).lean());
    items.push(...leadFollowUps.map((lead) => ({
      id: `followup-lead:${lead._id}:${lead.followUpDate}`,
      category: 'Follow-up',
      module: lead.quotationId ? 'Funnels' : 'Leads',
      title: lead.followUpDate < todayStr ? 'Follow-up overdue' : 'Follow-up due today',
      description: `${lead.companyName || ''} · ${lead.contactPerson || ''} · ${lead.followUpDate}`,
      createdAt: (parseDate(lead.followUpDate) || now).toISOString(),
      link: '/sales/leads',
      mine: sameName(lead.assignedTo, name) || sameName(lead.createdBy, name),
    })));

    const renewals = await safeSource('OPF renewals', () => OPF.find({
      $and: [ownerScope(req), {
        amc: 'Yes',
        amcRenewalDate: { $ne: null, $lte: thirtyDaysAhead },
      }],
    }).select('_id opfNo customerName amcRenewalDate createdBy').sort({ amcRenewalDate: 1 }).limit(20).lean());
    items.push(...renewals.flatMap((opf) => {
      const renewalDate = parseDate(opf.amcRenewalDate);
      if (!renewalDate) return [];
      const renewalDateStr = localDateString(renewalDate);
      return [{
        id: `renewal:${opf._id}:${renewalDate.toISOString().slice(0, 10)}`,
        category: 'Renewal',
        module: 'OPF',
        title: renewalDateStr < todayStr ? 'Renewal overdue' : 'Renewal due',
        description: `OPF ${opf.opfNo || ''} · ${opf.customerName || ''} · ${String(renewalDate.getDate()).padStart(2, '0')}-${String(renewalDate.getMonth() + 1).padStart(2, '0')}-${renewalDate.getFullYear()}`,
        createdAt: renewalDate.toISOString(),
        link: '/sales/renewals',
        mine: sameName(opf.createdBy, name),
      }];
    }));

    const closureLeads = await safeSource('expected closures', () => Lead.find({
      $and: [ownerScope(req), {
        quotationId: { $exists: true, $nin: ['', null] },
        isScrapped: { $ne: true },
        leadStatus: { $nin: ['Won', 'Lost', 'Scrapped'] },
      }],
    }).select('_id quotationId companyName quotationDetails assignedTo createdBy').limit(200).lean());
    items.push(...closureLeads.flatMap((lead) => {
      const closureDate = dateOnly(lead.quotationDetails?.expectedClosure);
      if (!closureDate || closureDate > todayStr) return [];
      const parsedClosureDate = parseDate(lead.quotationDetails?.expectedClosure);
      if (!parsedClosureDate) return [];
      return [{
        id: `closure:${lead._id}:${closureDate}`,
        category: 'Closure',
        module: 'Quotations & Funnels',
        title: closureDate < todayStr ? 'Expected closure overdue' : 'Expected closure today',
        description: `${lead.quotationId} · ${lead.companyName || ''}`,
        createdAt: parsedClosureDate.toISOString(),
        link: `/sales/quotations/view/${lead._id}`,
        mine: sameName(lead.assignedTo, name) || sameName(lead.createdBy, name),
      }];
    }));

    items.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    const limitedItems = items.slice(0, 50);
    return res.json({
      success: true,
      data: limitedItems,
      counts: { all: limitedItems.length, mine: limitedItems.filter((item) => item.mine).length },
    });
  } catch (error) {
    console.error('[Sales notifications] Failed to load notifications:', error);
    return res.status(500).json({ success: false, message: 'Unable to load notifications.' });
  }
};
