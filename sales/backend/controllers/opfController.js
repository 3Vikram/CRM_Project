const OPF = require('../models/OPF');
const CompanyProfile = require('../models/CompanyProfile');
const { sendQuotationEmail } = require('../services/emailService');
const { DEFAULT_PAGE_SIZE, parsePagination, normalizeSort, regexFromSearch } = require('../utils/queryUtils');

const calculateFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= 4) return `${year}-${(year + 1).toString().slice(-2)}`;
  return `${year - 1}-${year.toString().slice(-2)}`;
};

const getOPFPrefix = () => {
  const companyProfile = CompanyProfile.findFirst();
  const format = (companyProfile?.opfFormat || 'OPF').trim();
  return `${format}${calculateFinancialYear()}/`;
};

const parsePayload = (body = {}) => {
  const payload = {};
  Object.entries(body).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          payload[key] = JSON.parse(trimmed);
          return;
        } catch (_error) {
          payload[key] = value;
          return;
        }
      }
    }
    payload[key] = value;
  });
  return payload;
};

const normalizeNumber = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const calculateDerivedFinancials = (opf = {}) => {
  const quantity = normalizeNumber(opf.quantity);
  const unitPrice = normalizeNumber(opf.unitPrice);
  const vendorPrice = normalizeNumber(opf.vendorPrice);

  const explicitRevenue = opf.revenue !== undefined && opf.revenue !== null && opf.revenue !== ''
    ? Number(opf.revenue)
    : null;
  const explicitMargin = opf.margin !== undefined && opf.margin !== null && opf.margin !== ''
    ? Number(opf.margin)
    : null;

  const derivedRevenue = quantity * unitPrice;
  const derivedMargin = derivedRevenue - (quantity * vendorPrice);

  return {
    revenue: Number.isFinite(explicitRevenue) ? explicitRevenue : derivedRevenue,
    margin: Number.isFinite(explicitMargin) ? explicitMargin : derivedMargin,
  };
};

const enrichOPFFinancials = (opf = {}) => ({
  ...opf,
  ...calculateDerivedFinancials(opf),
});

exports.getOPFs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = DEFAULT_PAGE_SIZE,
      search = '',
      createdBy = '',
      createdDate = '',
      renewalDate = '',
      customerName = '',
      approvalStatus = '',
      product = '',
      sortBy = 'createdDate',
      sortOrder = 'desc',
    } = req.query;

    const dayRange = (value) => {
      if (!value || value === 'all') return {};
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return {};
      return {
        start: new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString(),
        end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).toISOString(),
      };
    };
    const createdRange = dayRange(createdDate);
    const renewalRange = dayRange(renewalDate);

    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit });
    const sortOptions = normalizeSort(sortBy, sortOrder, ['createdDate', 'renewalDate', 'customerName', 'quotationNumber', 'approvalStatus']);
    const [safeSortBy, safeSortOrder] = Object.entries(sortOptions)[0];
    const { records: opfRecords, total } = OPF.list({
      search: regexFromSearch(search)?.source || '',
      createdBy,
      customerName,
      approvalStatus,
      product,
      createdDateStart: createdRange.start,
      createdDateEnd: createdRange.end,
      renewalDateStart: renewalRange.start,
      renewalDateEnd: renewalRange.end,
      sortBy: safeSortBy,
      sortOrder: safeSortOrder === 1 ? 'asc' : 'desc',
      limit: limitNum,
      offset: skip,
    });

    const enrichedRecords = opfRecords.map((opf) => enrichOPFFinancials(opf));

    res.status(200).json({
      success: true,
      data: enrichedRecords,
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

exports.getOPFById = async (req, res) => {
  try {
    const opf = OPF.getById(req.params.id);
    if (!opf) return res.status(404).json({ success: false, message: 'OPF not found' });
    res.status(200).json({ success: true, data: enrichOPFFinancials(opf) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createOPF = async (req, res) => {
  try {
    const payload = parsePayload(req.body);
    
    // Handle multiple file uploads
    if (req.files) {
      if (req.files.poFile && req.files.poFile[0]) {
        payload.poFile = {
          fileName: req.files.poFile[0].originalname,
          filePath: `/uploads/${req.files.poFile[0].filename}`,
          mimeType: req.files.poFile[0].mimetype,
        };
      }
      if (req.files.customerPOFile && req.files.customerPOFile[0]) {
        payload.customerPOFile = {
          fileName: req.files.customerPOFile[0].originalname,
          filePath: `/uploads/${req.files.customerPOFile[0].filename}`,
          mimeType: req.files.customerPOFile[0].mimetype,
        };
      }
      if (req.files.additionalDocument && req.files.additionalDocument[0]) {
        payload.additionalDocument = {
          fileName: req.files.additionalDocument[0].originalname,
          filePath: `/uploads/${req.files.additionalDocument[0].filename}`,
          mimeType: req.files.additionalDocument[0].mimetype,
        };
      }
      // Handle multiple uploaded documents
      if (req.files.uploadedDocuments && Array.isArray(req.files.uploadedDocuments)) {
        payload.uploadedDocuments = req.files.uploadedDocuments.map(file => ({
          fileName: file.originalname,
          filePath: `/uploads/${file.filename}`,
          mimeType: file.mimetype,
          uploadDate: new Date(),
        }));
      }
    }

    // Normalize numeric fields
    payload.createdBy = payload.createdBy || 'Admin';
    payload.quantity = normalizeNumber(payload.quantity);
    payload.unitPrice = normalizeNumber(payload.unitPrice);
    payload.vendorPrice = normalizeNumber(payload.vendorPrice);
    payload.serviceCost = normalizeNumber(payload.serviceCost);
    payload.serviceTax = normalizeNumber(payload.serviceTax);
    payload.freightCost = normalizeNumber(payload.freightCost);
    payload.freightTax = normalizeNumber(payload.freightTax);
    payload.wht = normalizeNumber(payload.wht);
    payload.conversionRate = normalizeNumber(payload.conversionRate);

    const generatedPrefix = payload.opfNo ? '' : getOPFPrefix();
    const opf = OPF.create(payload, generatedPrefix);
    res.status(201).json({ success: true, message: 'OPF created successfully', data: opf });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    if (['SQLITE_CONSTRAINT_UNIQUE', 'SQLITE_CONSTRAINT_PRIMARYKEY'].includes(error.code)) {
      return res.status(400).json({ success: false, message: 'This OPF number already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOPF = async (req, res) => {
  try {
    const payload = parsePayload(req.body);
    const existingOPF = OPF.getById(req.params.id);
    if (!existingOPF) {
      return res.status(404).json({ success: false, message: 'OPF not found' });
    }
    
    // Handle multiple file uploads
    if (req.files) {
      if (req.files.poFile && req.files.poFile[0]) {
        payload.poFile = {
          fileName: req.files.poFile[0].originalname,
          filePath: `/uploads/${req.files.poFile[0].filename}`,
          mimeType: req.files.poFile[0].mimetype,
        };
      }
      if (req.files.customerPOFile && req.files.customerPOFile[0]) {
        payload.customerPOFile = {
          fileName: req.files.customerPOFile[0].originalname,
          filePath: `/uploads/${req.files.customerPOFile[0].filename}`,
          mimeType: req.files.customerPOFile[0].mimetype,
        };
      }
      if (req.files.additionalDocument && req.files.additionalDocument[0]) {
        payload.additionalDocument = {
          fileName: req.files.additionalDocument[0].originalname,
          filePath: `/uploads/${req.files.additionalDocument[0].filename}`,
          mimeType: req.files.additionalDocument[0].mimetype,
        };
      }
      // Handle multiple uploaded documents
      if (req.files.uploadedDocuments && Array.isArray(req.files.uploadedDocuments)) {
        payload.uploadedDocuments = [
          ...(existingOPF.uploadedDocuments || []),
          ...req.files.uploadedDocuments.map(file => ({
            fileName: file.originalname,
            filePath: `/uploads/${file.filename}`,
            mimeType: file.mimetype,
            uploadDate: new Date(),
          })),
        ];
      }
    }

    // Normalize numeric fields
    payload.quantity = normalizeNumber(payload.quantity);
    payload.unitPrice = normalizeNumber(payload.unitPrice);
    payload.vendorPrice = normalizeNumber(payload.vendorPrice);
    payload.serviceCost = normalizeNumber(payload.serviceCost);
    payload.serviceTax = normalizeNumber(payload.serviceTax);
    payload.freightCost = normalizeNumber(payload.freightCost);
    payload.freightTax = normalizeNumber(payload.freightTax);
    payload.wht = normalizeNumber(payload.wht);
    payload.conversionRate = normalizeNumber(payload.conversionRate);

    const opf = OPF.updateById(req.params.id, payload);
    if (!opf) return res.status(404).json({ success: false, message: 'OPF not found' });

    res.status(200).json({ success: true, message: 'OPF updated successfully', data: opf });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    if (['SQLITE_CONSTRAINT_UNIQUE', 'SQLITE_CONSTRAINT_PRIMARYKEY'].includes(error.code)) {
      return res.status(400).json({ success: false, message: 'This OPF number already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteOPF = async (req, res) => {
  try {
    const opf = OPF.deleteById(req.params.id);
    if (!opf) return res.status(404).json({ success: false, message: 'OPF not found' });
    res.status(200).json({ success: true, message: 'OPF deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendOPFPdf = async (req, res) => {
  try {
    const { pdfData, recipientEmail } = req.body;
    if (!pdfData) return res.status(400).json({ success: false, message: 'PDF data is required' });
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
      return res.status(400).json({ success: false, message: 'Valid recipient email is required' });
    }

    const opf = OPF.getById(req.params.id);
    if (!opf) return res.status(404).json({ success: false, message: 'OPF not found' });

    const encodedPdf = typeof pdfData === 'string' && pdfData.includes(',') ? pdfData.split(',')[1] : pdfData;
    const pdfBuffer = Buffer.from(encodedPdf, 'base64');
    const opfReference = opf.opfNo || opf._id.toString();
    const pdfFileName = `opf-${opfReference}.pdf`;
    const emailResult = await sendQuotationEmail({
      recipient: recipientEmail.trim(),
      subject: `Order Processing Format ${opfReference}`,
      quotationNumber: opfReference,
      pdfBuffer,
      pdfFileName,
    });

    if (!emailResult.success) {
      return res.status(500).json({ success: false, message: emailResult.message, error: emailResult.errorMessage });
    }

    return res.status(200).json({
      success: true,
      message: emailResult.message,
      data: { opfId: req.params.id, recipient: recipientEmail, fileName: pdfFileName, messageId: emailResult.messageId },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to send OPF PDF', error: error.message });
  }
};
