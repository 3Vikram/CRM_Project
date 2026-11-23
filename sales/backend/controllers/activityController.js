const Activity = require('../models/Activity');
const Lead = require('../models/Lead');
const Employee = require('../models/Employee');
const { ownerScope, creatorFields, resolveActivityEmployeeNames } = require('../utils/accessScope');
const {
  addDateDays,
  getDateOnly,
  getEffectiveStatus,
  getTodayInKolkata,
  matchesEffectiveStatus,
  validateOutcome,
} = require('../utils/activityStatus');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const companyNameQuery = (companyName) => {
  const companyRegex = new RegExp(`^\\s*${escapeRegex(companyName.trim())}\\s*$`, 'i');
  return {
    $or: [
      { company: companyRegex },
      { company: { $in: [null, ''] }, customerName: companyRegex },
    ],
  };
};

const buildTimeline = (title, description, type = 'info') => ({
  title,
  description,
  type,
  createdAt: new Date().toISOString(),
});

const normalizeActivity = (activity, today) => ({
  ...activity,
  _id: activity._id?.toString?.() || '',
  activityId: activity.activityId || '',
  leadId: activity.leadId || '',
  leadSource: activity.leadSource || '',
  customerName: activity.customerName || '',
  contactPerson: activity.contactPerson || '',
  designation: activity.designation || '',
  email: activity.email || '',
  mobileNo: activity.mobileNo || '',
  sourceOfLead: activity.sourceOfLead || '',
  customerRequirements: activity.customerRequirements || '',
  customerRemarks: activity.customerRemarks || '',
  assignedUser: activity.assignedUser || '',
  assignedUserId: activity.assignedUserId || '',
  leadIdLabel: activity.leadIdLabel || '',
  company: activity.company || '',
  priority: activity.priority || 'Medium',
  campaign: activity.campaign || '',
  activityType: activity.activityType || '',
  activityDate: activity.activityDate || '',
  location: activity.location || '',
  response: activity.response || '',
  followUp: activity.followUp || '',
  product: activity.product || '',
  tagResource: activity.tagResource || '',
  followUpDate: activity.followUpDate || '',
  
  reminder: activity.reminder || '',
  status: activity.status || 'Open',
  effectiveStatus: getEffectiveStatus(activity, today),
  createdBy: activity.createdBy || 'Current User',
  createdById: activity.createdById || '',
  lastModifiedBy: activity.lastModifiedBy || 'Current User',
});

const safeParseInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getActivityDateRange = (preset = '', customDate = '') => {
  const today = getTodayInKolkata();
  const [year, month] = today.split('-').map(Number);
  const toRange = (date) => {
    if (!date) return null;
    return { $gte: date, $lte: `${date}\uffff` };
  };

  if (preset === 'today') return toRange(today);
  if (preset === 'yesterday') return toRange(addDateDays(today, -1));
  if (preset === 'this-week') {
    const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
    return { $gte: addDateDays(today, -weekday), $lte: `${today}\uffff` };
  }
  if (preset === 'this-month') {
    return { $gte: `${year}-${String(month).padStart(2, '0')}-01`, $lte: `${today}\uffff` };
  }
  if (preset === 'this-quarter') {
    const firstMonth = Math.floor((month - 1) / 3) * 3 + 1;
    return { $gte: `${year}-${String(firstMonth).padStart(2, '0')}-01`, $lte: `${today}\uffff` };
  }
  if (preset === 'this-year') {
    return { $gte: `${year}-01-01`, $lte: `${today}\uffff` };
  }
  if (preset === 'last-year') {
    const lastYear = year - 1;
    return { $gte: `${lastYear}-01-01`, $lte: `${lastYear}-12-31\uffff` };
  }
  if (preset === 'custom-date' && customDate) {
    return toRange(getDateOnly(customDate));
  }
  return null;
};

const generateActivityId = async () => {
  const existingIds = await Activity.find({ deletedAt: null, activityId: /^ACT-\d+$/ }, { activityId: 1 }).lean();
  const highest = existingIds.reduce((max, activity) => {
    const numericPart = Number(String(activity.activityId).slice(4));
    return Number.isSafeInteger(numericPart) ? Math.max(max, numericPart) : max;
  }, 0);
  return `ACT-${highest + 1}`;
};

const isMongoId = (value) => /^[a-f\d]{24}$/i.test(String(value || '').trim());

const findActiveSalesEmployee = (employeeId) => {
  if (!isMongoId(employeeId)) return null;
  return Employee.findOne({
    _id: String(employeeId).trim(),
    status: /^active$/i,
    department: /^sales$/i,
  }).lean();
};

const findLeadEmployee = async (lead) => {
  if (isMongoId(lead.assignedToId)) {
    const employee = await Employee.findOne({
      _id: lead.assignedToId,
      status: /^active$/i,
      department: /^sales$/i,
    }).lean();
    if (employee) return employee;
  }
  const name = String(lead.assignedTo || '').trim();
  if (!name) return null;
  return Employee.findOne({
    $or: [
      { employeeName: new RegExp(`^${escapeRegex(name)}$`, 'i') },
      { fullName: new RegExp(`^${escapeRegex(name)}$`, 'i') },
      { email: new RegExp(`^${escapeRegex(name)}$`, 'i') },
    ],
    status: /^active$/i,
    department: /^sales$/i,
  }).lean();
};

exports.getActivities = async (req, res) => {
  try {
    const {
      search = '',
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status = '',
      createdBy = '',
      createdById = '',
      customerName = '',
      activityDatePreset = '',
      followUpPreset = '',
      response = '',
      activityId = '',
      customer = '',
    } = req.query;

    const conditions = [{ deletedAt: null }];
    if (createdById) {
      conditions.push({
        $or: [
          { createdById },
          { createdById: { $in: [null, ''] }, createdBy },
        ],
      });
    } else if (createdBy) {
      conditions.push({ createdBy });
    }
    if (customerName) conditions.push({ customerName });
    if (response) conditions.push({ response });
    if (activityId) conditions.push({ activityId });
    if (customer) conditions.push({ customerName: customer });

    const activityDateRange = getActivityDateRange(activityDatePreset, req.query.customDate || '');
    if (activityDateRange) conditions.push({ activityDate: activityDateRange });

    const followUpDateRange = getActivityDateRange(followUpPreset, req.query.customFollowUpDate || '');
    if (followUpDateRange) conditions.push({ followUpDate: followUpDateRange });

    if (search) {
      const regex = new RegExp(escapeRegex(String(search)), 'i');
      conditions.push({ $or: [
        { activityId: regex },
        { customerName: regex },
        { leadId: regex },
        { company: regex },
        { assignedUser: regex },
        { activityType: regex },
        { activityDate: regex },
        { followUpDate: regex },
        { product: regex },
        { customerRequirements: regex },
        { customerRemarks: regex },
        { status: regex },
        { contactPerson: regex },
        { email: regex },
        { mobileNo: regex },
      ] });
    }
    const scope = ownerScope(req);
    if (Object.keys(scope).length) conditions.push(scope);
    const finalQuery = { $and: conditions };

    const pageNum = Math.max(safeParseInt(page, 1), 1);
    const limitNum = Math.min(Math.max(safeParseInt(limit, 10), 1), 100);
    const skip = (pageNum - 1) * limitNum;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortField = sortBy || 'createdAt';

    const today = getTodayInKolkata();
    let activities;
    let total;
    if (status) {
      total = 0;
      activities = [];
      const cursor = Activity.find(finalQuery).sort({ [sortField]: sortDirection }).lean().cursor();
      for await (const activity of cursor) {
        const normalizedActivity = normalizeActivity(activity, today);
        if (!matchesEffectiveStatus(normalizedActivity.effectiveStatus, String(status))) continue;
        if (total >= skip && total < skip + limitNum) activities.push(normalizedActivity);
        total += 1;
      }
    } else {
      [activities, total] = await Promise.all([
        Activity.find(finalQuery).sort({ [sortField]: sortDirection }).skip(skip).limit(limitNum).lean(),
        Activity.countDocuments(finalQuery),
      ]);
      activities = activities.map((activity) => normalizeActivity(activity, today));
    }

    res.status(200).json({
      success: true,
      data: await resolveActivityEmployeeNames(activities),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Unable to load activities' });
  }
};

exports.getActivityById = async (req, res) => {
  try {
    const activity = await Activity.findOne({ $and: [{ _id: req.params.id, deletedAt: null }, ownerScope(req)] }).lean();
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });
    res.status(200).json({ success: true, data: await resolveActivityEmployeeNames(normalizeActivity(activity, getTodayInKolkata())) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Unable to load activity' });
  }
};

exports.checkActivityCompany = async (req, res) => {
  const companyName = String(req.query.companyName || '').trim();
  if (!companyName) {
    return res.status(400).json({ success: false, message: 'Company Name is required.' });
  }

  try {
    const activity = await Activity.findOne({
      deletedAt: null,
      ...companyNameQuery(companyName),
    }).select('_id').lean();
    return res.status(200).json({ success: true, exists: Boolean(activity) });
  } catch (error) {
    console.error('Activity company validation failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to validate company name.' });
  }
};

exports.createActivity = async (req, res) => {
  try {
    const companyName = String(String(req.body.company || '').trim() || req.body.customerName || '').trim();
    const payload = {
      activityId: '',
      leadId: req.body.leadId || '',
      leadSource: req.body.leadSource || 'Lead',
      customerName: req.body.customerName || '',
      contactPerson: req.body.contactPerson || '',
      designation: req.body.designation || '',
      email: req.body.email || '',
      mobileNo: req.body.mobileNo || '',
      sourceOfLead: req.body.sourceOfLead || '',
      customerRequirements: req.body.customerRequirements || '',
      customerRemarks: req.body.customerRemarks || '',
      assignedUser: '',
      assignedUserId: '',
      leadIdLabel: req.body.leadIdLabel || '',
      company: companyName,
      priority: req.body.priority || 'Medium',
      campaign: req.body.campaign || '',
      activityType: req.body.activityType || '',
      activityDate: req.body.activityDate || '',
      location: req.body.location || '',
      response: req.body.response || '',
      followUp: req.body.followUp || '',
      product: req.body.product || '',
      tagResource: req.body.tagResource || '',
      followUpDate: req.body.followUpDate || '',
      
      reminder: req.body.reminder || '',
      status: req.body.status || 'Open',
      createdBy: creatorFields(req).createdBy,
      lastModifiedBy: req.body.lastModifiedBy || 'Current User',
    };
    Object.assign(payload, creatorFields(req));

    if ([payload.customerName, payload.activityType, payload.activityDate, payload.product]
      .some((value) => !String(value || '').trim())) {
      return res.status(400).json({ success: false, message: 'Customer / Partner Name, Activity Type, Activity Date, and Product are required.' });
    }
    const validationMessage = validateOutcome(payload);
    if (validationMessage) return res.status(400).json({ success: false, message: validationMessage });

    let linkedLead = null;
    if (payload.leadId) {
      const leadLookup = [{ leadId: String(payload.leadId).trim() }];
      if (/^[a-f\d]{24}$/i.test(String(payload.leadId).trim())) {
        leadLookup.push({ _id: String(payload.leadId).trim() });
      }
      linkedLead = await Lead.findOne({
        $and: [
          { $or: leadLookup },
          ownerScope(req),
        ],
      });
      if (!linkedLead) return res.status(404).json({ success: false, message: 'Lead not found.' });
      const leadEmployee = await findLeadEmployee(linkedLead);
      const selectedEmployee = leadEmployee || await findActiveSalesEmployee(req.body.assignedUserId);
      if (!selectedEmployee) {
        return res.status(400).json({ success: false, message: 'Please select an active Sales employee for Assigned To.' });
      }
      payload.assignedUserId = String(selectedEmployee._id);
      payload.assignedUser = selectedEmployee.employeeName || selectedEmployee.fullName || selectedEmployee.email;
    } else {
      const assignedEmployee = await findActiveSalesEmployee(req.body.assignedUserId);
      if (!assignedEmployee) {
        return res.status(400).json({ success: false, message: 'Please select an active Sales employee for Assigned To.' });
      }
      payload.assignedUserId = String(assignedEmployee._id);
      payload.assignedUser = assignedEmployee.employeeName || assignedEmployee.fullName || assignedEmployee.email;
    }

    const existingCompanyActivity = await Activity.findOne({
      deletedAt: null,
      ...companyNameQuery(companyName),
    }).select('_id').lean();
    if (existingCompanyActivity) {
      return res.status(409).json({ success: false, message: 'This company already exists.' });
    }

    let activity;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        activity = await Activity.create({ ...payload, activityId: payload.activityId || await generateActivityId() });
        break;
      } catch (error) {
        if (error?.code !== 11000 || attempt === 4) throw error;
      }
    }

    if (linkedLead) {
      if (linkedLead.leadStatus !== 'Won' && linkedLead.leadStatus !== 'Lost') {
        linkedLead.leadStatus = 'Follow-up Scheduled';
      }
      linkedLead.timeline = linkedLead.timeline || [];
      linkedLead.timeline.unshift(buildTimeline('Activity Created', `Lead moved to Activity module. Activity Type: ${payload.activityType || 'Meeting'}`, 'info'));
      await linkedLead.save();
    }

    res.status(201).json({ success: true, message: 'Activity created successfully.', data: normalizeActivity(activity.toObject(), getTodayInKolkata()) });
  } catch (error) {
    console.error('Activity creation failed:', error);
    res.status(500).json({ success: false, message: error.message || 'Unable to create activity' });
  }
};

exports.updateActivity = async (req, res) => {
  try {
    const activity = await Activity.findOne({ $and: [{ _id: req.params.id, deletedAt: null }, ownerScope(req)] });
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });
    if (activity.status === 'Completed' && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only an administrator can modify a completed activity.' });
    }

    const payload = { ...req.body };
    delete payload.createdBy;
    delete payload.createdById;
    if (!payload.assignedUserId) {
      return res.status(400).json({ success: false, message: 'Please select an active Sales employee for Assigned To.' });
    }
    const assignedEmployee = await findActiveSalesEmployee(payload.assignedUserId);
    if (!assignedEmployee) {
      return res.status(400).json({ success: false, message: 'Please select an active Sales employee for Assigned To.' });
    }
    payload.assignedUserId = String(assignedEmployee._id);
    payload.assignedUser = assignedEmployee.employeeName || assignedEmployee.fullName || assignedEmployee.email;
    const validationMessage = validateOutcome({ ...activity.toObject(), ...payload });
    if (validationMessage) return res.status(400).json({ success: false, message: validationMessage });
    Object.assign(activity, payload);
    activity.lastModifiedBy = req.body.lastModifiedBy || 'Current User';
    await activity.save();

    res.status(200).json({ success: true, message: 'Activity updated successfully.', data: normalizeActivity(activity.toObject(), getTodayInKolkata()) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Unable to update activity' });
  }
};

exports.deleteActivity = async (req, res) => {
  try {
    const activity = await Activity.findOne({ $and: [{ _id: req.params.id, deletedAt: null }, ownerScope(req)] });
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });
    activity.deletedAt = new Date();
    await activity.save();
    res.status(200).json({ success: true, message: 'Activity deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Unable to delete activity' });
  }
};
