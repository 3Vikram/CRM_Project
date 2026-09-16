const Contact = require('../models/Contact');
const Customer = require('../models/Customer');
const multer = require('multer');
const XLSX = require('xlsx');
const { DEFAULT_PAGE_SIZE, parsePagination, normalizeSort, regexFromSearch } = require('../utils/queryUtils');

const normalizePhone = (value = '') => value.replace(/[^\d+]/g, '').trim();
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const importEmailPattern = /^\S+@\S+\.\S+$/;

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
    } = req.query;
    const query = {};
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

    res.status(200).json({
      success: true,
      data: contacts.map((contact) => normalizeContactRecord(contact)),
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

exports.getContactById = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id).select({ __v: 0 }).populate('customerId', 'customerName companyName').lean();
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
    const contact = await Contact.findById(req.params.id);
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

    const contact = await Contact.create({
      customerId: resolvedCustomerId || undefined,
      customerName,
      contactName,
      designation: designation || '',
      mail: mail || '',
      contactNumber,
      email,
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
    const inserted = await Contact.insertMany(newContacts, { ordered: false });
    res.status(201).json({ success: true, message: `Contacts imported successfully: ${inserted.length}`, imported: inserted.length, skipped });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Unable to process the Excel file.' });
  }
};

exports.updateContact = async (req, res) => {
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

    const contact = await Contact.findByIdAndUpdate(req.params.id, {
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
    const contact = await Contact.findByIdAndDelete(req.params.id);
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
  updateContact: exports.updateContact,
  deleteContact: exports.deleteContact,
  buildWhatsAppUrl,
};
