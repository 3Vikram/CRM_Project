const OPF = require('../models/OPF');
const CompanyProfile = require('../models/CompanyProfile');
const { sendQuotationEmail } = require('../services/emailService');
const { DEFAULT_PAGE_SIZE, parsePagination, normalizeSort, regexFromSearch, escapeRegex } = require('../utils/queryUtils');

const calculateFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= 4) return `${year}-${(year + 1).toString().slice(-2)}`;
  return `${year - 1}-${year.toString().slice(-2)}`;
};

const createOPFNo = async () => {
  try {
    const companyProfile = await CompanyProfile.findOne({}).lean();
    const format = (companyProfile?.opfFormat || 'OPF').trim();
    const financialYear = calculateFinancialYear();
    const prefixPattern = `${format}${financialYear}/`;

    const latest = await OPF.findOne(
      { opfNo: new RegExp(`^${prefixPattern.replace(/\//g, '\\/')}`) },
      { opfNo: 1 }
    )
      .sort({ createdDate: -1 })
      .lean();

    let sequenceNumber = 1;
    if (latest && latest.opfNo) {
      const match = latest.opfNo.match(/(\d{3})$/);
      if (match) sequenceNumber = parseInt(match[1], 10) + 1;
    }

    return `${prefixPattern}${String(sequenceNumber).padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating OPF number:', error.message);
    const fallbackYear = calculateFinancialYear();
    return `OPF${fallbackYear}/001`;
  }
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

    const query = {};
    const searchValue = regexFromSearch(search);
    if (searchValue) {
      query.$or = [
        { opfNo: searchValue },
        { quotationNumber: searchValue },
        { quotationId: searchValue },
        { customerName: searchValue },
        { contactPerson: searchValue },
      ];
    }

    if (createdBy) query.createdBy = new RegExp(`^${escapeRegex(createdBy)}$`, 'i');
    if (customerName) query.customerName = new RegExp(`^${escapeRegex(customerName)}$`, 'i');
    if (approvalStatus) query.approvalStatus = approvalStatus;
    if (product) query.product = new RegExp(`^${escapeRegex(product)}$`, 'i');

    if (createdDate && createdDate !== 'all') {
      const date = new Date(createdDate);
      if (!Number.isNaN(date.getTime())) {
        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
        query.createdDate = { $gte: start, $lte: end };
      }
    }

    if (renewalDate && renewalDate !== 'all') {
      const date = new Date(renewalDate);
      if (!Number.isNaN(date.getTime())) {
        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
        query.renewalDate = { $gte: start, $lte: end };
      }
    }

    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit });
    const sortOptions = normalizeSort(sortBy, sortOrder, ['createdDate', 'renewalDate', 'customerName', 'quotationNumber', 'approvalStatus']);

    const [opfRecords, total] = await Promise.all([
      OPF.find(query).sort(sortOptions).skip(skip).limit(limitNum).lean(),
      OPF.countDocuments(query),
    ]);

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
    const opf = await OPF.findById(req.params.id).lean();
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

    if (!payload.opfNo) {
      payload.opfNo = await createOPFNo();
    }

    const opf = await OPF.create(payload);
    res.status(201).json({ success: true, message: 'OPF created successfully', data: opf });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'This OPF number already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOPF = async (req, res) => {
  try {
    const payload = parsePayload(req.body);
    const existingOPF = await OPF.findById(req.params.id).lean();
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

    const opf = await OPF.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });

    res.status(200).json({ success: true, message: 'OPF updated successfully', data: opf });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteOPF = async (req, res) => {
  try {
    const opf = await OPF.findByIdAndDelete(req.params.id);
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

    const opf = await OPF.findById(req.params.id).lean();
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
