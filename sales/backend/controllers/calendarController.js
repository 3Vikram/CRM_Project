const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const Contact = require('../models/Contact');
const MailCampaign = require('../models/MailCampaign');
const Supplier = require('../models/Supplier');
const Activity = require('../models/Activity');

const priorityOrder = { High: 3, Medium: 2, Low: 1 };

const moduleColors = {
  Leads: 'orange',
  Customers: 'green',
  Contacts: 'blue',
  'Mail Campaigns': 'blue',
  Activities: 'gray',
  Quotations: 'purple',
  Funnels: 'red',
  Suppliers: 'slate',
  Meetings: 'darkblue',
  Calls: 'orange',
  Tasks: 'gray',
};

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const direct = new Date(trimmed);
    if (!Number.isNaN(direct.getTime())) return direct;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const iso = new Date(`${trimmed}T00:00:00`);
      if (!Number.isNaN(iso.getTime())) return iso;
    }
  }
  return null;
};

const toISODate = (value) => {
  const date = normalizeDate(value);
  if (!date) return null;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeTime = (value) => {
  if (!value) return '09:00';
  if (typeof value !== 'string') return '09:00';
  const trimmed = value.trim();
  if (!trimmed) return '09:00';

  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hour = Number(match24[1]);
    const minute = Number(match24[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  const matchMeridian = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (matchMeridian) {
    let hour = Number(matchMeridian[1]);
    const minute = Number(matchMeridian[2]);
    const meridian = matchMeridian[3].toUpperCase();
    if (meridian === 'AM' && hour === 12) hour = 0;
    if (meridian === 'PM' && hour !== 12) hour += 12;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  const simple = trimmed.match(/^(\d{1,2})(?::(\d{2}))?/);
  if (simple) {
    const hour = Number(simple[1]);
    const minute = Number(simple[2] || '00');
    if (hour >= 0 && hour <= 23) return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  return '09:00';
};

const toDisplayTitle = (value) => {
  if (!value) return 'CRM Activity';
  return String(value).trim();
};

const formatDescription = ({ title, module, customerName, contactName, assignedTo, date, time }) => {
  const parts = [title, module];
  if (customerName) parts.push(customerName);
  if (contactName) parts.push(contactName);
  if (assignedTo) parts.push(`Assigned to ${assignedTo}`);
  if (date && time) parts.push(`Scheduled for ${date} at ${time}`);
  return parts.join(' • ');
};

const buildCalendarEvent = ({
  title,
  module,
  date,
  time,
  customerName,
  contactName,
  assignedTo,
  priority,
  status,
  calendarStatus,
  description,
  referenceId,
  referenceModule,
  eventType,
  sourceField,
}) => {
  const normalizedDate = toISODate(date);
  if (!normalizedDate) return null;

  const event = {
    id: referenceId ? `${referenceModule || module}:${referenceId}:${sourceField || eventType || title}:${normalizedDate}:${time || '09:00'}` : `${module}:${title}:${normalizedDate}:${time || '09:00'}`,
    title: toDisplayTitle(title),
    module,
    date: normalizedDate,
    time: normalizeTime(time || '09:00'),
    customerName: customerName || '',
    contactName: contactName || '',
    assignedTo: assignedTo || 'Unassigned',
    priority: priority || 'Medium',
    status: calendarStatus || status || 'Pending',
    description: description || formatDescription({ title, module, customerName, contactName, assignedTo, date: normalizedDate, time: normalizeTime(time || '09:00') }),
    referenceId: referenceId || '',
    referenceModule: referenceModule || module,
    eventType: eventType || 'Schedule',
    sourceField: sourceField || '',
    color: moduleColors[module] || 'blue',
  };

  return event;
};

const collectLeadEvents = (lead) => {
  if (!lead) return [];

  const candidates = [
    {
      value: lead.followUpDate,
      time: lead.followUpTime,
      title: 'Lead Follow-up',
      module: 'Leads',
      eventType: 'Follow-up',
      status: lead.leadStatus || 'Pending',
      calendarStatus: lead.calendarStatus,
      priority: lead.priority || 'Medium',
      customerName: lead.companyName || lead.contactPerson || '',
      contactName: lead.contactPerson || '',
      assignedTo: lead.assignedTo || 'Unassigned',
      description: `Follow up with ${lead.companyName || lead.contactPerson || 'lead'} on the next action.`,
      sourceField: 'followUpDate',
    },
    {
      value: lead.demoDate,
      time: lead.demoTime,
      title: 'Demo Presentation',
      module: 'Leads',
      eventType: 'Demo',
      status: lead.leadStatus || 'Pending',
      calendarStatus: lead.calendarStatus,
      priority: lead.priority || 'High',
      customerName: lead.companyName || '',
      contactName: lead.contactPerson || '',
      assignedTo: lead.assignedTo || 'Unassigned',
      description: `Demo scheduled for ${lead.companyName || lead.contactPerson || 'lead'}.`,
      sourceField: 'demoDate',
    },
    {
      value: lead.meetingDate,
      time: lead.meetingTime,
      title: 'Lead Meeting',
      module: 'Leads',
      eventType: 'Meeting',
      status: lead.leadStatus || 'Pending',
      calendarStatus: lead.calendarStatus,
      priority: lead.priority || 'High',
      customerName: lead.companyName || '',
      contactName: lead.contactPerson || '',
      assignedTo: lead.assignedTo || 'Unassigned',
      description: `Customer meeting scheduled with ${lead.companyName || lead.contactPerson || 'lead'}.`,
      sourceField: 'meetingDate',
    },
    {
      value: lead.callbackDate,
      time: lead.callbackTime,
      title: 'Callback',
      module: 'Leads',
      eventType: 'Call',
      status: lead.leadStatus || 'Pending',
      calendarStatus: lead.calendarStatus,
      priority: lead.priority || 'Medium',
      customerName: lead.companyName || '',
      contactName: lead.contactPerson || '',
      assignedTo: lead.assignedTo || 'Unassigned',
      description: `Callback scheduled for ${lead.companyName || lead.contactPerson || 'lead'}.`,
      sourceField: 'callbackDate',
    },
    {
      value: lead.nextActionDate,
      time: lead.nextActionTime,
      title: 'Next Action',
      module: 'Leads',
      eventType: 'Task',
      status: lead.leadStatus || 'Pending',
      calendarStatus: lead.calendarStatus,
      priority: lead.priority || 'Medium',
      customerName: lead.companyName || '',
      contactName: lead.contactPerson || '',
      assignedTo: lead.assignedTo || 'Unassigned',
      description: `Next action scheduled for ${lead.companyName || lead.contactPerson || 'lead'}.`,
      sourceField: 'nextActionDate',
    },
  ];

  return candidates
    .filter((candidate) => candidate.value)
    .map((candidate) => buildCalendarEvent({
      title: candidate.title,
      module: candidate.module,
      date: candidate.value,
      time: candidate.time,
      customerName: candidate.customerName,
      contactName: candidate.contactName,
      assignedTo: candidate.assignedTo,
      priority: candidate.priority,
      status: candidate.status,
      description: candidate.description,
      referenceId: lead._id?.toString?.() || lead.leadId || '',
      referenceModule: 'Leads',
      eventType: candidate.eventType,
    }))
    .filter(Boolean);
};

const collectCustomerEvents = (customer) => {
  if (!customer) return [];
  const candidates = [
    { key: 'meetingDate', title: 'Customer Meeting', type: 'Meeting', module: 'Customers' },
    { key: 'renewalDate', title: 'Renewal Reminder', type: 'Reminder', module: 'Customers' },
    { key: 'contractExpiryDate', title: 'Contract Expiry', type: 'Reminder', module: 'Customers' },
    { key: 'visitDate', title: 'Visit Schedule', type: 'Visit', module: 'Customers' },
    { key: 'nextActionDate', title: 'Customer Follow-up', type: 'Follow-up', module: 'Customers' },
  ];

  return candidates
    .map((candidate) => {
      const dateValue = customer[candidate.key];
      const timeValue = customer[`${candidate.key.replace('Date', 'Time')}`] || customer.time || '09:00';
      if (!dateValue) return null;
      return buildCalendarEvent({
        title: candidate.title,
        module: candidate.module,
        date: dateValue,
        time: timeValue,
        customerName: customer.companyName || customer.customerName || '',
        contactName: customer.customerName || '',
        assignedTo: customer.assignedTo || customer.createdBy || 'Unassigned',
        priority: customer.priority || 'Medium',
        status: customer.status || 'Pending',
        calendarStatus: customer.calendarStatus,
        description: `${candidate.title} for ${customer.companyName || customer.customerName || 'customer'}.`,
        sourceField: candidate.key,
        referenceId: customer._id?.toString?.() || '',
        referenceModule: 'Customers',
        eventType: candidate.type,
      });
    })
    .filter(Boolean);
};

const collectContactEvents = (contact) => {
  if (!contact) return [];
  const candidates = [
    { key: 'meetingDate', title: 'Contact Meeting', type: 'Meeting', module: 'Contacts' },
    { key: 'callReminderDate', title: 'Call Reminder', type: 'Call', module: 'Contacts' },
    { key: 'birthday', title: 'Birthday', type: 'Birthday', module: 'Contacts' },
    { key: 'anniversary', title: 'Anniversary', type: 'Anniversary', module: 'Contacts' },
    { key: 'nextActionDate', title: 'Contact Follow-up', type: 'Follow-up', module: 'Contacts' },
  ];

  return candidates
    .map((candidate) => {
      const dateValue = contact[candidate.key];
      const timeValue = contact[`${candidate.key.replace('Date', 'Time')}`] || contact.time || '09:00';
      if (!dateValue) return null;
      return buildCalendarEvent({
        title: candidate.title,
        module: candidate.module,
        date: dateValue,
        time: timeValue,
        customerName: contact.customerName || '',
        contactName: contact.contactName || '',
        assignedTo: 'Unassigned',
        priority: 'Medium',
        status: 'Pending',
        calendarStatus: contact.calendarStatus,
        description: `${candidate.title} for ${contact.contactName || 'contact'}.`,
        sourceField: candidate.key,
        referenceId: contact._id?.toString?.() || '',
        referenceModule: 'Contacts',
        eventType: candidate.type,
      });
    })
    .filter(Boolean);
};

const collectCampaignEvents = (campaign) => {
  if (!campaign) return [];
  const dateValue = campaign.scheduledDate || campaign.createdDate;
  const timeValue = campaign.scheduledTime || '09:00';
  if (!dateValue) return [];

  return [
    buildCalendarEvent({
      title: campaign.campaignName || 'Campaign Schedule',
      module: 'Mail Campaigns',
      date: dateValue,
      time: timeValue,
      customerName: campaign.recipientGroup?.[0] || campaign.createdBy || '',
      contactName: '',
      assignedTo: campaign.createdBy || 'Unassigned',
      priority: campaign.priority || 'Medium',
      status: campaign.status || 'Pending',
      calendarStatus: campaign.calendarStatus,
      description: `Campaign ${campaign.campaignName || 'schedule'} is planned for ${dateValue}.`,
      referenceId: campaign._id?.toString?.() || campaign.campaignId || '',
      referenceModule: 'Mail Campaigns',
      eventType: 'Mail Campaign',
      sourceField: campaign.scheduledDate ? 'scheduledDate' : 'createdDate',
    }),
  ].filter(Boolean);
};

const collectSupplierEvents = (supplier) => {
  if (!supplier) return [];
  const candidates = [
    { key: 'deliveryDate', title: 'Delivery Date', type: 'Delivery', module: 'Suppliers' },
    { key: 'paymentReminderDate', title: 'Payment Reminder', type: 'Payment', module: 'Suppliers' },
    { key: 'followUpDate', title: 'Supplier Follow-up', type: 'Follow-up', module: 'Suppliers' },
  ];

  return candidates
    .map((candidate) => {
      const dateValue = supplier[candidate.key];
      const timeValue = supplier[`${candidate.key.replace('Date', 'Time')}`] || '09:00';
      if (!dateValue) return null;
      return buildCalendarEvent({
        title: candidate.title,
        module: candidate.module,
        date: dateValue,
        time: timeValue,
        customerName: supplier.supplierName || '',
        contactName: supplier.contactName || '',
        assignedTo: supplier.createdBy || 'Unassigned',
        priority: 'Medium',
        status: 'Pending',
        calendarStatus: supplier.calendarStatus,
        description: `${candidate.title} for ${supplier.supplierName || 'supplier'}.`,
        sourceField: candidate.key,
        referenceId: supplier._id?.toString?.() || '',
        referenceModule: 'Suppliers',
        eventType: candidate.type,
      });
    })
    .filter(Boolean);
};

exports.getCalendarEvents = async (_req, res) => {
  try {
    const [leads, customers, contacts, campaigns, suppliers, activities] = await Promise.all([
      Lead.find({}).lean(),
      Customer.find({}).lean(),
      Contact.find({}).lean(),
      MailCampaign.find({ deletedAt: null }).lean(),
      Supplier.find({}).lean(),
      Activity.find({ deletedAt: null }).lean(),
    ]);

    const mergedEvents = [
      ...leads.flatMap(collectLeadEvents),
      ...customers.flatMap(collectCustomerEvents),
      ...contacts.flatMap(collectContactEvents),
      ...campaigns.flatMap(collectCampaignEvents),
      ...suppliers.flatMap(collectSupplierEvents),
      ...activities.flatMap((activity) => {
        const date = activity.followUpDate || activity.activityDate;
        if (!date) return [];
        return [buildCalendarEvent({
          title: activity.activityType || 'Activity',
          module: 'Activities',
          date,
          time: '09:00',
          customerName: activity.company || activity.customerName || '',
          contactName: activity.contactPerson || '',
          assignedTo: activity.assignedUser || 'Unassigned',
          priority: activity.priority || 'Medium',
          status: activity.status || 'Pending',
          calendarStatus: activity.status === 'Completed' ? 'Completed' : undefined,
          description: activity.customerRemarks || activity.customerRequirements || 'CRM activity.',
          sourceField: activity.followUpDate ? 'followUpDate' : 'activityDate',
          referenceId: activity._id?.toString?.() || '',
          referenceModule: 'Activities',
          eventType: activity.activityType || 'Activity',
        })];
      }),
    ]
      .filter(Boolean)
      .sort((a, b) => {
        const dateDiff = new Date(`${a.date}T${a.time}:00`).getTime() - new Date(`${b.date}T${b.time}:00`).getTime();
        if (dateDiff !== 0) return dateDiff;
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      });

    res.status(200).json({ success: true, data: mergedEvents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Unable to load calendar events' });
  }
};

const calendarSources = {
  Leads: { model: Lead, softDelete: false, completion: { calendarStatus: 'Completed' } },
  Customers: { model: Customer, softDelete: false, completion: { calendarStatus: 'Completed' } },
  Contacts: { model: Contact, softDelete: false, completion: { calendarStatus: 'Completed' } },
  'Mail Campaigns': { model: MailCampaign, softDelete: true, completion: { calendarStatus: 'Completed' } },
  Suppliers: { model: Supplier, softDelete: false, completion: { calendarStatus: 'Completed' } },
  Activities: { model: Activity, softDelete: true, completion: { status: 'Completed' } },
};

exports.completeCalendarEvent = async (req, res) => {
  try {
    const source = calendarSources[req.params.module];
    if (!source) return res.status(400).json({ success: false, message: 'Unsupported calendar event module' });
    const event = await source.model.findOneAndUpdate(
      { _id: req.params.id, ...(source.softDelete ? { deletedAt: null } : {}) },
      { $set: source.completion },
      { new: true, runValidators: true },
    );
    if (!event) return res.status(404).json({ success: false, message: 'Calendar event source not found' });
    res.status(200).json({ success: true, message: 'Calendar event marked complete.' });
  } catch (error) {
    console.error('Calendar event action error:', error);
    res.status(500).json({ success: false, message: error.message || 'Unable to complete calendar event' });
  }
};

exports.deleteCalendarEvent = async (req, res) => {
  try {
    const source = calendarSources[req.params.module];
    if (!source) return res.status(400).json({ success: false, message: 'Unsupported calendar event module' });
    const query = { _id: req.params.id, ...(source.softDelete ? { deletedAt: null } : {}) };
    const sourceField = String(req.body?.sourceField || '');
    const allowedFields = {
      Leads: ['followUpDate', 'demoDate', 'meetingDate', 'callbackDate', 'nextActionDate'],
      Customers: ['meetingDate', 'renewalDate', 'contractExpiryDate', 'visitDate', 'nextActionDate'],
      Contacts: ['meetingDate', 'callReminderDate', 'birthday', 'anniversary', 'nextActionDate'],
      'Mail Campaigns': ['scheduledDate', 'createdDate'],
      Suppliers: ['deliveryDate', 'paymentReminderDate', 'followUpDate'],
      Activities: ['followUpDate', 'activityDate'],
    }[req.params.module] || [];
    if (!allowedFields.includes(sourceField)) return res.status(400).json({ success: false, message: 'Invalid calendar event source field' });
    const event = source.softDelete && sourceField === 'activityDate'
      ? await source.model.findOneAndUpdate(query, { $set: { deletedAt: new Date() } }, { new: true })
      : await source.model.findOneAndUpdate(query, { $set: { [sourceField]: '' } }, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ success: false, message: 'Calendar event source not found' });
    res.status(200).json({ success: true, message: 'Calendar event deleted.' });
  } catch (error) {
    console.error('Calendar event action error:', error);
    res.status(500).json({ success: false, message: error.message || 'Unable to delete calendar event' });
  }
};
