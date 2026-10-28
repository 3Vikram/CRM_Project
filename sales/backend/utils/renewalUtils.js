const DAY_MS = 24 * 60 * 60 * 1000;

const getUtcDateStart = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

const getDaysUntilRenewal = (renewalDate, now = new Date()) => {
  const renewalDay = getUtcDateStart(renewalDate);
  const currentDay = getUtcDateStart(now);
  if (renewalDay === null || currentDay === null) return null;
  return Math.round((renewalDay - currentDay) / DAY_MS);
};

const getRenewalReminderDateRange = (now = new Date()) => {
  const today = getUtcDateStart(now);
  if (today === null) throw new Error('A valid current date is required to calculate renewal reminders.');
  const targetDay = today + (7 * DAY_MS);
  return {
    start: new Date(targetDay),
    end: new Date(targetDay + DAY_MS),
  };
};

module.exports = { DAY_MS, getUtcDateStart, getDaysUntilRenewal, getRenewalReminderDateRange };
