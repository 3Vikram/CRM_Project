const Contact = require('../models/Contact');
const Customer = require('../models/Customer');
const CustomerBatch = require('../models/CustomerBatch');
const Employee = require('../models/Employee');
const Counter = require('../models/Counter');
const multer = require('multer');
const XLSX = require('xlsx');
const { DEFAULT_PAGE_SIZE, parsePagination, normalizeSort, regexFromSearch } = require('../utils/queryUtils');

const normalizePhone = (value = '') => value.replace(/[^\d+]/g, '').trim();
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const importEmailPattern = /^\S+@\S+\.\S+$/;

const getEmployeeIdentity = async (req) => {
  if (req.user?.role === 'admin') return {
    employeeId: String(req.user.id),
    employeeEmail: String(req.user.email || '').trim().toLowerCase(),
    employeeName: String(req.user.name || req.user.email || 'Administrator').trim(),
  };

  const employeeId = String(req.user?.id || '').trim();
  if (!employeeId) throw new Error('Authenticated employee identity is missing.');
  const employee = await Employee.findById(employeeId).select('employeeName fullName email').lean();
  if (!employee) throw new Error('Authenticated employee record was not found.');

  return {
    employeeId,
    employeeEmail: String(employee.email || req.user.email || '').trim().toLowerCase(),
    employeeName: employee.employeeName || employee.fullName || String(req.user.name || employeeId),
  };
};

const buildWhatsAppUrl = (number) => {
  const normalized = normalizePhone(number);
  if (!normalized) return '';
  const withoutPlus = normalized.startsWith('+') ? normalized.slice(1) : normalized;
  if (withoutPlus.startsWith('91') && withoutPlus.length > 10) {
    return `https://wa.me/${withoutPlus}`;
  }
  if (/^\d{10}$/.test(withoutPlus)) {
    return `https://wa.me/91${withoutPlus}`;
  }
  return `https://wa.me/${withoutPlus}`;
};

const normalizeContactPayload = (payload = {}) => {
  const source = payload || {};
  const customerName = `${source.customerName || ''}`.trim();
  const contactName = `${source.contactName || source.contactPerson || ''}`.trim();
  const designation = `${source.designation || ''}`.trim();
  const mail = `${source.mail || ''}`.trim();
  const contactNumber = `${source.contactNumber || source.number || ''}`.trim();
  const email = `${source.email || ''}`.trim();
  const customerIdValue = source.customerId ? `${source.customerId}`.trim() : '';

  return {
    customerId: customerIdValue,
    customerName,
    contactName,
    designation,
    mail,
    contactNumber,
    email,
  };
};

const normalizeContactRecord = (contact = {}) => {
  const source = contact?.toObject ? contact.toObject() : contact || {};
  const populatedCustomer = source.customerId && typeof source.customerId === 'object' ? source.customerId : null;
  const normalized = {
    _id: source._id ? `${source._id}` : source._doc?._id ? `${source._doc._id}` : '',
    ...source,
  };
  normalized.customerId = populatedCustomer?._id ? `${populatedCustomer._id}` : source.customerId || source.customer || '';
  normalized.customerName = source.customerName || populatedCustomer?.customerName || populatedCustomer?.companyName || '';
  normalized.contactName = source.contactName || source.contactPerson || '';
  normalized.designation = source.designation || '';
  normalized.mail = source.mail || '';
  normalized.contactNumber = source.contactNumber || source.number || '';
  normalized.email = source.email || '';
  return normalized;
};

exports.getContacts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = DEFAULT_PAGE_SIZE,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search = '',
      batchName = '',
      batchNumber = '',
      batchId = '',
      employeeId = '',
    } = req.query;
    const effectiveEmployeeId = String(employeeId || '').trim();
    const query = {};
    if (batchId && !effectiveEmployeeId) {
      return res.status(400).json({ success: false, message: 'An employee ID is required when filtering by batch.' });
    }
    if (effectiveEmployeeId) query.employeeId = effectiveEmployeeId;
    const searchValue = regexFromSearch(search);

    if (searchValue) {
      query.$or = [
        { customerName: searchValue },
        { contactName: searchValue },
        { designation: searchValue },
        { contactNumber: searchValue },
        { email: searchValue },
      ];
    }
    if (batchName) query.batchName = batchName;
    if (batchNumber && Number.isInteger(Number(batchNumber))) query.batchNumber = Number(batchNumber);
    if (batchId) query.batchId = batchId;

    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit });
    const projection = {
      _id: 1,
      customerId: 1,
      customerName: 1,
      contactName: 1,
      designation: 1,
      mail: 1,
      contactNumber: 1,
      email: 1,
      batchName: 1,
      batchNumber: 1,
      employeeId: 1,
      employeeEmail: 1,
      employeeName: 1,
      batchId: 1,
      createdAt: 1,
    };
    const sortOptions = normalizeSort(sortBy, sortOrder, ['createdAt', 'customerName', 'contactName', 'email', 'contactNumber']);

    const [contacts, total] = await Promise.all([
      Contact.find(query)
        .select(projection)
        .populate('customerId', 'customerName companyName')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Contact.countDocuments(query),
    ]);

    const batchMatch = { $or: [{ batchNumber: { $gte: 1 } }, { batchName: { $nin: ['', null] } }] };
    if (effectiveEmployeeId) batchMatch.employeeId = effectiveEmployeeId;
    const batches = await Contact.aggregate([
      { $match: batchMatch },
      { $group: {
        _id: { $ifNull: ['$batchNumber', { $convert: { input: { $arrayElemAt: [{ $split: ['$batchName', ' '] }, 1] }, to: 'int', onError: null, onNull: null } }] },
        name: { $first: '$batchName' },
        count: { $sum: 1 },
      } },
      { $match: { _id: { $ne: null } } },
      { $project: { _id: 0, batchNumber: '$_id', name: { $cond: [{ $gt: ['$_id', 0] }, { $concat: ['Batch ', { $toString: '$_id' }] }, '$name'] }, count: 1 } },
      { $sort: { batchNumber: 1 } },
    ]);
    const employeeGroups = await buildEmployeeGroups();
    res.status(200).json({
      success: true,
      data: contacts.map((contact) => normalizeContactRecord(contact)),
      batches,
      employeeGroups,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const buildEmployeeGroups = async () => {
  const [employees, contactOwners, batchCounts, batches] = await Promise.all([
    Employee.find({}).select('employeeName fullName email').lean(),
    Contact.aggregate([
      { $match: { employeeId: { $nin: ['', null] } } },
      { $group: {
        _id: '$employeeId',
        employeeEmail: { $first: '$employeeEmail' },
        employeeName: { $first: '$employeeName' },
        count: { $sum: 1 },
      } },
    ]),
    Contact.aggregate([
      { $match: { employeeId: { $nin: ['', null] }, batchNumber: { $gte: 1 } } },
      { $group: { _id: { employeeId: '$employeeId', batchNumber: '$batchNumber' }, count: { $sum: 1 } } },
    ]),
    CustomerBatch.find({}).sort({ employeeId: 1, batchNumber: 1 }).lean(),
  ]);

  const groups = new Map();
  const ownersById = new Map();
  const ownersByEmail = new Map();
  const addOwner = ({ employeeId = '', employeeEmail = '', employeeName = '' }, preferEmployee = false) => {
    const id = String(employeeId || '').trim();
    const email = String(employeeEmail || '').trim().toLowerCase();
    if (!id && !email) return null;

    let owner = ownersById.get(id) || (email ? ownersByEmail.get(email) : null);
    if (!owner) {
      const key = email ? `email:${email}` : `id:${id}`;
      owner = {
        employeeId: id,
        employeeEmail: email,
        employeeName: employeeName || id || email,
        customerCount: 0,
        batches: [],
      };
      groups.set(key, owner);
    }
    if (id) ownersById.set(id, owner);
    if (email) ownersByEmail.set(email, owner);
    if (preferEmployee) {
      owner.employeeId = id || owner.employeeId;
      owner.employeeEmail = email || owner.employeeEmail;
      owner.employeeName = employeeName || owner.employeeName;
    } else if (!owner.employeeName || owner.employeeName === owner.employeeId) {
      owner.employeeName = employeeName || owner.employeeName;
    }
    return owner;
  };

  employees.forEach((employee) => {
    const employeeId = String(employee._id);
    addOwner({
      employeeId,
      employeeEmail: employee.email,
      employeeName: employee.employeeName || employee.fullName || employeeId,
    }, true);
  });

  contactOwners.forEach(({ _id, employeeEmail, employeeName, count }) => {
    const owner = addOwner({ employeeId: String(_id), employeeEmail, employeeName });
    if (owner) owner.customerCount += count;
  });

  const batchCountByOwner = new Map(batchCounts.map(({ _id, count }) => [`${_id.employeeId}:${_id.batchNumber}`, count]));
  batches.forEach((batch) => {
    const employeeId = String(batch.employeeId || '').trim();
    const owner = addOwner({ employeeId, employeeEmail: batch.employeeEmail, employeeName: batch.employeeName });
    if (!owner) return;
    const count = batchCountByOwner.get(`${employeeId}:${batch.batchNumber}`) || 0;
    owner.batches.push({
      _id: String(batch._id),
      employeeId,
      batchNumber: batch.batchNumber,
      name: `Batch ${batch.batchNumber}`,
      customerCount: count,
      count,
      fileName: batch.fileName,
      createdDate: batch.createdDate,
    });
  });

  return Array.from(groups.values())
    .map((owner) => ({
      ...owner,
      batches: owner.batches.sort((left, right) => left.batchNumber - right.batchNumber),
    }))
    .sort((left, right) => left.employeeName.localeCompare(right.employeeName));
};

exports.getEmployeeBatchGroups = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: await buildEmployeeGroups() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getContactById = async (req, res) => {
  try {
    const identity = await getEmployeeIdentity(req);
    const contact = await Contact.findOne({ _id: req.params.id, employeeId: identity.employeeId }).select({ __v: 0 }).populate('customerId', 'customerName companyName').lean();
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    res.status(200).json({ success: true, data: normalizeContactRecord(contact) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.moveContactToCustomer = async (req, res) => {
  try {
    const identity = await getEmployeeIdentity(req);
    const contact = await Contact.findOne({ _id: req.params.id, employeeId: identity.employeeId });
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    let customer = contact.customerId ? await Customer.findById(contact.customerId) : null;
    const customerName = `${contact.customerName || ''}`.trim();
    if (!customer && customerName) {
      const customerNamePattern = new RegExp(`^${customerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      customer = await Customer.findOne({ $or: [{ customerName: customerNamePattern }, { companyName: customerNamePattern }] });
    }

    const contactData = {
      contactType: 'Accounts',
      name: contact.contactName,
      email: contact.email,
      phone: contact.contactNumber,
      designation: contact.designation || '',
    };

    if (!customer) {
      customer = await Customer.create({
        companyName: customerName || contact.contactName,
        contacts: [contactData],
        status: 'Active',
        accountType: 'Individual',
        createdBy: 'Admin',
      });
    } else {
      const normalizedEmail = contact.email.toLowerCase();
      const normalizedPhone = contact.contactNumber.replace(/\D/g, '');
      const alreadyLinked = (customer.contacts || []).some((existingContact) => (
        existingContact.email?.toLowerCase() === normalizedEmail
        || existingContact.phone?.replace(/\D/g, '') === normalizedPhone
      ));

      if (!alreadyLinked) {
        customer.contacts.push(contactData);
        await customer.save();
      }
    }

    contact.customerId = customer._id;
    contact.customerName = customerName || contact.customerName || customer.companyName || customer.customerName;
    await contact.save();

    return res.status(200).json({
      success: true,
      message: 'Contact moved to customer successfully',
      data: {
        customer: customer.toObject ? customer.toObject() : customer,
        contact: normalizeContactRecord(contact.toObject ? contact.toObject() : contact),
      },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((entry) => entry.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createContact = async (req, res) => {
  try {
    const payload = normalizeContactPayload(req.body);
    const { customerId, customerName, contactName, designation = '', mail = '', contactNumber, email } = payload;

    let resolvedCustomerId = customerId || '';
    if (!resolvedCustomerId && customerName) {
      const customer = await Customer.findOne({ $or: [{ customerName }, { companyName: customerName }] });
      if (customer) {
        resolvedCustomerId = customer._id.toString();
      }
    }

    if (!contactName || !contactNumber || !email) {
      return res.status(400).json({ success: false, message: 'Contact Name, Contact Number, and Email are required.' });
    }

    const identity = await getEmployeeIdentity(req);
    const contact = await Contact.create({
      customerId: resolvedCustomerId || undefined,
      customerName,
      contactName,
      designation: designation || '',
      mail: mail || '',
      contactNumber,
      email,
      ...identity,
    });

    res.status(201).json({ success: true, message: 'Contact created successfully', data: normalizeContactRecord(contact.toObject ? contact.toObject() : contact) });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.importContacts = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Please upload an Excel file.' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return res.status(400).json({ success: false, message: 'The Excel file has no worksheet.' });

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (rows.length > 500) {
      return res.status(400).json({ success: false, message: 'A maximum of 500 contacts can be imported at once.' });
    }
    const contactsToInsert = [];
    const seenEmails = new Set();
    const seenPhones = new Set();
    let skipped = 0;

    for (const row of rows) {
      const values = Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key).trim().toLowerCase(), String(value ?? '').trim()]));
      const contactName = values['contact name'] || values.contactname || values['contact person'] || values.contactperson || '';
      const designation = values.designation || '';
      const contactNumber = normalizePhone(values['phone number'] || values.phonenumber || values.phone || values.number || '');
      const email = (values.email || values['email address'] || values.emailaddress || '').toLowerCase();
      const customerName = values['customer name'] || values.customername || values.company || '';

      if (!contactName && !designation && !contactNumber && !email && !customerName) continue;
      if (!contactName || !contactNumber || !importEmailPattern.test(email) || seenEmails.has(email) || seenPhones.has(contactNumber)) {
        skipped += 1;
        continue;
      }

      seenEmails.add(email);
      seenPhones.add(contactNumber);
      contactsToInsert.push({ contactName, designation, contactNumber, email, customerName, mail: values.mail || '' });
    }

    if (!contactsToInsert.length) return res.status(400).json({ success: false, message: 'No valid contacts were found in the Excel file.', skipped });

    const existing = await Contact.find({ $or: [
      { email: { $in: contactsToInsert.map((contact) => contact.email) } },
      { contactNumber: { $in: contactsToInsert.map((contact) => contact.contactNumber) } },
    ] }).select('email contactNumber').lean();
    const existingEmails = new Set(existing.map((contact) => contact.email));
    const existingPhones = new Set(existing.map((contact) => contact.contactNumber));
    const newContacts = contactsToInsert.filter((contact) => !existingEmails.has(contact.email) && !existingPhones.has(contact.contactNumber));
    skipped += contactsToInsert.length - newContacts.length;

    if (!newContacts.length) return res.status(200).json({ success: true, message: 'No new contacts to import.', imported: 0, skipped });
    const identity = await getEmployeeIdentity(req);
    const counterName = `contactBatch:${identity.employeeId}`;
    const [latestContactBatch, latestStoredBatch] = await Promise.all([
      Contact.findOne({ employeeId: identity.employeeId, batchNumber: { $gte: 1 } }).sort({ batchNumber: -1 }).select('batchNumber').lean(),
      CustomerBatch.findOne({ employeeId: identity.employeeId }).sort({ batchNumber: -1 }).select('batchNumber').lean(),
    ]);
    const highestExistingBatch = Math.max(latestContactBatch?.batchNumber || 0, latestStoredBatch?.batchNumber || 0);
    await Counter.findOneAndUpdate(
      { name: counterName },
      { $max: { value: highestExistingBatch } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const counter = await Counter.findOneAndUpdate(
      { name: counterName },
      { $inc: { value: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const batchNumber = counter.value;
    const batchName = `Batch ${batchNumber}`;
    const inserted = await Contact.insertMany(newContacts.map((contact) => ({ ...contact, ...identity, batchName, batchNumber })), { ordered: false });
    const batch = await CustomerBatch.create({
      ...identity,
      batchNumber,
      customerCount: inserted.length,
      customers: inserted.map((contact) => contact._id),
      fileName: req.file.originalname,
    });
    await Contact.updateMany({ _id: { $in: inserted.map((contact) => contact._id) } }, { $set: { batchId: batch._id } });
    res.status(201).json({ success: true, message: `Contacts imported successfully: ${inserted.length} (${batchName})`, imported: inserted.length, skipped, batchName, batchNumber, employeeId: identity.employeeId, employeeName: identity.employeeName, fileName: req.file.originalname });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Unable to process the Excel file.' });
  }
};

exports.updateContact = async (req, res) => {
  try {
    const identity = await getEmployeeIdentity(req);
    const payload = normalizeContactPayload(req.body);
    const { customerId, customerName, contactName, designation = '', mail = '', contactNumber, email } = payload;

    let resolvedCustomerId = customerId || '';
    if (!resolvedCustomerId && customerName) {
      const customer = await Customer.findOne({ $or: [{ customerName }, { companyName: customerName }] });
      if (customer) {
        resolvedCustomerId = customer._id.toString();
      }
    }

    const contact = await Contact.findOneAndUpdate({ _id: req.params.id, employeeId: identity.employeeId }, {
      customerId: resolvedCustomerId || undefined,
      customerName,
      contactName,
      designation: designation || '',
      mail: mail || '',
      contactNumber,
      email,
    }, { new: true, runValidators: true });
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    res.status(200).json({ success: true, message: 'Contact updated successfully', data: normalizeContactRecord(contact.toObject ? contact.toObject() : contact) });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    const identity = await getEmployeeIdentity(req);
    const contact = await Contact.findOneAndDelete({ _id: req.params.id, employeeId: identity.employeeId });
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    res.status(200).json({ success: true, message: 'Contact deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getContacts: exports.getContacts,
  getContactById: exports.getContactById,
  moveContactToCustomer: exports.moveContactToCustomer,
  createContact: exports.createContact,
  importContacts: exports.importContacts,
  importUpload,
  getEmployeeBatchGroups: exports.getEmployeeBatchGroups,
  updateContact: exports.updateContact,
  deleteContact: exports.deleteContact,
  buildWhatsAppUrl,
  buildEmployeeGroups,
};
