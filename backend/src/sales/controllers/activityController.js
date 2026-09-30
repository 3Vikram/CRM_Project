const Activity = require('../models/Activity');
const Lead = require('../models/Lead');

const buildTimeline = (title, description, type = 'info') => ({
  title,
  description,
  type,
  createdAt: new Date().toISOString(),
});

const normalizeActivity = (activity) => ({
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
  createdBy: activity.createdBy || 'Current User',
  lastModifiedBy: activity.lastModifiedBy || 'Current User',
});

const safeParseInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getActivityDateRange = (preset = '', customDate = '') => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const toRange = (date) => {
    const formatted = formatDateString(date);
    return { $gte: formatted, $lte: `${formatted}\uffff` };
  };

  if (preset === 'today') return toRange(startOfDay);
  if (preset === 'yesterday') {
    const yesterday = new Date(startOfDay);
    yesterday.setDate(yesterday.getDate() - 1);
    return toRange(yesterday);
  }
  if (preset === 'this-week') {
    const first = new Date(startOfDay);
    first.setDate(first.getDate() - first.getDay());
    return { $gte: formatDateString(first), $lte: `${formatDateString(startOfDay)}\uffff` };
  }
  if (preset === 'this-month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { $gte: formatDateString(first), $lte: `${formatDateString(startOfDay)}\uffff` };
  }
  if (preset === 'this-quarter') {
    const quarter = Math.floor(now.getMonth() / 3);
    const first = new Date(now.getFullYear(), quarter * 3, 1);
    return { $gte: formatDateString(first), $lte: `${formatDateString(startOfDay)}\uffff` };
  }
  if (preset === 'this-year') {
    const first = new Date(now.getFullYear(), 0, 1);
    return { $gte: formatDateString(first), $lte: `${formatDateString(startOfDay)}\uffff` };
  }
  if (preset === 'last-year') {
    const first = new Date(now.getFullYear() - 1, 0, 1);
    const last = new Date(now.getFullYear() - 1, 11, 31);
    return { $gte: formatDateString(first), $lte: `${formatDateString(last)}\uffff` };
  }
  if (preset === 'custom-date' && customDate) {
    const date = new Date(customDate);
    if (!Number.isNaN(date.getTime())) {
      return toRange(date);
    }
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
      customerName = '',
      activityDatePreset = '',
      followUpPreset = '',
      response = '',
      activityId = '',
      customer = '',
    } = req.query;

    const query = { deletedAt: null };
    if (status) query.status = status;
    if (createdBy) query.createdBy = createdBy;
    if (customerName) query.customerName = customerName;
    if (response) query.response = response;
    if (activityId) query.activityId = activityId;
    if (customer) query.customerName = customer;

    const activityDateRange = getActivityDateRange(activityDatePreset, req.query.customDate || '');
    if (activityDateRange) query.activityDate = activityDateRange;

    const followUpDateRange = getActivityDateRange(followUpPreset, req.query.customFollowUpDate || '');
    if (followUpDateRange) query.followUpDate = followUpDateRange;

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { activityId: regex },
        { customerName: regex },
        { leadId: regex },
        { company: regex },
        { contactPerson: regex },
        { email: regex },
        { mobileNo: regex },
      ];
    }

    const pageNum = Math.max(safeParseInt(page, 1), 1);
    const limitNum = Math.min(Math.max(safeParseInt(limit, 10), 1), 100);
    const skip = (pageNum - 1) * limitNum;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortField = sortBy || 'createdAt';

    const [activities, total] = await Promise.all([
      Activity.find(query).sort({ [sortField]: sortDirection }).skip(skip).limit(limitNum).lean(),
      Activity.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: activities.map(normalizeActivity),
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
    const activity = await Activity.findOne({ _id: req.params.id, deletedAt: null }).lean();
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });
    res.status(200).json({ success: true, data: normalizeActivity(activity) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Unable to load activity' });
  }
};

exports.createActivity = async (req, res) => {
  try {
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
      assignedUser: req.body.assignedUser || '',
      leadIdLabel: req.body.leadIdLabel || '',
      company: req.body.company || '',
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
      createdBy: req.body.createdBy || 'Current User',
      lastModifiedBy: req.body.lastModifiedBy || 'Current User',
    };

    if (!payload.customerName || !payload.activityType || !payload.activityDate || !payload.product) {
      return res.status(400).json({ success: false, message: 'Customer / Partner Name, Activity Type, Activity Date, and Product are required.' });
    }

    const existingOpenActivity = await Activity.findOne({ leadId: payload.leadId, deletedAt: null, status: { $in: ['Open', 'Pending'] } }).lean();

    if (payload.leadId && existingOpenActivity) {
      return res.status(409).json({
        success: false,
        message: 'Activity already exists for this Lead.',
        existingActivityId: existingOpenActivity.activityId || existingOpenActivity._id?.toString?.(),
      });
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

    if (payload.leadId) {
      const lead = await Lead.findOne({ leadId: payload.leadId }).lean();
      if (lead) {
        if (lead.leadStatus !== 'Won' && lead.leadStatus !== 'Lost') {
          lead.leadStatus = 'Follow-up Scheduled';
        }
        lead.timeline = lead.timeline || [];
        lead.timeline.unshift(buildTimeline('Activity Created', `Lead moved to Activity module. Activity Type: ${payload.activityType || 'Meeting'}`, 'info'));
        await Lead.findByIdAndUpdate(lead._id, lead, { new: true });
      }
    }

    res.status(201).json({ success: true, message: 'Activity created successfully.', data: normalizeActivity(activity.toObject()) });
  } catch (error) {
    console.error('Activity creation failed:', error);
    res.status(500).json({ success: false, message: error.message || 'Unable to create activity' });
  }
};

exports.updateActivity = async (req, res) => {
  try {
    const activity = await Activity.findOne({ _id: req.params.id, deletedAt: null });
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });

    Object.assign(activity, req.body);
    activity.lastModifiedBy = req.body.lastModifiedBy || 'Current User';
    await activity.save();

    res.status(200).json({ success: true, message: 'Activity updated successfully.', data: normalizeActivity(activity.toObject()) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Unable to update activity' });
  }
};

exports.deleteActivity = async (req, res) => {
  try {
    const activity = await Activity.findOne({ _id: req.params.id, deletedAt: null });
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });
    activity.deletedAt = new Date();
    await activity.save();
    res.status(200).json({ success: true, message: 'Activity deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Unable to delete activity' });
  }
};
