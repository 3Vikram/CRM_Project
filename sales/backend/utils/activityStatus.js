const TIME_ZONE = 'Asia/Kolkata';

const OUTCOMES = [
  'Open',
  'Follow-Up Required',
  'Awaiting Client',
  'Rescheduled / No-Show',
  'Completed',
  'Cancelled',
];

const ACTIVE_FOLLOW_UP_OUTCOMES = new Set([
  'Follow-Up Required',
  'Awaiting Client',
  'Rescheduled / No-Show',
]);

const dateParts = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year)
    || date.getUTCMonth() !== Number(month) - 1
    || date.getUTCDate() !== Number(day)
  ) return null;
  return { year: Number(year), month: Number(month), day: Number(day) };
};

const formatDateParts = ({ year, month, day }) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const getDateOnly = (value) => {
  if (!value) return '';
  const directDate = dateParts(value);
  if (directDate) return formatDateParts(directDate);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${values.year}-${values.month}-${values.day}`;
};

const getTodayInKolkata = (now = new Date()) => getDateOnly(now);

const addDateDays = (value, amount) => {
  const parts = dateParts(value);
  if (!parts) return '';
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return formatDateParts({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
};

const daysBetween = (earlier, later) => {
  const earlierParts = dateParts(earlier);
  const laterParts = dateParts(later);
  if (!earlierParts || !laterParts) return 0;
  const earlierTime = Date.UTC(earlierParts.year, earlierParts.month - 1, earlierParts.day);
  const laterTime = Date.UTC(laterParts.year, laterParts.month - 1, laterParts.day);
  return Math.floor((laterTime - earlierTime) / 86_400_000);
};

const normalizeOutcome = (value) => {
  if (value === 'Pending' || value === 'Overdue' || !value) return 'Open';
  return value;
};

const getEffectiveStatus = (activity, today = getTodayInKolkata()) => {
  const outcome = normalizeOutcome(activity?.status);
  if (outcome === 'Completed' || outcome === 'Cancelled') return outcome;

  const followUpDate = getDateOnly(activity?.followUpDate);
  if (ACTIVE_FOLLOW_UP_OUTCOMES.has(outcome)) {
    if (followUpDate && followUpDate < today) {
      return `Overdue - ${daysBetween(followUpDate, today)}d`;
    }
    if (followUpDate && followUpDate === today) return 'Follow-Up Today';
    return outcome;
  }

  const activityDate = getDateOnly(activity?.activityDate);
  if (activityDate && activityDate > today) return 'Upcoming / Scheduled';
  if (followUpDate && followUpDate === today) return 'Follow-Up Today';
  if (followUpDate && followUpDate < today) {
    return `Overdue - ${daysBetween(followUpDate, today)}d`;
  }
  return 'Open';
};

const matchesEffectiveStatus = (effectiveStatus, filterStatus) => {
  if (!filterStatus) return true;
  if (filterStatus === 'Overdue') return effectiveStatus.startsWith('Overdue - ');
  return effectiveStatus === filterStatus;
};

const validateOutcome = (activity) => {
  const status = String(activity.status || 'Open').trim();
  if (!OUTCOMES.includes(status) && !['Pending', 'Overdue'].includes(status)) {
    return 'Select a valid activity status.';
  }
  if (ACTIVE_FOLLOW_UP_OUTCOMES.has(status) && !getDateOnly(activity.followUpDate)) {
    return `${status} requires a Follow-Up Date.`;
  }
  if (
    ['Rescheduled / No-Show', 'Cancelled'].includes(status)
    && !String(activity.customerRemarks || '').trim()
  ) {
    return `${status} requires a reason in Remarks.`;
  }
  return '';
};

module.exports = {
  ACTIVE_FOLLOW_UP_OUTCOMES,
  OUTCOMES,
  addDateDays,
  daysBetween,
  getDateOnly,
  getEffectiveStatus,
  getTodayInKolkata,
  matchesEffectiveStatus,
  normalizeOutcome,
  validateOutcome,
};
