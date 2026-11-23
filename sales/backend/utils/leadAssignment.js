const LEAD_ASSIGNMENT_REQUIRED_MESSAGE = 'Please assign this lead to an employee before creating an activity.';

const isLeadAssigned = (value) => {
  const assignedTo = String(value || '').trim();
  return Boolean(assignedTo && !/^(unassigned|none|select|n\/a|-)$/i.test(assignedTo));
};

module.exports = { LEAD_ASSIGNMENT_REQUIRED_MESSAGE, isLeadAssigned };
