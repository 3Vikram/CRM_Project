const CompanyProfile = require('../models/CompanyProfile');
const { DEFAULT_PAGE_SIZE } = require('../utils/queryUtils');

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
    const result = CompanyProfile.list({ page, limit, search, sortBy, sortOrder });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCompanyProfileById = async (req, res) => {
  try {
    const companyProfile = CompanyProfile.findById(req.params.id);
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

    const companyProfile = CompanyProfile.create(payload);
    res.status(201).json({ success: true, message: 'Company profile created successfully', data: companyProfile });
  } catch (error) {
    if (CompanyProfile.isValidationError(error)) {
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

    const companyProfile = CompanyProfile.updateById(req.params.id, payload);
    if (!companyProfile) {
      return res.status(404).json({ success: false, message: 'Company profile not found' });
    }
    res.status(200).json({ success: true, message: 'Company profile updated successfully', data: companyProfile });
  } catch (error) {
    if (CompanyProfile.isValidationError(error)) {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCompanyProfile = async (req, res) => {
  try {
    const companyProfile = CompanyProfile.deleteById(req.params.id);
    if (!companyProfile) {
      return res.status(404).json({ success: false, message: 'Company profile not found' });
    }
    res.status(200).json({ success: true, message: 'Company profile deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
