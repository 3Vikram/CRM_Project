const Supplier = require('../models/Supplier');
const { DEFAULT_PAGE_SIZE, parsePagination, normalizeSort, regexFromSearch } = require('../utils/queryUtils');

const normalizeSupplierPayload = (payload = {}) => {
  const source = payload || {};
  return {
    createdBy: `${source.createdBy || 'Admin'}`.trim(),
    supplierName: `${source.supplierName || ''}`.trim(),
    gstNumber: `${source.gstNumber || ''}`.trim(),
    category: `${source.category || ''}`.trim(),
    paymentTerms: `${source.paymentTerms || ''}`.trim(),
    addressLine1: `${source.addressLine1 || ''}`.trim(),
    country: `${source.country || ''}`.trim(),
    state: `${source.state || ''}`.trim(),
    city: `${source.city || ''}`.trim(),
    pinCode: `${source.pinCode || ''}`.trim(),
    bankName: `${source.bankName || ''}`.trim(),
    bankAddress: `${source.bankAddress || ''}`.trim(),
    accountHolder: `${source.accountHolder || ''}`.trim(),
    accountNumber: `${source.accountNumber || ''}`.trim(),
    ifscCode: `${source.ifscCode || ''}`.trim(),
    loginEmailId: `${source.loginEmailId || ''}`.trim(),
    loginPassword: `${source.loginPassword || ''}`.trim(),
    contactType: `${source.contactType || ''}`.trim(),
    contactName: `${source.contactName || ''}`.trim(),
    designation: `${source.designation || ''}`.trim(),
    emailId: `${source.emailId || ''}`.trim(),
    contactNumber: `${source.contactNumber || ''}`.trim(),
    product: `${source.product || ''}`.trim(),
  };
};

const normalizeSupplierRecord = (supplier = {}) => ({
  _id: supplier._id ? String(supplier._id) : '',
  supplierId: supplier.supplierId || '',
  ...supplier,
  createdBy: supplier.createdBy || 'Admin',
  supplierName: supplier.supplierName || '',
  gstNumber: supplier.gstNumber || '',
  category: supplier.category || '',
  paymentTerms: supplier.paymentTerms || '',
  addressLine1: supplier.addressLine1 || '',
  country: supplier.country || '',
  state: supplier.state || '',
  city: supplier.city || '',
  pinCode: supplier.pinCode || '',
  bankName: supplier.bankName || '',
  bankAddress: supplier.bankAddress || '',
  accountHolder: supplier.accountHolder || '',
  accountNumber: supplier.accountNumber || '',
  ifscCode: supplier.ifscCode || '',
  loginEmailId: supplier.loginEmailId || '',
  loginPassword: supplier.loginPassword || '',
  contactType: supplier.contactType || '',
  contactName: supplier.contactName || '',
  designation: supplier.designation || '',
  emailId: supplier.emailId || '',
  contactNumber: supplier.contactNumber || '',
  product: supplier.product || '',
});

const requiredFieldsPresent = ({ supplierName, category, paymentTerms, addressLine1, country, state }) => (
  Boolean(supplierName && category && paymentTerms && addressLine1 && country && state)
);

const isUniqueConstraint = (error) => ['SQLITE_CONSTRAINT_UNIQUE', 'SQLITE_CONSTRAINT_PRIMARYKEY'].includes(error.code);

exports.getSuppliers = async (req, res) => {
  try {
    Supplier.ensureIds();
    const {
      page = 1,
      limit = DEFAULT_PAGE_SIZE,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search = '',
      product = '',
      createdBy = '',
    } = req.query;
    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit });
    const safeSort = normalizeSort(sortBy, sortOrder, ['createdAt', 'supplierName', 'contactName', 'product', 'createdBy']);
    const [sortField, direction] = Object.entries(safeSort)[0];
    const searchValue = regexFromSearch(search)?.source || '';
    const filters = { search: searchValue, product, createdBy };
    const suppliers = Supplier.list({
      ...filters,
      sortBy: sortField,
      sortOrder: direction === 1 ? 'asc' : 'desc',
      limit: limitNum,
      offset: skip,
    });
    const total = Supplier.count(filters);

    res.status(200).json({
      success: true,
      data: suppliers.map(normalizeSupplierRecord),
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

exports.getSupplierById = async (req, res) => {
  try {
    const supplier = Supplier.getById(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.status(200).json({ success: true, data: normalizeSupplierRecord(supplier) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createSupplier = async (req, res) => {
  try {
    Supplier.ensureIds();
    const payload = normalizeSupplierPayload(req.body);
    if (!requiredFieldsPresent(payload)) {
      return res.status(400).json({ success: false, message: 'Supplier Name, Category, Payment Terms, Address, Country, and State are required.' });
    }
    const supplier = Supplier.create(payload);
    res.status(201).json({ success: true, message: 'Supplier created successfully', data: normalizeSupplierRecord(supplier) });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(({ message }) => message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    if (isUniqueConstraint(error)) {
      return res.status(409).json({ success: false, message: 'A Supplier with this ID already exists. Please retry.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSupplier = async (req, res) => {
  try {
    const payload = normalizeSupplierPayload(req.body);
    if (!requiredFieldsPresent(payload)) {
      return res.status(400).json({ success: false, message: 'Supplier Name, Category, Payment Terms, Address, Country, and State are required.' });
    }
    const supplier = Supplier.updateById(req.params.id, payload);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.status(200).json({ success: true, message: 'Supplier updated successfully', data: normalizeSupplierRecord(supplier) });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(({ message }) => message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    if (isUniqueConstraint(error)) {
      return res.status(409).json({ success: false, message: 'A Supplier with this ID already exists. Please retry.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteSupplier = async (req, res) => {
  try {
    const supplier = Supplier.deleteById(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.status(200).json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSuppliers: exports.getSuppliers,
  getSupplierById: exports.getSupplierById,
  createSupplier: exports.createSupplier,
  updateSupplier: exports.updateSupplier,
  deleteSupplier: exports.deleteSupplier,
};
