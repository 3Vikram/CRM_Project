const Activity = require('../models/Activity');
const { ownerScope } = require('../utils/accessScope');
const { addDateDays, getEffectiveStatus, getTodayInKolkata } = require('../utils/activityStatus');

const ACTIVITY_TYPES = ['Meeting', 'Call', 'Email', 'Demo', 'Site Visit', 'Follow-up', 'Support', 'Other'];
const DATE_RANGES = ['today', 'week', 'month', 'year', 'custom'];
const PERFORMANCE_INTERVALS = ['daily', 'weekly', 'monthly'];
const PERFORMANCE_RANGES = ['week', 'month', 'year'];
const TERMINAL_STATUSES = new Set(['Completed', 'Cancelled']);

const dateRangeFor = (range, today, startDate, endDate) => {
  if (range === 'custom') {
    if (!isDateKey(startDate) || !isDateKey(endDate) || startDate > endDate) return null;
    return { start: startDate, end: endDate };
  }
  if (range === 'today') return { start: today, end: today };
  if (range === 'week') {
    const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
    const monday = addDateDays(today, -((weekday + 6) % 7));
    return { start: monday, end: addDateDays(monday, 6) };
  }
  if (range === 'month') {
    const start = `${today.slice(0, 7)}-01`;
    const nextMonth = new Date(`${start}T00:00:00.000Z`);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    return { start, end: addDateDays(nextMonth.toISOString().slice(0, 10), -1) };
  }
  return { start: `${today.slice(0, 4)}-01-01`, end: `${today.slice(0, 4)}-12-31` };
};

const isDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const mondayOf = (dateKey) => {
  const weekday = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  return addDateDays(dateKey, -((weekday + 6) % 7));
};

const dateLabel = (value) => new Date(`${value}T00:00:00.000Z`)
  .toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });

const monthStartFor = (today, offset = 0) => {
  const date = new Date(`${today.slice(0, 7)}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
};

const makePerformanceSeries = (activities, range, interval) => {
  const counts = new Map();
  for (const activity of activities) {
    const date = activity.activityDate;
    if (!isDateKey(date)) continue;
    const key = interval === 'monthly' ? date.slice(0, 7) : interval === 'weekly' ? mondayOf(date) : date;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const points = [];
  if (interval === 'monthly') {
    let month = range.start.slice(0, 7);
    const lastMonth = range.end.slice(0, 7);
    while (month <= lastMonth) {
      const monthDate = new Date(`${month}-01T00:00:00.000Z`);
      points.push({
        label: monthDate.toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
        count: counts.get(month) || 0,
      });
      monthDate.setUTCMonth(monthDate.getUTCMonth() + 1);
      month = monthDate.toISOString().slice(0, 7);
    }
    return points;
  }

  let date = interval === 'weekly' ? mondayOf(range.start) : range.start;
  const increment = interval === 'weekly' ? 7 : 1;
  while (date <= range.end) {
    const key = interval === 'weekly' ? date : date;
    if (interval === 'daily' || date <= range.end) {
      points.push({
        label: interval === 'weekly' ? dateLabel(date) : new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        count: counts.get(key) || 0,
      });
    }
    date = addDateDays(date, increment);
  }
  return points;
};

const buildActivityAnalytics = ({
  activities,
  employeeActivities,
  monthlyActivities = activities,
  weeklyActivities = activities,
  performanceActivities = activities,
  filters,
  range,
  performanceRange = range,
  today,
  performanceInterval,
}) => {
  const prepared = activities.map((activity) => ({
    ...activity,
    effectiveStatus: getEffectiveStatus(activity, today),
  }));
  const activeFollowUps = prepared.filter((activity) => (
    activity.followUpDate && !TERMINAL_STATUSES.has(activity.effectiveStatus)
  ));
  const positiveResponses = prepared.filter((activity) => activity.response === 'Positive').length;
  const negativeResponses = prepared.filter((activity) => activity.response === 'Negative').length;
  const noResponses = prepared.filter((activity) => activity.response === 'No Response').length;
  const distinctLeadIds = new Set(prepared.map((activity) => String(activity.leadId || '').trim()).filter(Boolean));
  const followUpGroups = new Map();
  const productGroups = new Map();
  const typeGroups = new Map();
  const employeeGroups = new Map();

  for (const activity of prepared) {
    const type = String(activity.activityType || 'Unspecified');
    typeGroups.set(type, (typeGroups.get(type) || 0) + 1);
    if (activity.followUpDate && activity.effectiveStatus !== 'Cancelled') {
      const group = followUpGroups.get(type) || { type, total: 0, completed: 0 };
      group.total += 1;
      if (activity.effectiveStatus === 'Completed') group.completed += 1;
      followUpGroups.set(type, group);
    }
    const product = String(activity.product || '').trim();
    if (product) {
      const key = product.toLocaleLowerCase();
      const group = productGroups.get(key) || { product, count: 0 };
      group.count += 1;
      productGroups.set(key, group);
    }
  }

  for (const activity of employeeActivities) {
    const employee = String(activity.assignedUser || '').trim() || 'Unassigned';
    const group = employeeGroups.get(employee) || { employee, count: 0, completed: 0, missed: 0 };
    const status = getEffectiveStatus(activity, today);
    group.count += 1;
    if (status === 'Completed') group.completed += 1;
    if (status.startsWith('Overdue - ')) group.missed += 1;
    employeeGroups.set(employee, group);
  }

  const lastMonth = today.slice(0, 7);
  const firstMonthDate = new Date(`${lastMonth}-01T00:00:00.000Z`);
  firstMonthDate.setUTCMonth(firstMonthDate.getUTCMonth() - 7);
  const monthlyCounts = new Map();
  for (const activity of monthlyActivities) {
    if (!isDateKey(activity.activityDate)) continue;
    const month = activity.activityDate.slice(0, 7);
    const group = monthlyCounts.get(month) || { label: '', calls: 0, meetings: 0 };
    group.label = new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString('en', { month: 'short', timeZone: 'UTC' });
    if (activity.activityType === 'Call') group.calls += 1;
    if (activity.activityType === 'Meeting') group.meetings += 1;
    monthlyCounts.set(month, group);
  }
  const callsVsMeetings = [];
  for (let offset = 0; offset < 8; offset += 1) {
    const monthDate = new Date(firstMonthDate);
    monthDate.setUTCMonth(monthDate.getUTCMonth() + offset);
    const month = monthDate.toISOString().slice(0, 7);
    callsVsMeetings.push(monthlyCounts.get(month) || {
      label: monthDate.toLocaleDateString('en', { month: 'short', timeZone: 'UTC' }),
      calls: 0,
      meetings: 0,
    });
  }

  const currentWeek = mondayOf(today);
  const weeklyCounts = new Map();
  for (const activity of weeklyActivities) {
    if (!isDateKey(activity.activityDate)) continue;
    const weekStart = mondayOf(activity.activityDate);
    if (weekStart < addDateDays(currentWeek, -49) || weekStart > currentWeek) continue;
    const group = weeklyCounts.get(weekStart) || { total: 0, completed: 0, missed: 0 };
    const status = getEffectiveStatus(activity, today);
    group.total += 1;
    if (status === 'Completed') group.completed += 1;
    if (status.startsWith('Overdue - ')) group.missed += 1;
    weeklyCounts.set(weekStart, group);
  }
  const weeklyTrend = Array.from({ length: 8 }, (_, index) => {
    const weekStart = addDateDays(currentWeek, (index - 7) * 7);
    return {
      label: `Week ${index + 1}`,
      weekStart,
      ...(weeklyCounts.get(weekStart) || { total: 0, completed: 0, missed: 0 }),
    };
  });

  const denominator = positiveResponses + negativeResponses + noResponses;
  const followUpsToday = activeFollowUps.filter((activity) => activity.followUpDate === today).length;
  const followUpsPending = activeFollowUps.filter((activity) => activity.followUpDate >= today).length;
  const followUpsMissed = activeFollowUps.filter((activity) => (
    activity.followUpDate < today && activity.effectiveStatus.startsWith('Overdue - ')
  )).length;

  return {
    filters: { ...filters },
    range: { start: range.start, end: range.end },
    cards: {
      totalActivities: prepared.length,
      todaysFollowUps: followUpsToday,
      pendingFollowUps: followUpsPending,
      positiveResponses,
      negativeResponses,
      demos: prepared.filter((activity) => activity.activityType === 'Demo').length,
      funnelsGenerated: distinctLeadIds.size,
      missedFollowUps: followUpsMissed,
      successRate: denominator ? Math.round((positiveResponses / denominator) * 1000) / 10 : 0,
    },
    charts: {
      activityPerformance: makePerformanceSeries(performanceActivities, performanceRange, performanceInterval),
      callsVsMeetings,
      followUpCompletion: [...followUpGroups.values()]
        .map((group) => ({
          ...group,
          pending: group.total - group.completed,
          rate: group.total ? Math.round((group.completed / group.total) * 1000) / 10 : 0,
        }))
        .sort((left, right) => left.type.localeCompare(right.type)),
      productAnalysis: [...productGroups.values()].sort((left, right) => right.count - left.count).slice(0, 5),
      weeklyTrend,
      activityTypeDistribution: [...typeGroups].map(([type, count]) => ({ type, count })).sort((left, right) => right.count - left.count),
      employeePerformance: [...employeeGroups.values()].sort((left, right) => right.count - left.count).slice(0, 10),
      salesDistribution: {
        available: false,
        reason: 'Activity records do not include an Inside Sales or Field Sales classification.',
      },
    },
  };
};

const getActivityAnalytics = async (req, res) => {
  const activityType = String(req.query.activityType || 'All').trim();
  const dateRangeName = String(req.query.dateRange || 'week').trim();
  const performanceInterval = String(req.query.performanceInterval || 'daily').trim();
  const performanceRangeName = String(req.query.performanceRange || 'week').trim();
  const employeeId = String(req.query.employeeId || '').trim();
  const employeeName = String(req.query.employeeName || '').trim();
  if (activityType !== 'All' && !ACTIVITY_TYPES.includes(activityType)) {
    return res.status(400).json({ success: false, message: 'Select a valid activity type.' });
  }
  if (!DATE_RANGES.includes(dateRangeName)) {
    return res.status(400).json({ success: false, message: 'Select a valid date range.' });
  }
  if (!PERFORMANCE_INTERVALS.includes(performanceInterval)) {
    return res.status(400).json({ success: false, message: 'Select a valid activity performance interval.' });
  }
  if (!PERFORMANCE_RANGES.includes(performanceRangeName)) {
    return res.status(400).json({ success: false, message: 'Select a valid Activity Performance date range.' });
  }
  const today = getTodayInKolkata();
  const range = dateRangeFor(dateRangeName, today, String(req.query.startDate || ''), String(req.query.endDate || ''));
  if (!range) return res.status(400).json({ success: false, message: 'Enter a valid custom date range.' });
  const performanceRange = dateRangeFor(performanceRangeName, today);
  const weeklyStart = addDateDays(mondayOf(today), -49);
  const currentWeekEnd = addDateDays(mondayOf(today), 6);
  const monthlyStart = monthStartFor(today, -7);
  const currentMonthEnd = addDateDays(monthStartFor(today, 1), -1);
  const queryStart = [range.start, performanceRange.start, weeklyStart, monthlyStart, today].sort()[0];
  const queryEnd = [range.end, performanceRange.end, currentWeekEnd, currentMonthEnd, today].sort().slice(-1)[0];

  try {
    const sharedConditions = [{ deletedAt: null }, ownerScope(req)];
    if (activityType !== 'All') sharedConditions.push({ activityType });
    if (employeeId || employeeName) {
      const employeeConditions = [];
      if (employeeId) employeeConditions.push({ assignedUserId: employeeId });
      if (employeeName) employeeConditions.push({ assignedUser: employeeName });
      sharedConditions.push({ $or: employeeConditions });
    }
    const selectFields = 'activityType activityDate followUpDate response product leadId status assignedUser assignedUserId';
    const [windowActivities, employeeActivities] = await Promise.all([
      Activity.find({
        $and: [
          ...sharedConditions,
          { activityDate: { $gte: queryStart, $lte: queryEnd } },
        ],
      }).select(`${selectFields} customerName activityId reminder`).lean(),
      Activity.find({ $and: [{ deletedAt: null }, ownerScope(req)] })
        .select('assignedUser assignedUserId')
        .lean(),
    ]);

    const employeesByKey = new Map();
    for (const activity of employeeActivities) {
      const name = String(activity.assignedUser || '').trim();
      const id = String(activity.assignedUserId || '').trim();
      if (!name && !id) continue;
      const key = id || name.toLocaleLowerCase();
      if (!employeesByKey.has(key)) employeesByKey.set(key, { id, name: name || id });
    }

    const activities = windowActivities.filter((activity) => (
      isDateKey(activity.activityDate)
      && activity.activityDate >= range.start
      && activity.activityDate <= range.end
    ));
    const monthlyActivities = windowActivities.filter((activity) => (
      isDateKey(activity.activityDate)
      && activity.activityDate >= monthlyStart
      && activity.activityDate <= currentMonthEnd
    ));
    const weeklyActivities = windowActivities.filter((activity) => (
      isDateKey(activity.activityDate)
      && activity.activityDate >= weeklyStart
      && activity.activityDate <= currentWeekEnd
    ));
    const performanceActivities = windowActivities.filter((activity) => (
      isDateKey(activity.activityDate)
      && activity.activityDate >= performanceRange.start
      && activity.activityDate <= performanceRange.end
    ));
    const timeline = windowActivities
      .filter((activity) => activity.activityDate === today)
      .map((activity) => ({
        id: String(activity._id || activity.activityId || ''),
        activityId: String(activity.activityId || ''),
        activityType: String(activity.activityType || 'Activity'),
        customerName: String(activity.customerName || 'Customer not recorded'),
        assignedUser: String(activity.assignedUser || 'Unassigned'),
        scheduledTime: null,
        status: getEffectiveStatus(activity, today),
      }));

    const result = buildActivityAnalytics({
      activities,
      employeeActivities: activities,
      monthlyActivities,
      weeklyActivities,
      performanceActivities,
      performanceRange,
      filters: { activityType, dateRange: dateRangeName, performanceRange: performanceRangeName, performanceInterval, employeeId, employeeName },
      range,
      today,
      performanceInterval,
    });
    return res.status(200).json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        ...result,
        employees: [...employeesByKey.values()].sort((left, right) => left.name.localeCompare(right.name)),
        timeline,
      },
    });
  } catch (error) {
    console.error(error?.message || String(error));
    return res.status(500).json({ success: false, message: 'Unable to load activity analytics.' });
  }
};

module.exports = {
  getActivityAnalytics,
  _buildActivityAnalytics: buildActivityAnalytics,
  _dateRangeFor: dateRangeFor,
};
