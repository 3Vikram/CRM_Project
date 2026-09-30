const CompanyProfile = require('../models/CompanyProfile');
const { DEFAULT_PAGE_SIZE, parsePagination, normalizeSort, regexFromSearch, escapeRegex } = require('../utils/queryUtils');

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

const mapFile = (file) => ({
  fileName: file.originalname,
  filePath: `/uploads/${file.filename}`,
  mimeType: file.mimetype,
});

exports.getCompanyProfiles = async (req, res) => {
  try {
    const { page = 1, limit = DEFAULT_PAGE_SIZE, search = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const query = {};
    const searchValue = regexFromSearch(search);
    if (searchValue) {
      query.$or = [
        { companyName: searchValue },
        { directorName: searchValue },
        { email: searchValue },
        { gstNo: searchValue },
      ];
    }

    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit });
    const projection = {
      directorName: 1,
      directorDesignation: 1,
      companyName: 1,
      branchName: 1,
      branchCode: 1,
      registeredAddress: 1,
      address: 1,
      city: 1,
      state: 1,
      pin: 1,
      country: 1,
      companyContactNo: 1,
      website: 1,
      companyLogo: 1,
      documentLogo: 1,
      documentHeader: 1,
      documentFooter: 1,
      documentHeaderRequired: 1,
      documentFooterRequired: 1,
      gstNo: 1,
      panNo: 1,
      bankName: 1,
      accountHolderName: 1,
      accountNo: 1,
      ifscCode: 1,
      swiftCode: 1,
      email: 1,
      quotationFormat: 1,
      idNoFormat: 1,
      opfFormat: 1,
      poFormat: 1,
      piFormat: 1,
      invoiceFormat: 1,
      prFormat: 1,
      enquiryFormat: 1,
      challanFormat: 1,
      cin: 1,
      iec: 1,
      createdAt: 1,
    };
    const sortOptions = normalizeSort(sortBy, sortOrder, ['directorName', 'directorDesignation', 'companyName', 'branchName', 'createdAt']);

    const [profiles, total] = await Promise.all([
      CompanyProfile.find(query).select(projection).sort(sortOptions).skip(skip).limit(limitNum).lean(),
      CompanyProfile.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: profiles,
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

exports.getCompanyProfileById = async (req, res) => {
  try {
    const companyProfile = await CompanyProfile.findById(req.params.id).select({ __v: 0 }).lean();
    if (!companyProfile) {
      return res.status(404).json({ success: false, message: 'Company profile not found' });
    }
    res.status(200).json({ success: true, data: companyProfile });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createCompanyProfile = async (req, res) => {
  try {
    const payload = parsePayload(req.body);
    if (req.files) {
      if (req.files.companyLogo?.[0]) payload.companyLogo = mapFile(req.files.companyLogo[0]);
      if (req.files.documentLogo?.[0]) payload.documentLogo = mapFile(req.files.documentLogo[0]);
      if (req.files.documentHeader?.[0]) payload.documentHeader = mapFile(req.files.documentHeader[0]);
      if (req.files.documentFooter?.[0]) payload.documentFooter = mapFile(req.files.documentFooter[0]);
    }

    const companyProfile = await CompanyProfile.create(payload);
    res.status(201).json({ success: true, message: 'Company profile created successfully', data: companyProfile });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCompanyProfile = async (req, res) => {
  try {
    const payload = parsePayload(req.body);
    if (req.files) {
      if (req.files.companyLogo?.[0]) payload.companyLogo = mapFile(req.files.companyLogo[0]);
      if (req.files.documentLogo?.[0]) payload.documentLogo = mapFile(req.files.documentLogo[0]);
      if (req.files.documentHeader?.[0]) payload.documentHeader = mapFile(req.files.documentHeader[0]);
      if (req.files.documentFooter?.[0]) payload.documentFooter = mapFile(req.files.documentFooter[0]);
    }

    const companyProfile = await CompanyProfile.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!companyProfile) {
      return res.status(404).json({ success: false, message: 'Company profile not found' });
    }
    res.status(200).json({ success: true, message: 'Company profile updated successfully', data: companyProfile });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCompanyProfile = async (req, res) => {
  try {
    const companyProfile = await CompanyProfile.findByIdAndDelete(req.params.id);
    if (!companyProfile) {
      return res.status(404).json({ success: false, message: 'Company profile not found' });
    }
    res.status(200).json({ success: true, message: 'Company profile deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
