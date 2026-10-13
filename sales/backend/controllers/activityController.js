const Activity = require('../models/Activity');
const Lead = require('../models/Lead');

const sortableFields = new Set([...Activity.fields, 'id', 'createdAt', 'updatedAt']);

const buildTimeline = (title, description, type = 'info') => ({
  title,
  description,
  type,
  createdAt: new Date().toISOString(),
});

const normalizeActivity = (activity) => {
  const { id, ...record } = activity;
  return {
    ...record,
    _id: String(id ?? activity._id ?? ''),
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
  };
};

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
    if (!Number.isNaN(date.getTime())) return toRange(date);
  }
  return null;
};

const asTrimmedString = (value) => (value === null || value === undefined ? '' : String(value).trim());
const validationError = (message) => {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
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

    const conditions = ['deletedAt IS NULL'];
    const params = [];
    const addExactFilter = (field, value) => {
      if (!value) return;
      conditions.push(`"${field}" = ?`);
      params.push(value);
    };

    addExactFilter('status', status);
    addExactFilter('createdBy', createdBy);
    addExactFilter('customerName', customerName);
    addExactFilter('response', response);
    addExactFilter('activityId', activityId);
    if (customer) {
      conditions.push('"customerName" = ?');
      params.push(customer);
    }

    const activityDateRange = getActivityDateRange(activityDatePreset, req.query.customDate || '');
    const followUpDateRange = getActivityDateRange(followUpPreset, req.query.customFollowUpDate || '');
    [
      ['activityDate', activityDateRange],
      ['followUpDate', followUpDateRange],
    ].forEach(([field, range]) => {
      if (!range) return;
      conditions.push(`"${field}" >= ? AND "${field}" <= ?`);
      params.push(range.$gte, range.$lte);
    });

    if (search) {
      conditions.push(`(
        activityId REGEXP ? OR customerName REGEXP ? OR leadId REGEXP ? OR
        company REGEXP ? OR contactPerson REGEXP ? OR email REGEXP ? OR mobileNo REGEXP ?
      )`);
      params.push(...Array(7).fill(String(search)));
    }

    const pageNum = Math.max(safeParseInt(page, 1), 1);
    const limitNum = Math.min(Math.max(safeParseInt(limit, 10), 1), 100);
    const skip = (pageNum - 1) * limitNum;
    const selectedSortField = String(sortBy || 'createdAt');
    const sortField = sortableFields.has(selectedSortField) ? selectedSortField : 'createdAt';
    const where = conditions.join(' AND ');
    const [activities, total] = [
      Activity.list({
        where,
        params,
        sortBy: sortField,
        sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
        limit: limitNum,
        offset: skip,
      }),
      Activity.count(where, params),
    ];

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
    const activity = Activity.findById(req.params.id);
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
      leadId: asTrimmedString(req.body.leadId || ''),
      leadSource: asTrimmedString(req.body.leadSource || 'Lead'),
      customerName: asTrimmedString(req.body.customerName || ''),
      contactPerson: asTrimmedString(req.body.contactPerson || ''),
      designation: asTrimmedString(req.body.designation || ''),
      email: asTrimmedString(req.body.email || '').toLowerCase(),
      mobileNo: asTrimmedString(req.body.mobileNo || ''),
      sourceOfLead: asTrimmedString(req.body.sourceOfLead || ''),
      customerRequirements: asTrimmedString(req.body.customerRequirements || ''),
      customerRemarks: asTrimmedString(req.body.customerRemarks || ''),
      assignedUser: asTrimmedString(req.body.assignedUser || ''),
      leadIdLabel: asTrimmedString(req.body.leadIdLabel || ''),
      company: asTrimmedString(req.body.company || ''),
      priority: asTrimmedString(req.body.priority || 'Medium'),
      campaign: asTrimmedString(req.body.campaign || ''),
      activityType: asTrimmedString(req.body.activityType || ''),
      activityDate: asTrimmedString(req.body.activityDate || ''),
      location: asTrimmedString(req.body.location || ''),
      response: asTrimmedString(req.body.response || ''),
      followUp: asTrimmedString(req.body.followUp || ''),
      product: asTrimmedString(req.body.product || ''),
      tagResource: asTrimmedString(req.body.tagResource || ''),
      followUpDate: asTrimmedString(req.body.followUpDate || ''),
      reminder: asTrimmedString(req.body.reminder || ''),
      status: asTrimmedString(req.body.status || 'Open'),
      createdBy: asTrimmedString(req.body.createdBy || 'Current User'),
      lastModifiedBy: asTrimmedString(req.body.lastModifiedBy || 'Current User'),
    };

    if (!payload.customerName || !payload.activityType || !payload.activityDate || !payload.product) {
      return res.status(400).json({ success: false, message: 'Customer / Partner Name, Activity Type, Activity Date, and Product are required.' });
    }
    if (!Activity.statuses.includes(payload.status)) {
      throw validationError(`\`${payload.status}\` is not a valid enum value for path \`status\`.`);
    }

    const activity = Activity.create(payload);

    if (payload.leadId) {
      const lead = Lead.findByLeadId(payload.leadId);
      if (lead) {
        const changes = {
          timeline: [
            buildTimeline('Activity Created', `Lead moved to Activity module. Activity Type: ${payload.activityType || 'Meeting'}`, 'info'),
            ...(lead.timeline || []),
          ],
        };
        if (lead.leadStatus !== 'Won' && lead.leadStatus !== 'Lost') {
          changes.leadStatus = 'Follow-up Scheduled';
        }
        Lead.updateFromActivity(lead._id, changes);
      }
    }

    res.status(201).json({ success: true, message: 'Activity created successfully.', data: normalizeActivity(activity) });
  } catch (error) {
    if (error?.code === 'ACTIVITY_OPEN_EXISTS') {
      return res.status(409).json({
        success: false,
        message: 'Activity already exists for this Lead.',
        existingActivityId: error.activity.activityId || String(error.activity.id || ''),
      });
    }
    console.error('Activity creation failed:', error);
    res.status(500).json({ success: false, message: error.message || 'Unable to create activity' });
  }
};

exports.updateActivity = async (req, res) => {
  try {
    const activity = Activity.findById(req.params.id);
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });

    const changes = {};
    Activity.fields.forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) return;
      const value = req.body[field];
      changes[field] = value === null ? null : asTrimmedString(value);
    });
    if (Object.prototype.hasOwnProperty.call(changes, 'email') && changes.email !== null) {
      changes.email = changes.email.toLowerCase();
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'status') && changes.status !== null && !Activity.statuses.includes(changes.status)) {
      throw validationError(`\`${changes.status}\` is not a valid enum value for path \`status\`.`);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'deletedAt')) {
      const value = req.body.deletedAt;
      const date = value === null ? null : new Date(value);
      if (date && Number.isNaN(date.getTime())) throw validationError('Cast to date failed for value provided for `deletedAt`.');
      changes.deletedAt = date ? date.toISOString() : null;
    }
    changes.lastModifiedBy = asTrimmedString(req.body.lastModifiedBy || 'Current User');
    const updatedActivity = Activity.update(req.params.id, changes);

    res.status(200).json({ success: true, message: 'Activity updated successfully.', data: normalizeActivity(updatedActivity) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Unable to update activity' });
  }
};

exports.deleteActivity = async (req, res) => {
  try {
    const activity = Activity.findById(req.params.id);
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });
    Activity.softDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Activity deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Unable to delete activity' });
  }
};
