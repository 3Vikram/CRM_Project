const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const Contact = require('../models/Contact');
const MailCampaign = require('../models/MailCampaign');
const Supplier = require('../models/Supplier');
const Activity = require('../models/Activity');
const OPF = require('../models/OPF');
const { ownerScope } = require('../utils/accessScope');

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
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnly) {
      const localDate = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
      return localDate.getFullYear() === Number(dateOnly[1])
        && localDate.getMonth() === Number(dateOnly[2]) - 1
        && localDate.getDate() === Number(dateOnly[3])
        ? localDate
        : null;
    }
    const direct = new Date(trimmed);
    if (!Number.isNaN(direct.getTime())) return direct;
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

const isCancelled = (value) => ['cancelled', 'canceled', 'deleted', 'trash', 'rejected'].includes(String(value || '').trim().toLowerCase());

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
  endTime,
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
  amount,
  amountCurrency,
}) => {
  const normalizedDate = toISODate(date);
  if (!normalizedDate || isCancelled(status) || isCancelled(calendarStatus)) return null;

  const event = {
    id: referenceId ? `${referenceModule || module}:${referenceId}:${sourceField || eventType || title}:${normalizedDate}:${time || '09:00'}` : `${module}:${title}:${normalizedDate}:${time || '09:00'}`,
    title: toDisplayTitle(title),
    module,
    date: normalizedDate,
    time: normalizeTime(time || '09:00'),
    endTime: endTime ? normalizeTime(endTime) : '',
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
    amount: amount ?? null,
    amountCurrency: amountCurrency || '',
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
    {
      value: lead.quotationDetails?.expectedClosure,
      time: lead.quotationDetails?.expectedClosureTime,
      title: 'Quotation Expected Closure',
      module: lead.quotationId ? 'Quotations' : 'Funnels',
      eventType: 'Expected Closure',
      status: lead.leadStatus || 'Pending',
      calendarStatus: lead.calendarStatus,
      priority: lead.priority || 'Medium',
      customerName: lead.companyName || '',
      contactName: lead.contactPerson || '',
      assignedTo: lead.assignedTo || lead.createdBy || 'Unassigned',
      description: `Expected quotation closure for ${lead.companyName || lead.contactPerson || 'customer'}.`,
      sourceField: 'quotationDetails.expectedClosure',
      amount: lead.quotationDetails?.value ?? lead.quotationDetails?.revenue,
      amountCurrency: lead.quotationDetails?.currency,
    },
  ];

  return candidates
    .filter((candidate) => candidate.value)
    .map((candidate) => buildCalendarEvent({
      title: candidate.title,
      module: candidate.module,
      date: candidate.value,
      time: candidate.time,
      endTime: candidate.endTime,
      customerName: candidate.customerName,
      contactName: candidate.contactName,
      assignedTo: candidate.assignedTo,
      priority: candidate.priority,
      status: candidate.status,
      description: candidate.description,
      referenceId: lead._id?.toString?.() || lead.leadId || '',
      referenceModule: 'Leads',
      eventType: candidate.eventType,
      sourceField: candidate.sourceField,
      amount: candidate.amount,
      amountCurrency: candidate.amountCurrency,
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
        endTime: customer[`${candidate.key.replace('Date', 'EndTime')}`],
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
        endTime: contact[`${candidate.key.replace('Date', 'EndTime')}`],
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
  if (String(campaign.status || '').toLowerCase() !== 'scheduled') return [];
  const dateValue = campaign.scheduledDate;
  const timeValue = campaign.scheduledTime || '09:00';
  if (!dateValue) return [];

  return [
    buildCalendarEvent({
      title: campaign.campaignName || 'Campaign Schedule',
      module: 'Mail Campaigns',
      date: dateValue,
      time: timeValue,
      endTime: campaign.scheduledEndTime || '',
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
        endTime: supplier[`${candidate.key.replace('Date', 'EndTime')}`],
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

const collectOPFEvents = (opf) => {
  if (!opf) return [];
  const candidates = [
    { key: 'startDate', title: 'OPF Start Date', type: 'OPF', module: 'OPF' },
    { key: 'endDate', title: 'OPF End Date', type: 'OPF', module: 'OPF' },
    { key: 'eta', title: 'OPF Delivery ETA', type: 'Delivery', module: 'OPF' },
    { key: 'customerPODate', title: 'Customer PO Date', type: 'Purchase Order', module: 'OPF' },
    { key: 'renewalDate', title: 'OPF Renewal', type: 'Renewal', module: 'OPF' },
    { key: 'renewalReminderDate', title: 'OPF Renewal Reminder', type: 'Reminder', module: 'OPF' },
    { key: 'amcRenewalDate', title: 'AMC Renewal', type: 'Renewal', module: 'OPF' },
  ];

  return candidates.map((candidate) => {
    const dateValue = opf[candidate.key];
    if (!dateValue) return null;
    return buildCalendarEvent({
      title: candidate.title,
      module: candidate.module,
      date: dateValue,
      time: opf[`${candidate.key.replace('Date', '')}Time`] || '09:00',
      endTime: opf[`${candidate.key.replace('Date', '')}EndTime`] || '',
      customerName: opf.customerName || '',
      contactName: opf.contactPerson || '',
      assignedTo: opf.createdBy || 'Unassigned',
      priority: 'Medium',
      status: opf.approvalStatus || 'Pending',
      description: `${candidate.title} for OPF ${opf.opfNo || ''}${opf.customerName ? ` · ${opf.customerName}` : ''}.`,
      sourceField: candidate.key,
      referenceId: opf._id?.toString?.() || '',
      referenceModule: 'OPF',
      eventType: candidate.type,
    });
  }).filter(Boolean);
};

exports.getCalendarEvents = async (req, res) => {
  try {
    const [leads, customers, contacts, campaigns, suppliers, activities, opfs] = await Promise.all([
      Lead.find({ $and: [{ isScrapped: { $ne: true } }, ownerScope(req)] }).lean(),
      Customer.find({ $and: [{}, ownerScope(req)] }).lean(),
      Contact.find({ $and: [{}, ownerScope(req)] }).lean(),
      MailCampaign.find({ $and: [{ deletedAt: null }, ownerScope(req, { idField: 'employeeId', nameField: 'createdBy' })] }).lean(),
      Supplier.find({ $and: [{}, ownerScope(req)] }).lean(),
      Activity.find({ $and: [{ deletedAt: null }, ownerScope(req)] }).lean(),
      OPF.find({ $and: [{}, ownerScope(req)] }).lean(),
    ]);

    const mergedEvents = [
      ...leads.flatMap(collectLeadEvents),
      ...customers.flatMap(collectCustomerEvents),
      ...contacts.flatMap(collectContactEvents),
      ...campaigns.flatMap(collectCampaignEvents),
      ...suppliers.flatMap(collectSupplierEvents),
      ...activities.flatMap((activity) => {
        const dates = [
          { date: activity.activityDate, sourceField: 'activityDate' },
          { date: activity.followUpDate, sourceField: 'followUpDate' },
        ].filter((entry) => entry.date);
        return dates.map(({ date, sourceField }) => buildCalendarEvent({
          title: activity.activityType || 'Activity',
          module: 'Activities',
          date,
          time: activity[`${sourceField === 'activityDate' ? 'activity' : 'followUp'}Time`] || '09:00',
          endTime: activity[`${sourceField === 'activityDate' ? 'activity' : 'followUp'}EndTime`] || '',
          customerName: activity.company || activity.customerName || '',
          contactName: activity.contactPerson || '',
          assignedTo: activity.assignedUser || 'Unassigned',
          priority: activity.priority || 'Medium',
          status: activity.status || 'Pending',
          calendarStatus: activity.status === 'Completed' ? 'Completed' : undefined,
          description: activity.customerRemarks || activity.customerRequirements || 'CRM activity.',
          sourceField,
          referenceId: activity._id?.toString?.() || '',
          referenceModule: 'Activities',
          eventType: activity.activityType || 'Activity',
        })).filter(Boolean);
      }),
      ...opfs.flatMap(collectOPFEvents),
    ]
      .filter(Boolean)
      .filter((event, index, allEvents) => {
        const duplicateKey = [
          event.date,
          event.time,
          event.eventType.toLowerCase(),
          event.title.toLowerCase(),
          event.customerName.trim().toLowerCase(),
          event.contactName.trim().toLowerCase(),
        ].join('|');
        return allEvents.findIndex((candidate) => [
          candidate.date,
          candidate.time,
          candidate.eventType.toLowerCase(),
          candidate.title.toLowerCase(),
          candidate.customerName.trim().toLowerCase(),
          candidate.contactName.trim().toLowerCase(),
        ].join('|') === duplicateKey) === index;
      })
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
  'Mail Campaigns': { model: MailCampaign, softDelete: true, scope: { idField: 'employeeId', nameField: 'createdBy' }, completion: { calendarStatus: 'Completed' } },
  Suppliers: { model: Supplier, softDelete: false, completion: { calendarStatus: 'Completed' } },
  Activities: { model: Activity, softDelete: true, completion: { status: 'Completed' } },
  OPF: { model: OPF, softDelete: false, completion: null, dateFields: ['startDate', 'endDate', 'eta', 'customerPODate', 'renewalDate', 'renewalReminderDate', 'amcRenewalDate'] },
};

exports.completeCalendarEvent = async (req, res) => {
  try {
    const source = calendarSources[req.params.module];
    if (!source) return res.status(400).json({ success: false, message: 'Unsupported calendar event module' });
    if (!source.completion) return res.status(400).json({ success: false, message: 'This calendar event cannot be marked complete.' });
    const event = await source.model.findOneAndUpdate(
      { _id: req.params.id, ...(source.softDelete ? { deletedAt: null } : {}), ...ownerScope(req, source.scope) },
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
    const query = { _id: req.params.id, ...(source.softDelete ? { deletedAt: null } : {}), ...ownerScope(req, source.scope) };
    const sourceField = String(req.body?.sourceField || '');
    const allowedFields = {
      Leads: ['followUpDate', 'demoDate', 'meetingDate', 'callbackDate', 'nextActionDate', 'quotationDetails.expectedClosure'],
      Customers: ['meetingDate', 'renewalDate', 'contractExpiryDate', 'visitDate', 'nextActionDate'],
      Contacts: ['meetingDate', 'callReminderDate', 'birthday', 'anniversary', 'nextActionDate'],
      'Mail Campaigns': ['scheduledDate', 'createdDate'],
      Suppliers: ['deliveryDate', 'paymentReminderDate', 'followUpDate'],
      Activities: ['followUpDate', 'activityDate'],
      OPF: source.dateFields,
    }[req.params.module] || [];
    if (!allowedFields.includes(sourceField)) return res.status(400).json({ success: false, message: 'Invalid calendar event source field' });
    const event = source.softDelete && sourceField === 'activityDate'
      ? await source.model.findOneAndUpdate(query, { $set: { deletedAt: new Date() } }, { new: true })
      : await source.model.findOneAndUpdate(query, { $set: { [sourceField]: source.dateFields?.includes(sourceField) ? null : '' } }, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ success: false, message: 'Calendar event source not found' });
    res.status(200).json({ success: true, message: 'Calendar event deleted.' });
  } catch (error) {
    console.error('Calendar event action error:', error);
    res.status(500).json({ success: false, message: error.message || 'Unable to delete calendar event' });
  }
};
