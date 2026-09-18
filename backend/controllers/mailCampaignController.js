const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');
const multer = require('multer');
const mongoose = require('mongoose');
const MailCampaign = require('../models/MailCampaign');
const EmailLog = require('../models/EmailLog');
const Counter = require('../models/Counter');
const Customer = require('../models/Customer');
const Contact = require('../models/Contact');
const CompanyProfile = require('../models/CompanyProfile');
const Lead = require('../models/Lead');
const Supplier = require('../models/Supplier');
const { sendCampaignEmails } = require('../services/emailService');
const logger = require('../utils/logger');

let Employee = null;
try {
  Employee = require('../models/Employee');
} catch (_error) {
  Employee = null;
}

const uploadDir = path.join(__dirname, '../uploads/mail-campaigns');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
  const attachmentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-7z-compressed',
  ];
  const allowedTypes = file.fieldname === 'image' ? imageTypes : attachmentTypes;
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per uploaded file
    fieldSize: 5 * 1024 * 1024,  // 5 MB for text fields such as campaign body
    files: 11,                   // 1 image + up to 10 attachments
  },
  fileFilter,
});

const uploads = (req, res, next) => {
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'attachments', maxCount: 10 },
  ])(req, res, (error) => {
    if (error) {
      console.error('========== CAMPAIGN UPLOAD ERROR ==========');
      console.error('Name:', error.name);
      console.error('Code:', error.code);
      console.error('Message:', error.message);
      console.error('Field:', error.field);
      console.error('============================================');

      return res.status(400).json({
        success: false,
        message: error.message || 'Campaign file upload failed.',
        errorCode: error.code || 'UPLOAD_ERROR',
        field: error.field || null,
      });
    }

    next();
  });
};
const sanitize = (value = '') => sanitizeHtml(value, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'span', 'font']),
  allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, '*': ['style'], img: ['src', 'alt', 'title'] },
  allowedSchemes: ['http', 'https', 'mailto', 'data'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowedStyles: {
    '*': {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([^)]*\)$/i],
      'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgba?\([^)]*\)$/i],
      'font-size': [/^\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/i],
      'font-weight': [/^(?:normal|bold|[1-9]00)$/i],
      'text-align': [/^(?:left|center|right|justify)$/i],
      'text-decoration': [/^(?:none|underline|line-through)$/i],
    },
  },
});

const parseArrayField = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [parsed].filter(Boolean);
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
};

const parseCampaignGroups = (value) => {
  if (!value) return [];
  const rawGroups = Array.isArray(value) ? value : typeof value === 'string' ? (() => { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } })() : [];

  return rawGroups.map((group, index) => {
    const contactIds = Array.isArray(group?.contactIds) ? group.contactIds.map((id) => String(id)).filter(Boolean) : [];
    const recipientEmails = Array.isArray(group?.recipientEmails) ? group.recipientEmails.map((item) => String(item).trim()).filter(Boolean) : [];
    const cleanGroup = {
      groupName: String(group?.groupName || `Campaign Group ${index + 1}`).trim() || `Campaign Group ${index + 1}`,
      contactIds: [...new Set(contactIds)],
      subject: String(group?.subject || '').trim(),
      message: String(group?.message || '').trim(),
      status: group?.status || 'Draft',
      recipientEmails: [...new Set(recipientEmails)],
      sentDate: group?.sentDate || '',
      deliveryResults: Array.isArray(group?.deliveryResults) ? group.deliveryResults : [],
    };
    return cleanGroup;
  });
};

const resolveContactRecipients = async (groups) => {
  const requestedContactIds = [...new Set(groups.flatMap((group) => group.contactIds).filter(Boolean))];
  const contactIds = requestedContactIds.filter((id) => mongoose.isValidObjectId(id));
  if (requestedContactIds.length && contactIds.length !== requestedContactIds.length) {
    const error = new Error('One or more Contact identifiers are invalid.');
    error.name = 'CastError';
    throw error;
  }
  const contactQuery = contactIds.length
    ? { _id: { $in: contactIds }, email: { $regex: validEmailRegex } }
    : { email: { $regex: validEmailRegex } };
  const contacts = await Contact.find(contactQuery).select('_id email').lean();
  const emailByContactId = new Map(contacts.map((contact) => [String(contact._id), String(contact.email).trim().toLowerCase()]));

  return groups.map((group) => {
      const validContactIds = requestedContactIds.length
      ? group.contactIds.filter((id) => emailByContactId.has(String(id)))
      : contacts.map((contact) => String(contact._id));
    return {
      ...group,
      contactIds: validContactIds,
      recipientEmails: [...new Set(validContactIds.map((id) => emailByContactId.get(String(id))).filter(Boolean))],
    };
  });
};

const normalizeCampaign = (campaign) => ({
  ...campaign,
  _id: campaign._id?.toString(),
  recipientModules: campaign.recipientModules || [],
  recipientGroup: campaign.recipientGroup || [],
  recipientEmails: campaign.recipientEmails || [],
  attachments: campaign.attachments || [],
  image: campaign.image || '',
  tags: campaign.tags || [],
  campaignGroups: Array.isArray(campaign.campaignGroups) ? campaign.campaignGroups.map((group) => ({
    ...group,
    _id: group._id ? group._id.toString() : undefined,
    contactIds: Array.isArray(group.contactIds) ? group.contactIds.map((id) => String(id)) : [],
    recipientEmails: Array.isArray(group.recipientEmails) ? group.recipientEmails : [],
    deliveryResults: Array.isArray(group.deliveryResults) ? group.deliveryResults : [],
  })) : [],
  deliveryResults: campaign.deliveryResults || [],
});

const leadLocks = new Map();

const createLeadId = async () => {
  const existingLeadIds = await Lead.find({ leadId: /^LD-\d+$/ }, { leadId: 1 }).lean();
  const highestExistingId = existingLeadIds.reduce((highest, lead) => {
    const sequence = Number(String(lead.leadId).slice(3));
    return Number.isSafeInteger(sequence) ? Math.max(highest, sequence) : highest;
  }, 0);
  await Counter.findOneAndUpdate(
    { name: 'leadIdSequence' },
    { $max: { value: highestExistingId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const counter = await Counter.findOneAndUpdate(
    { name: 'leadIdSequence' },
    { $inc: { value: 1 } },
    { new: true },
  );
  if (!counter || !Number.isSafeInteger(counter.value)) throw new Error('Failed to generate Lead ID sequence.');
  return `LD-${counter.value}`;
};

const ensureEngagementLead = async ({ log, openCount, clickCount }) => {
  if (openCount < 2 && clickCount < 2) return null;

  const email = String(log.recipientEmail || '').trim().toLowerCase();
  const previous = leadLocks.get(email) || Promise.resolve();
  const current = previous.then(async () => {
    const contact = await Contact.findOne({ email }).lean();
    const now = new Date();
    const leadValues = {
      companyName: contact?.customerName || email,
      contactPerson: contact?.contactName || email,
      designation: contact?.designation || '',
      mobile: contact?.contactNumber || '0000000000',
      email,
      source: 'Mail Campaign',
      sourceOfLead: 'Mail Campaign',
      campaignId: log.campaignId,
      campaignName: log.campaignName || '',
      openCount,
      emailOpenCount: openCount,
      linkClicks: clickCount,
      firstOpenedAt: log.firstOpenedAt || null,
      lastOpenedAt: log.lastOpenedAt || null,
      firstClickedAt: log.firstClickedAt || null,
      lastClickedAt: log.lastClickedAt || null,
      lastOpenTime: log.lastOpenedAt || null,
      remarks: `Created from Mail Campaign ${log.campaignId}`,
    };

    let lead = await Lead.findOne({ email }).select('_id leadId').lean();
    let created = false;
    if (lead) {
      await Lead.updateOne({ _id: lead._id }, {
        $set: {
          ...leadValues,
          'engagement.emailOpens': openCount,
          'engagement.linkClicks': clickCount,
        },
      });
    } else {
      try {
        lead = await Lead.create({ ...leadValues, leadId: await createLeadId() });
        created = true;
      } catch (error) {
        if (error?.code !== 11000) throw error;
        lead = await Lead.findOne({ email }).select('_id leadId').lean();
        if (!lead) throw error;
        await Lead.updateOne({ _id: lead._id }, {
          $set: {
            ...leadValues,
            'engagement.emailOpens': openCount,
            'engagement.linkClicks': clickCount,
          },
        });
      }
    }

    await EmailLog.updateOne(
      { _id: log._id },
      { $set: { leadCreated: true, leadId: lead.leadId || '' } },
    );
    logger.info('mail-campaign.engagement-lead.updated', {
      campaignId: log.campaignId,
      recipientEmail: email,
      leadId: lead.leadId,
      created,
      openCount,
      clickCount,
    });
    return { leadId: lead.leadId, created };
  });
  leadLocks.set(email, current);
  current.finally(() => {
    if (leadLocks.get(email) === current) leadLocks.delete(email);
  }).catch(() => {});
  return current;
};

const getNextCampaignId = async () => {
  const campaigns = await MailCampaign.find(
    { campaignId: /^CMP-\d+$/ },
    { campaignId: 1 }
  ).lean();
  const highestNumber = campaigns.reduce((highest, campaign) => {
    const number = Number(String(campaign.campaignId).slice(4));
    return Number.isSafeInteger(number) ? Math.max(highest, number) : highest;
  }, 0);

  return `CMP-${highestNumber + 1}`;
};

const createCampaignWithUniqueId = async (payload) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const campaignId = await getNextCampaignId();
      return await MailCampaign.create({ ...payload, campaignId });
    } catch (error) {
      if (error?.code !== 11000 || attempt === 4) throw error;
    }
  }

  throw new Error('Failed to generate a unique campaign ID');
};

const isValidEmail = (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const respondToDatabaseError = (res, error, fallback) => {
  if (error?.code === 11000) {
    return res.status(409).json({ success: false, message: 'A campaign with this ID already exists. Please retry.' });
  }
  if (error?.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: 'Campaign data is invalid. Check the required fields and values.' });
  }
  if (error?.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Campaign or Contact identifier is invalid.' });
  }
  logger.error('mail-campaign.database.failed', { message: error?.message, stack: error?.stack, fallback });
  return res.status(500).json({ success: false, message: fallback });
};

const getEmailList = async (Model, fieldName, filter = {}) => {
  if (!Model) return [];
  const docs = await Model.find({ ...filter, [fieldName]: { $regex: validEmailRegex } }).select(fieldName).lean();
  return docs
    .map((doc) => String(doc[fieldName] || '').trim().toLowerCase())
    .filter(Boolean)
    .filter((email, index, arr) => arr.indexOf(email) === index);
};

exports.getRecipientCounts = async (_req, res) => {
  try {
    const [customers, contacts, leads, suppliers, employees] = await Promise.all([
      Customer.countDocuments({ email: { $regex: validEmailRegex } }),
      Contact.countDocuments({ email: { $regex: validEmailRegex } }),
      Lead.countDocuments({ email: { $regex: validEmailRegex } }),
      Supplier.countDocuments({ emailId: { $regex: validEmailRegex } }),
      Employee ? Employee.countDocuments({ email: { $regex: validEmailRegex } }) : 0,
    ]);

    res.status(200).json({
      success: true,
      data: {
        Customers: customers,
        Contacts: contacts,
        Leads: leads,
        Suppliers: suppliers,
        Employees: employees,
      },
    });
  } catch (error) {
    console.error('Failed to load recipient counts:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load recipient counts.' });
  }
};

exports.getRecipientData = async (req, res) => {
  try {
    const requestedModules = String(req.query.modules || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const selectedModules = requestedModules.length ? requestedModules : ['Customers', 'Contacts', 'Leads', 'Suppliers', 'Employees'];
    const data = {};

    for (const moduleName of selectedModules) {
      if (moduleName === 'Customers') {
        data[moduleName] = await getEmailList(Customer, 'email');
      } else if (moduleName === 'Contacts') {
        data[moduleName] = await getEmailList(Contact, 'email');
      } else if (moduleName === 'Leads') {
        data[moduleName] = await getEmailList(Lead, 'email');
      } else if (moduleName === 'Suppliers') {
        data[moduleName] = await getEmailList(Supplier, 'emailId');
      } else if (moduleName === 'Employees' && Employee) {
        data[moduleName] = await getEmailList(Employee, 'email');
      } else {
        data[moduleName] = [];
      }
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Failed to load recipient details:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load recipient details.' });
  }
};

exports.uploads = uploads;

exports.getCampaigns = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search = '',
      status = '',
      recipientGroup = '',
      createdBy = '',
    } = req.query;
    const query = { deletedAt: null };

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { campaignName: regex },
        { campaignId: regex },
        { subject: regex },
        { recipientGroup: regex },
      ];
    }

    if (status) query.status = status;
    if (recipientGroup) query.recipientGroup = new RegExp(`^${recipientGroup}$`, 'i');
    if (createdBy) query.createdBy = new RegExp(`^${createdBy}$`, 'i');

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10), 1), 100);
    const skip = (pageNum - 1) * limitNum;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const projection = {
      campaignId: 1,
      campaignName: 1,
      subject: 1,
      campaignType: 1,
      priority: 1,
      recipientGroup: 1,
      recipientEmails: 1,
      recipientCount: 1,
      status: 1,
      createdBy: 1,
      createdDate: 1,
      scheduledDate: 1,
      scheduledTime: 1,
      opens: 1,
      uniqueOpens: 1,
      clicks: 1,
      createdAt: 1,
      updatedAt: 1,
    };

    const [campaigns, total] = await Promise.all([
      MailCampaign.find(query, projection).sort({ [sortBy]: sortDirection }).skip(skip).limit(limitNum).lean(),
      MailCampaign.countDocuments(query),
    ]);

    const campaignIds = campaigns.map((campaign) => campaign.campaignId);
    const engagementCounts = await EmailLog.aggregate([
      { $match: { campaignId: { $in: campaignIds } } },
      { $group: {
        _id: '$campaignId',
        totalOpens: { $sum: { $ifNull: ['$openCount', 0] } },
        totalClicks: { $sum: { $ifNull: ['$clickCount', 0] } },
      } },
    ]);
    const engagementByCampaign = new Map(engagementCounts.map((item) => [item._id, item]));

    res.status(200).json({
      success: true,
      data: campaigns.map((campaign) => normalizeCampaign({
        ...campaign,
        opens: engagementByCampaign.get(campaign.campaignId)?.totalOpens || 0,
        uniqueOpens: engagementByCampaign.get(campaign.campaignId)?.totalOpens || 0,
        clicks: engagementByCampaign.get(campaign.campaignId)?.totalClicks || 0,
      })),
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

exports.getCampaignById = async (req, res) => {
  try {
    const campaign = await MailCampaign.findOne({ _id: req.params.id, deletedAt: null }).lean();
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    const [engagement] = await EmailLog.aggregate([
      { $match: { campaignId: campaign.campaignId } },
      { $group: {
        _id: null,
        opens: { $sum: { $ifNull: ['$openCount', 0] } },
        clicks: { $sum: { $ifNull: ['$clickCount', 0] } },
        recipients: { $addToSet: { $cond: [{ $gt: [{ $ifNull: ['$openCount', 0] }, 0] }, '$recipientEmail', null] } },
      } },
      { $project: { _id: 0, opens: 1, clicks: 1, uniqueOpens: { $size: { $setDifference: ['$recipients', [null]] } } } },
    ]);
    res.status(200).json({
      success: true,
      data: normalizeCampaign({
        ...campaign,
        opens: engagement?.opens || 0,
        uniqueOpens: engagement?.uniqueOpens || 0,
        clicks: engagement?.clicks || 0,
      }),
    });
  } catch (error) {
    respondToDatabaseError(res, error, 'Unable to load campaign.');
  }
};

const buildPublicTrackingBaseUrl = (req) => {
  const configuredBaseUrl = process.env.MAIL_TRACKING_BASE_URL || process.env.TRACKING_BASE_URL || process.env.PUBLIC_API_URL || process.env.APP_URL || process.env.BACKEND_URL || process.env.BASE_URL || '';
  const forwardedProto = (req.headers && req.headers['x-forwarded-proto']) || req.protocol || 'https';
  const forwardedHost = (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || req.get('host') || '';
  const rawBaseUrl = configuredBaseUrl || `${Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto}://${Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost}`;
  const normalizedBaseUrl = String(rawBaseUrl)
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '');

  if (!normalizedBaseUrl || /(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?$/i.test(normalizedBaseUrl)) {
    throw new Error('MAIL_TRACKING_BASE_URL or TRACKING_BASE_URL must be configured with a public URL before sending mail campaigns.');
  }

  let parsedBaseUrl;
  try {
    parsedBaseUrl = new URL(normalizedBaseUrl);
  } catch (_error) {
    throw new Error('MAIL_TRACKING_BASE_URL must be a valid absolute URL.');
  }
  if (process.env.NODE_ENV === 'production' && parsedBaseUrl.protocol !== 'https:') {
    throw new Error('MAIL_TRACKING_BASE_URL must use HTTPS in production.');
  }

  return normalizedBaseUrl;
};

const getTrackingBaseUrl = (req) => buildPublicTrackingBaseUrl(req);

const getCompanyProfileWithLogo = () => CompanyProfile.findOne({
  'companyLogo.filePath': { $exists: true, $nin: ['', null] },
}).sort({ createdAt: -1 }).select('companyLogo website').lean();

const getPublicAssetUrl = (baseUrl, filePath) => {
  const value = String(filePath || '').trim();
  if (!value) return '';
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(value)) {
    const localUrl = new URL(value);
    return `${baseUrl}${localUrl.pathname}${localUrl.search}`;
  }
  if (/^https:\/\//i.test(value)) return value;
  return `${baseUrl}/${value.replace(/^\/+/, '')}`;
};

const rewriteEmailAssetUrls = (html, baseUrl) => String(html || '').replace(
  /(\bsrc\s*=\s*["'])([^"']+)(["'])/gi,
  (_match, prefix, source, suffix) => {
    if (/^(?:data:|cid:|https:\/\/)/i.test(source)) return `${prefix}${source}${suffix}`;
    return `${prefix}${getPublicAssetUrl(baseUrl, source)}${suffix}`;
  },
);

const removeCompanyLogoImages = (html, logoUrl) => String(html || '').replace(/<img\b[^>]*>/gi, (tag) => {
  const source = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] || '';
  const alt = tag.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] || '';
  return (logoUrl && source === logoUrl) || /company logo/i.test(alt) ? '' : tag;
});

const buildTrackingPixelUrl = (baseUrl, trackingId) => `${baseUrl}/api/mail-campaigns/track/open/${trackingId}`;

const buildCampaignEmailHtml = ({ htmlBody, footer, logoHtml, showFooterSeparator = true }) => `<div style="margin: 0; padding: 0; color: #1f2937; font-family: 'Times New Roman', Times, serif !important; font-size: 16px; line-height: 1.5;"><style>div, p, h1, h2, h3, span, li { font-family: 'Times New Roman', Times, serif !important; } p { margin: 0 0 16px; min-height: 1.5em; } img { width: auto; max-width: 100%; height: auto; }</style>${logoHtml}${htmlBody}${footer ? `<div style="margin-top: 24px; padding-top: 16px; ${showFooterSeparator ? 'border-top: 1px solid #e5e7eb;' : ''} font-family: 'Times New Roman', Times, serif !important;">${footer}</div>` : ''}</div>`;

const buildCampaignImageHtml = (imageUrl) => imageUrl
  ? `<p style="margin: 0 0 20px; min-height: 1.5em;"><img src="${imageUrl}" alt="" style="display: block; max-width: 100%; height: auto;" /></p>`
  : '';

const normalizeEmailDestination = (destination) => {
  let value = String(destination || '').trim().replace(/^(https?:\/\/)(?:🌐\s*)+/i, '$1');
  if (/^https?:\/\/www\.synov\.in(?:\/|$)/i.test(value) || /^https?:\/\/synov\.in(?:\/|$)/i.test(value)) {
    value = value.replace(/^http:\/\//i, 'https://').replace(/^https:\/\/synov\.in/i, 'https://www.synov.in');
  }
  return value;
};

const normalizeCompanyWebsite = (website) => {
  let value = String(website || '').trim().replace(/^(?:https?:\/\/)?(?:🌐\s*)+/i, '');
  value = value.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  if (/^synov\.in(?:\/|$)/i.test(value)) return 'https://www.synov.in';
  return normalizeEmailDestination(website);
};

const normalizeFooterWebsiteLinks = (html, websiteUrl) => String(html || '').replace(
  /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
  (_match, attributes, content) => {
    const href = attributes.match(/\bhref\s*=\s*(["'])([^"']+)\1/i)?.[2] || '';
    if (!/synov\.in/i.test(`${href} ${content}`)) return _match;
    let normalizedAttributes = attributes.replace(/\bhref\s*=\s*(["'])([^"']*)\1/i, `href="${websiteUrl}"`);
    if (!/\bhref\s*=/i.test(normalizedAttributes)) normalizedAttributes += ` href="${websiteUrl}"`;
    if (!/\btarget\s*=/i.test(normalizedAttributes)) normalizedAttributes += ' target="_blank"';
    normalizedAttributes = normalizedAttributes.replace(/\brel\s*=\s*(["'])([^"']*)\1/i, 'rel="noopener noreferrer"');
    if (!/\brel\s*=/i.test(normalizedAttributes)) normalizedAttributes += ' rel="noopener noreferrer"';
    return `<a${normalizedAttributes}>${content}</a>`;
  },
);

const isDirectSynovLink = (destination) => {
  const value = String(destination || '');
  if (normalizeEmailDestination(value) === 'https://www.synov.in') return true;
  try {
    const url = new URL(value);
    const originalUrl = url.searchParams.get('url') || '';
    return normalizeEmailDestination(originalUrl) === 'https://www.synov.in';
  } catch (_error) {
    return false;
  }
};

const addEmailTracking = (html, campaignId, trackingId, baseUrl) => {
  const trackedHtml = String(html || '').replace(/href\s*=\s*(["'])(https?:\/\/[^"']+)\1/gi, (_match, quote, destination) => (
    isDirectSynovLink(destination) || /\/api\/mail-campaigns\/(?:track|tracking)\/click\//i.test(destination)
      ? `href=${quote}${destination}${quote}`
      : `href=${quote}${baseUrl}/api/mail-campaigns/tracking/click/${trackingId}?url=${encodeURIComponent(normalizeEmailDestination(destination))}${quote}`
  ));
  const trackingPixelUrl = buildTrackingPixelUrl(baseUrl, trackingId);
  // Open tracking depends on remote images being loaded; clients that block images
  // or proxy/cache them can prevent or alter open events, so tracking is best-effort.
  const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px;" />`;
  if (/<\/body>/i.test(trackedHtml)) return trackedHtml.replace(/<\/body>/i, `${trackingPixel}</body>`);
  if (/<\/html>/i.test(trackedHtml)) return trackedHtml.replace(/<\/html>/i, `${trackingPixel}</html>`);
  return `${trackedHtml}${trackingPixel}`;
};

const syncCampaignOpenCount = async (campaignId) => {
  const [openSummary] = await EmailLog.aggregate([
    { $match: { campaignId } },
    { $group: {
      _id: null,
      uniqueOpens: { $addToSet: '$recipientEmail' },
      opens: { $sum: { $ifNull: ['$openCount', 0] } },
      clicks: { $sum: { $ifNull: ['$clickCount', 0] } },
    } },
  ]);
  const updateResult = await MailCampaign.updateOne(
    { campaignId },
    { $set: {
      opens: openSummary?.opens || 0,
      uniqueOpens: openSummary?.opens || 0,
      clicks: openSummary?.clicks || 0,
    } },
  );
  logger.info('mail-campaign.opens.updated', {
    campaignId,
    opensTotal: openSummary?.opens || 0,
    uniqueOpens: openSummary?.opens || 0,
    matchedCount: updateResult.matchedCount,
    modifiedCount: updateResult.modifiedCount,
  });
  return {
    opensTotal: openSummary?.opens || 0,
    uniqueOpens: openSummary?.opens || 0,
    clicksTotal: openSummary?.clicks || 0,
  };
};

exports.trackOpen = async (req, res) => {
  const trackingId = String(req.params.trackingId || req.params.token || '').trim();
  logger.info('mail-campaign.open.requested', { trackingId });
  console.log(`OPEN TRACKING REQUEST: trackingId=${trackingId}`);

  try {
    const log = await EmailLog.findOne({
      $or: [{ trackingId }, { trackingToken: trackingId }],
    }).select('_id campaignId campaignName recipientEmail trackingId trackingToken openCount clickCount openedAt firstOpenedAt lastOpenedAt firstClickedAt lastClickedAt leadCreated leadId').lean();

    if (!log) {
      logger.info('mail-campaign.tracking-id.not-found', { trackingId });
      console.log(`OPEN TRACKING NOT FOUND: trackingId=${trackingId}`);
      logger.info('mail-campaign.open-trace', { trackingId, emailLogFound: false });
      return res.status(200).type('gif').send(Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64'));
    }

    const now = new Date();
    const firstOpenLog = await EmailLog.findOneAndUpdate(
      { _id: log._id, $or: [{ openCount: { $exists: false } }, { openCount: 0 }] },
      [{ $set: {
        openCount: 1,
        openedAt: { $ifNull: ['$openedAt', now] },
        firstOpenedAt: { $ifNull: ['$firstOpenedAt', now] },
        lastOpenedAt: now,
      } }],
      { new: true },
    ).lean();

    if (firstOpenLog) {
      logger.info('mail-campaign.open.first-detected', {
        campaignId: log.campaignId,
        recipientEmail: log.recipientEmail,
        trackingId,
        openCount: 1,
      });
      await syncCampaignOpenCount(log.campaignId);
      const leadResult = await ensureEngagementLead({
        log: firstOpenLog,
        openCount: firstOpenLog.openCount || 0,
        clickCount: firstOpenLog.clickCount || 0,
      });
      console.log(`OPEN TRACKING UPDATED: campaignId=${firstOpenLog.campaignId} recipient=${firstOpenLog.recipientEmail} trackingId=${trackingId} previousOpenCount=${0} newOpenCount=${firstOpenLog.openCount} campaignTotalOpensIncremented=${1} leadThresholdReached=${Boolean(leadResult)} leadCreatedOrUpdated=${Boolean(leadResult)}`);
    } else {
      const refreshedLog = await EmailLog.findOneAndUpdate(
        { _id: log._id },
        [{
          $set: {
            openCount: { $add: [{ $ifNull: ['$openCount', 0] }, 1] },
            openedAt: { $ifNull: ['$openedAt', now] },
            firstOpenedAt: { $ifNull: ['$firstOpenedAt', now] },
            lastOpenedAt: now,
          },
        }],
        { new: true },
      ).lean();

      logger.info('mail-campaign.open.repeat-detected', {
        campaignId: log.campaignId,
        recipientEmail: log.recipientEmail,
        trackingId,
        previousOpenCount: log.openCount || 0,
        newOpenCount: refreshedLog?.openCount || 0,
        previousOpenedAt: log.openedAt,
        lastOpenedAt: refreshedLog?.lastOpenedAt,
      });

      console.log(`REPEAT OPEN TRACKING RECEIVED: campaignId=${log.campaignId} recipient=${log.recipientEmail} trackingId=${trackingId} openCount=${refreshedLog?.openCount || 0}`);

      await syncCampaignOpenCount(log.campaignId);

      const leadResult = await ensureEngagementLead({
        log: refreshedLog,
        openCount: refreshedLog?.openCount || 0,
        clickCount: refreshedLog?.clickCount || 0,
      });

      if (leadResult) {
        console.log(`LEAD CREATED/UPDATED FROM REPEAT OPEN: campaignId=${refreshedLog.campaignId} recipient=${refreshedLog.recipientEmail} leadId=${leadResult.leadId} openCount=${refreshedLog.openCount} clickCount=${refreshedLog.clickCount || 0}`);
      }
    }
  } catch (error) {
    logger.error('mail-campaign.track-open.failed', { trackingId, message: error?.message, stack: error?.stack });
  }

  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  res.type('gif').send(Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64'));
};

exports.getTrackingDiagnostic = async (req, res) => {
  if (String(process.env.TRACKING_DIAGNOSTICS).toLowerCase() !== 'true') {
    return res.status(404).json({ success: false, message: 'Tracking diagnostics are disabled.' });
  }

  const trackingId = String(req.params.trackingId || '').trim();
  const log = await EmailLog.findOne({ $or: [{ trackingId }, { trackingToken: trackingId }] })
    .select('campaignId campaignName recipientEmail status trackingId trackingToken openCount openedAt clickedAt sentAt')
    .lean();
  if (!log) return res.status(404).json({ success: false, found: false, trackingId });

  const campaign = await MailCampaign.findOne({ campaignId: log.campaignId }).select('campaignId campaignName opens uniqueOpens clicks').lean();
  return res.status(200).json({
    success: true,
    found: true,
    trackingId,
    recipientEmail: log.recipientEmail,
    campaignId: log.campaignId,
    emailLog: {
      status: log.status,
      openCount: log.openCount || 0,
      openedAt: log.openedAt,
      clickedAt: log.clickedAt,
      sentAt: log.sentAt,
    },
    campaign: campaign ? {
      opens: campaign.opens || 0,
      uniqueOpens: campaign.uniqueOpens || 0,
      clicks: campaign.clicks || 0,
    } : null,
  });
};

exports.trackClick = async (req, res) => {
  const rawDestination = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  const originalUrl = String(rawDestination || '');
  let destination = originalUrl;
  if (!/^https?:\/\//i.test(destination) && /%/.test(destination)) {
    try {
      destination = decodeURIComponent(destination);
    } catch (_error) {
      return res.status(400).json({ success: false, message: 'Tracked destination is invalid.' });
    }
  }
  let destinationUrl;
  try {
    destinationUrl = new URL(destination);
  } catch (_error) {
    return res.status(400).json({ success: false, message: 'Tracked destination is invalid.' });
  }
  if (!['http:', 'https:'].includes(destinationUrl.protocol)) return res.status(400).json({ success: false, message: 'Tracked destination is invalid.' });
  const redirectUrl = destination;
  const trackingId = String(req.params.token || req.params.trackingId || '').trim();
  console.log(`CLICK REDIRECT trackingId=${trackingId} originalUrl=${originalUrl} decodedUrl=${destination} redirectUrl=${redirectUrl}`);
  try {
    const log = await EmailLog.findOne({ $or: [{ trackingId }, { trackingToken: trackingId }] })
      .select('_id campaignId campaignName recipientEmail openCount clickCount firstOpenedAt lastOpenedAt firstClickedAt lastClickedAt').lean();
    if (log) {
      const now = new Date();
      const updatedLog = await EmailLog.findOneAndUpdate(
        { _id: log._id },
        [{ $set: {
          clickCount: { $add: [{ $ifNull: ['$clickCount', 0] }, 1] },
          clickedAt: { $cond: [{ $eq: [{ $ifNull: ['$clickCount', 0] }, 0] }, now, '$clickedAt'] },
          firstClickedAt: { $cond: [{ $eq: [{ $ifNull: ['$clickCount', 0] }, 0] }, now, '$firstClickedAt'] },
          lastClickedAt: now,
        } }],
        { new: true },
      ).lean();
      const campaignUpdate = await MailCampaign.updateOne({ campaignId: updatedLog.campaignId }, { $inc: { clicks: 1 } });
      const leadResult = await ensureEngagementLead({
        log: updatedLog,
        openCount: updatedLog.openCount || 0,
        clickCount: updatedLog.clickCount || 0,
      });
      console.log(`CLICK TRACKING UPDATED: campaignId=${updatedLog.campaignId} recipient=${updatedLog.recipientEmail} trackingId=${trackingId} previousClickCount=${(updatedLog.clickCount || 0) - 1} newClickCount=${updatedLog.clickCount} campaignTotalClicksIncremented=${campaignUpdate.modifiedCount ? 1 : 0} originalUrl=${destination} leadThresholdReached=${Boolean(leadResult)} leadCreatedOrUpdated=${Boolean(leadResult)}`);
    }
  } catch (error) {
    logger.error('mail-campaign.track-click.failed', { message: error?.message, stack: error?.stack });
  }
  return res.redirect(302, redirectUrl);
};

exports.getCampaignReport = async (req, res) => {
  try {
    const campaign = await MailCampaign.findOne({ _id: req.params.id, deletedAt: null }).select('campaignId campaignName subject').lean();
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });
    const logs = await EmailLog.find({ campaignId: campaign.campaignId }).sort({ sentAt: 1 }).lean();
    res.status(200).json({
      success: true,
      data: logs.map((log, index) => ({
        serialNumber: index + 1,
        campaignId: campaign.campaignId,
        campaignName: campaign.campaignName,
        sentBy: log.senderEmail || process.env.EMAIL_USER || process.env.SMTP_USER || '',
        sentTo: log.recipientEmail,
        subject: campaign.subject,
        opens: log.openCount || 0,
        clicks: log.clickCount || 0,
      })),
    });
  } catch (error) {
    logger.error('mail-campaign.report.failed', { message: error?.message, stack: error?.stack });
    res.status(500).json({ success: false, message: 'Unable to load the campaign report.' });
  }
};

exports.getCampaignPreview = async (req, res) => {
  try {
    const campaign = await MailCampaign.findOne({ _id: req.params.id, deletedAt: null }).lean();
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });
    const companyProfile = await getCompanyProfileWithLogo();
    const trackingBaseUrl = getTrackingBaseUrl(req);
    const companyWebsiteUrl = normalizeCompanyWebsite(companyProfile?.website) || 'https://www.synov.in';
    const logoUrl = getPublicAssetUrl(trackingBaseUrl, companyProfile?.companyLogo?.filePath);
    console.log(`Company Profile logo field = ${JSON.stringify(companyProfile?.companyLogo || null)}`);
    console.log(`Company Profile logo path = ${companyProfile?.companyLogo?.filePath || '(none)'}`);
    console.log(`Resolved logo URL = ${logoUrl || '(none)'}`);
    const campaignImageUrl = getPublicAssetUrl(trackingBaseUrl, campaign.image);
    const logoBeforeText = ['Image Before Text', 'Image Above Text'].includes(campaign.imageAlignment);
    const imageBeforeText = logoBeforeText;
    const logoHtml = logoUrl
      ? `<p style="margin: 0 0 20px; min-height: 1.5em;"><img src="${logoUrl}" alt="" style="display: block; width: 120px; max-width: 120px; height: auto;" /></p>`
      : '';
    const campaignImageHtml = buildCampaignImageHtml(campaignImageUrl);
    const campaignBody = rewriteEmailAssetUrls(removeCompanyLogoImages(campaign.campaignBody || '<p>Campaign email</p>', logoUrl), trackingBaseUrl);
    const bodyWithCampaignImage = imageBeforeText
      ? `${campaignImageHtml}${campaignBody}`
      : `${campaignBody}${campaignImageHtml}`;
    const htmlBody = logoBeforeText
      ? `${logoHtml}${bodyWithCampaignImage}`
      : `${bodyWithCampaignImage}${logoHtml}`;
    const logs = await EmailLog.find({ campaignId: campaign.campaignId }).sort({ sentAt: -1 }).select('recipientEmail senderEmail').lean();
    res.status(200).json({
      success: true,
      data: {
        from: logs[0]?.senderEmail || process.env.EMAIL_USER || process.env.SMTP_USER || '',
        to: logs[0]?.recipientEmail || campaign.recipientEmails?.[0] || '',
        subject: campaign.subject,
        html: buildCampaignEmailHtml({ htmlBody, footer: rewriteEmailAssetUrls(normalizeFooterWebsiteLinks(removeCompanyLogoImages(campaign.footer, logoUrl), companyWebsiteUrl), trackingBaseUrl), logoHtml: '', showFooterSeparator: logoBeforeText }),
      },
    });
  } catch (error) {
    logger.error('mail-campaign.preview.failed', { message: error?.message, stack: error?.stack });
    res.status(500).json({ success: false, message: 'Unable to load the campaign email preview.' });
  }
};

exports.createCampaign = async (req, res) => {
  try {
    const incomingGroups = parseCampaignGroups(req.body.campaignGroups);
    const recipientEmails = parseArrayField(req.body.recipientEmails);
    const legacyGroups = incomingGroups.length ? incomingGroups : [{
      groupName: 'Campaign Group 1',
      contactIds: parseArrayField(req.body.contactIds),
      subject: req.body.subject || '',
      message: req.body.campaignBody || '',
      status: req.body.status || 'Draft',
      recipientEmails,
    }];
    const finalGroups = legacyGroups.map((group, index) => ({
      groupName: String(group.groupName || `Campaign Group ${index + 1}`).trim() || `Campaign Group ${index + 1}`,
      contactIds: Array.isArray(group.contactIds) ? group.contactIds.map((id) => String(id)).filter(Boolean) : [],
      subject: String(group.subject || req.body.subject || '').trim(),
      message: sanitize(String(group.message || req.body.campaignBody || '')),
      status: group.status || req.body.status || 'Draft',
      recipientEmails: [...new Set((Array.isArray(group.recipientEmails) ? group.recipientEmails : recipientEmails).map((item) => String(item).trim()).filter(Boolean))],
      sentDate: group.sentDate || '',
      deliveryResults: Array.isArray(group.deliveryResults) ? group.deliveryResults : [],
    }));

    const resolvedGroups = await resolveContactRecipients(finalGroups);
    const flattenedRecipientEmails = [...new Set(resolvedGroups.flatMap((group) => group.recipientEmails))];
    const campaignStatus = req.body.status || 'Draft';

    if (!req.body.campaignName?.trim()) {
      return res.status(400).json({ success: false, message: 'Campaign name is required.' });
    }
    if (!req.body.subject?.trim()) {
      return res.status(400).json({ success: false, message: 'Subject is required.' });
    }
    if (!flattenedRecipientEmails.length && campaignStatus !== 'Draft') {
      return res.status(400).json({ success: false, message: 'No Contacts with valid email addresses are available for this campaign.' });
    }
    if (campaignStatus === 'Scheduled' && (!req.body.scheduledDate || !req.body.scheduledTime)) {
      return res.status(400).json({ success: false, message: 'Scheduled date and time are required.' });
    }

    const payload = {
      campaignName: req.body.campaignName || '',
      subject: finalGroups[0]?.subject || req.body.subject || '',
      campaignType: req.body.campaignType || 'Promotional',
      priority: req.body.priority || 'Medium',
      imageAlignment: req.body.imageAlignment || 'Image Before Text',
      tags: parseArrayField(req.body.tags),
      recipientModules: parseArrayField(req.body.recipientModules),
      recipientGroup: parseArrayField(req.body.recipientGroup),
      recipientEmails: flattenedRecipientEmails,
      recipientCount: flattenedRecipientEmails.length,
      campaignBody: sanitize(req.body.campaignBody || finalGroups[0]?.message || ''),
      footer: sanitize(req.body.footer || ''),
      image: req.files?.image?.[0]?.filename ? `/uploads/mail-campaigns/${req.files.image[0].filename}` : req.body.image || '',
      attachments: (req.files?.attachments || []).map((file) => `/uploads/mail-campaigns/${file.filename}`),
      status: campaignStatus,
      createdBy: req.body.createdBy || process.env.DEFAULT_CREATED_BY || 'Admin',
      createdDate: req.body.createdDate || new Date().toISOString().split('T')[0],
      scheduledDate: req.body.scheduledDate || '',
      scheduledTime: req.body.scheduledTime || '',
      timezone: req.body.timezone || 'UTC',
      sentDate: req.body.sentDate || '',
      testEmail: req.body.testEmail || '',
      campaignGroups: resolvedGroups,
    };

    console.log({
      campaignNameLength: payload.campaignName?.length,
      subjectLength: payload.subject?.length,
      campaignBodyLength: payload.campaignBody?.length,
      footerLength: payload.footer?.length,
      imageLength: payload.image?.length,
      recipientCount: payload.recipientEmails?.length,
    });

    const campaign = await createCampaignWithUniqueId(payload);
    const campaignId = campaign.campaignId;

    logger.info('mail-campaign.created', {
      campaignId,
      campaignName: payload.campaignName,
      recipientCount: payload.recipientCount,
      recipientEmails: payload.recipientEmails,
      status: payload.status,
    });

    res.status(201).json({ success: true, message: 'Campaign created successfully', data: normalizeCampaign(campaign.toObject()) });
  } catch (error) {
    logger.error('mail-campaign.createCampaign.failed', {
      message: error?.message,
      stack: error?.stack,
    });
    respondToDatabaseError(res, error, 'Unable to create campaign due to an unexpected database error.');
  }
};

exports.updateCampaign = async (req, res) => {
  try {
    const existing = await MailCampaign.findOne({ _id: req.params.id, deletedAt: null });
    if (!existing) return res.status(404).json({ success: false, message: 'Campaign not found' });

    const incomingGroups = parseCampaignGroups(req.body.campaignGroups);
    const recipientEmails = parseArrayField(req.body.recipientEmails || existing.recipientEmails);
    const legacyGroups = incomingGroups.length ? incomingGroups : [{
      groupName: 'Campaign Group 1',
      contactIds: parseArrayField(req.body.contactIds),
      subject: req.body.subject || existing.subject || '',
      message: req.body.campaignBody || existing.campaignBody || '',
      status: req.body.status || existing.status || 'Draft',
      recipientEmails,
    }];
    const finalGroups = legacyGroups.map((group, index) => ({
      groupName: String(group.groupName || `Campaign Group ${index + 1}`).trim() || `Campaign Group ${index + 1}`,
      contactIds: Array.isArray(group.contactIds) ? group.contactIds.map((id) => String(id)).filter(Boolean) : [],
      subject: String(group.subject || req.body.subject || existing.subject || '').trim(),
      message: sanitize(String(group.message || req.body.campaignBody || existing.campaignBody || '')),
      status: group.status || req.body.status || existing.status || 'Draft',
      recipientEmails: [...new Set((Array.isArray(group.recipientEmails) ? group.recipientEmails : recipientEmails).map((item) => String(item).trim()).filter(Boolean))],
      sentDate: group.sentDate || existing.sentDate || '',
      deliveryResults: Array.isArray(group.deliveryResults) ? group.deliveryResults : [],
    }));

    const resolvedGroups = await resolveContactRecipients(finalGroups);
    const flattenedRecipientEmails = [...new Set(resolvedGroups.flatMap((group) => group.recipientEmails))];
    const campaignStatus = req.body.status || existing.status || 'Draft';

    const payload = {
      campaignName: req.body.campaignName || existing.campaignName || '',
      subject: finalGroups[0]?.subject || req.body.subject || existing.subject || '',
      campaignType: req.body.campaignType || existing.campaignType || 'Promotional',
      priority: req.body.priority || existing.priority || 'Medium',
      imageAlignment: req.body.imageAlignment || existing.imageAlignment || 'Image Before Text',
      tags: parseArrayField(req.body.tags || existing.tags),
      recipientModules: parseArrayField(req.body.recipientModules || existing.recipientModules),
      recipientGroup: parseArrayField(req.body.recipientGroup || existing.recipientGroup),
      recipientEmails: flattenedRecipientEmails,
      recipientCount: flattenedRecipientEmails.length,
      campaignBody: sanitize(req.body.campaignBody || finalGroups[0]?.message || existing.campaignBody || ''),
      footer: sanitize(req.body.footer || existing.footer || ''),
      image: req.files?.image?.[0]?.filename ? `/uploads/mail-campaigns/${req.files.image[0].filename}` : req.body.image || existing.image || '',
      attachments: (req.files?.attachments || []).length > 0
        ? (req.files?.attachments || []).map((file) => `/uploads/mail-campaigns/${file.filename}`)
        : (req.body.attachments ? parseArrayField(req.body.attachments) : existing.attachments || []),
      status: campaignStatus,
      createdBy: req.body.createdBy || existing.createdBy || process.env.DEFAULT_CREATED_BY || 'Admin',
      createdDate: req.body.createdDate || existing.createdDate || new Date().toISOString().split('T')[0],
      scheduledDate: req.body.scheduledDate || existing.scheduledDate || '',
      scheduledTime: req.body.scheduledTime || existing.scheduledTime || '',
      timezone: req.body.timezone || existing.timezone || 'UTC',
      sentDate: req.body.sentDate || existing.sentDate || '',
      testEmail: req.body.testEmail || existing.testEmail || '',
      campaignGroups: resolvedGroups,
    };

    if (!payload.campaignName || !resolvedGroups.length || (campaignStatus !== 'Draft' && !flattenedRecipientEmails.length)) {
      return res.status(400).json({ success: false, message: 'Please select at least one contact with a valid email address.' });
    }
    if (campaignStatus === 'Scheduled' && (!payload.scheduledDate || !payload.scheduledTime)) {
      return res.status(400).json({ success: false, message: 'Scheduled date and time are required.' });
    }

    const campaign = await MailCampaign.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    res.status(200).json({ success: true, message: 'Campaign updated successfully', data: normalizeCampaign(campaign.toObject()) });
  } catch (error) {
    console.error('[mail-campaign] updateCampaign failed:', error);
    respondToDatabaseError(res, error, 'Unable to update campaign due to an unexpected database error.');
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const identifier = String(req.params.id || '').trim();
    const campaignQuery = mongoose.isValidObjectId(identifier)
      ? { $or: [{ _id: identifier }, { campaignId: identifier }] }
      : { campaignId: identifier };
    const campaign = await MailCampaign.findOne(campaignQuery);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

    const campaignFiles = [campaign.image, ...(campaign.attachments || [])]
      .filter((filePath) => typeof filePath === 'string' && filePath.startsWith('/uploads/mail-campaigns/'))
      .map((filePath) => path.join(__dirname, '..', filePath.replace(/^\/+/, '')));

    await Promise.all([
      MailCampaign.deleteOne({ _id: campaign._id }),
      EmailLog.deleteMany({ campaignId: campaign.campaignId }),
    ]);
    await Promise.all(campaignFiles.map(async (filePath) => {
      try {
        await fs.promises.unlink(filePath);
      } catch (error) {
        if (error.code !== 'ENOENT') logger.error('mail-campaign.file-delete.failed', { message: error.message, campaignId: campaign.campaignId });
      }
    }));

    res.status(200).json({ success: true, message: 'Campaign deleted successfully.' });
  } catch (error) {
    logger.error('mail-campaign.delete.failed', { message: error?.message, stack: error?.stack });
    respondToDatabaseError(res, error, 'Unable to delete campaign.');
  }
};

exports.sendCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await MailCampaign.findOne({ _id: id, deletedAt: null });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const groupId = req.body?.groupId || req.query?.groupId || '';
    let subject = campaign.subject || '';
    let htmlBody = campaign.campaignBody || '<p>Campaign email</p>';
    let recipients = [];
    let targetGroup = null;

    if (groupId) {
      targetGroup = (campaign.campaignGroups || []).find((group) => String(group._id) === String(groupId) || String(group.groupName) === String(groupId));
      if (!targetGroup) {
        return res.status(404).json({ success: false, message: 'Campaign group not found.' });
      }
      subject = targetGroup.subject || campaign.subject || '';
      htmlBody = targetGroup.message || campaign.campaignBody || '<p>Campaign email</p>';
      const [refreshedGroup] = await resolveContactRecipients([targetGroup]);
      recipients = refreshedGroup.recipientEmails;
      targetGroup.contactIds = refreshedGroup.contactIds;
      targetGroup.recipientEmails = refreshedGroup.recipientEmails;
      targetGroup.status = 'Sending';
      targetGroup.sentDate = '';
      await campaign.save();
    } else {
      const refreshedGroups = await resolveContactRecipients(campaign.campaignGroups || [{ contactIds: [] }]);
      recipients = refreshedGroups.flatMap((group) => group.recipientEmails);
      campaign.campaignGroups = refreshedGroups;
      campaign.recipientEmails = [...new Set(recipients)];
      campaign.status = 'Sending';
      campaign.recipientCount = recipients.length;
      await campaign.save();
    }

    const normalizedRecipients = [...new Set(recipients.map((item) => String(item).trim()).filter(Boolean))];

    if (!normalizedRecipients.length) {
      return res.status(400).json({ success: false, message: 'No recipients found for this campaign group.' });
    }

    const trackingBaseUrl = getTrackingBaseUrl(req);
    const companyProfile = await getCompanyProfileWithLogo();
    const logoPath = companyProfile?.companyLogo?.filePath || '';
    const localLogoPath = logoPath ? path.join(__dirname, '..', logoPath.replace(/^\/+/, '')) : '';
    const hasLogo = localLogoPath && fs.existsSync(localLogoPath);
    const logoUrl = getPublicAssetUrl(trackingBaseUrl, logoPath);
    const companyWebsiteUrl = normalizeCompanyWebsite(companyProfile?.website) || 'https://www.synov.in';
    const companyLogoCid = 'company-logo@crm';
    console.log(`Company logo stored path: ${logoPath || '(none)'}`);
    console.log(`Company Profile logo field = ${JSON.stringify(companyProfile?.companyLogo || null)}`);
    console.log(`Company Profile logo path = ${logoPath || '(none)'}`);
    console.log(`Resolved logo URL = ${logoUrl || '(none)'}`);
    console.log(`Company logo CID: ${companyLogoCid}`);
    const logoHtml = hasLogo ? `<p style="margin: 0 0 20px; min-height: 1.5em;"><img src="cid:${companyLogoCid}" alt="" style="display: block; width: 120px; max-width: 120px; height: auto;" /></p>` : '';
    const logoBeforeText = ['Image Before Text', 'Image Above Text'].includes(campaign.imageAlignment);
    const imageBeforeText = logoBeforeText;
    const campaignImageUrl = getPublicAssetUrl(trackingBaseUrl, campaign.image);
    const localCampaignImagePath = campaign.image && !/^https?:\/\//i.test(campaign.image)
      ? path.join(__dirname, '..', campaign.image.replace(/^\/+/, ''))
      : '';
    const hasCampaignImage = !campaign.image || fs.existsSync(localCampaignImagePath);
    console.log(`Campaign image stored path: ${campaign.image || '(none)'}`);
    const campaignImageCid = `campaign-image-${campaign._id}@crm`;
    console.log(`Campaign image CID: ${campaignImageCid}`);
    if (logoPath && !hasLogo) throw new Error(`Company logo file does not exist: ${localLogoPath}`);
    if (!hasCampaignImage) throw new Error(`Campaign image file does not exist: ${localCampaignImagePath}`);
    const campaignImageHtml = campaign.image ? buildCampaignImageHtml(`cid:${campaignImageCid}`) : '';
    const rewrittenHtmlBody = rewriteEmailAssetUrls(removeCompanyLogoImages(htmlBody, logoUrl), trackingBaseUrl);
    const bodyWithCampaignImage = imageBeforeText
      ? `${campaignImageHtml}${rewrittenHtmlBody}`
      : `${rewrittenHtmlBody}${campaignImageHtml}`;
    const emailBody = logoBeforeText
      ? `${logoHtml}${bodyWithCampaignImage}`
      : `${bodyWithCampaignImage}${logoHtml}`;
    const inlineAttachments = [
      ...(hasLogo ? [{ filename: 'company-logo.png', path: localLogoPath, cid: companyLogoCid, contentType: companyProfile?.companyLogo?.mimeType || 'image/png' }] : []),
      ...(campaign.image && hasCampaignImage ? [{ filename: path.basename(localCampaignImagePath), path: localCampaignImagePath, cid: campaignImageCid, contentType: 'image/png' }] : []),
    ];

    const trackingIds = new Map(normalizedRecipients.map((recipient) => [recipient.toLowerCase(), crypto.randomBytes(24).toString('hex')]));
    const trackingUrlIsLocal = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?$/i.test(trackingBaseUrl);
    logger.info('mail-campaign.tracking-config', {
      campaignId: campaign.campaignId,
      trackingBaseUrl,
      trackingUrlIsLocal,
      warning: trackingUrlIsLocal ? 'External recipients cannot reach a local tracking URL.' : '',
    });
    const emailLogs = normalizedRecipients.map((recipient) => {
      const trackingId = trackingIds.get(recipient.toLowerCase());
      logger.info('mail-campaign.tracking-id.generated', {
        campaignId: campaign.campaignId,
        recipientEmail: recipient,
        trackingId,
      });
      console.log(`TRACKING ID GENERATED: trackingId=${trackingId} recipient=${recipient} campaignId=${campaign.campaignId}`);
      return {
        campaignId: campaign.campaignId,
        campaignName: campaign.campaignName,
        recipientEmail: recipient,
        status: 'Failed',
        sentAt: new Date(),
        errorMessage: '',
        senderEmail: process.env.EMAIL_USER || process.env.SMTP_USER || '',
        trackingId,
        trackingToken: trackingId,
      };
    });

    await EmailLog.insertMany(emailLogs);

    const report = await sendCampaignEmails({
      subject,
      html: (recipient) => {
        const trackingId = trackingIds.get(recipient.toLowerCase());
        const trackedHtml = addEmailTracking(buildCampaignEmailHtml({ htmlBody: emailBody, footer: rewriteEmailAssetUrls(normalizeFooterWebsiteLinks(removeCompanyLogoImages(campaign.footer, logoUrl), companyWebsiteUrl), trackingBaseUrl), logoHtml: '', showFooterSeparator: logoBeforeText }), campaign.campaignId, trackingId, trackingBaseUrl);
        const trackingUrl = buildTrackingPixelUrl(trackingBaseUrl, trackingId);
        const imageSources = [...trackedHtml.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]);
        const localUrls = [...trackedHtml.matchAll(/(?:https?:\/\/)?(?:localhost|127\.0\.0\.1)(?::\d+)?[^"'\s<]*/gi)].map((match) => match[0]);
        const validation = {
          hasTrackingPixel: trackedHtml.includes(trackingUrl),
          hasInlineImages: (!campaign.image || imageSources.includes(`cid:${campaignImageCid}`)) && (!hasLogo || imageSources.includes(`cid:${companyLogoCid}`)),
          hasTrackedLinks: /\/api\/mail-campaigns\/(?:tracking\/)?click\//i.test(trackedHtml),
          containsLocalhost: localUrls.length > 0,
          localUrls,
          trackingBaseUrl,
        };
        console.log(`Final email HTML image URLs: ${imageSources.join(', ') || '(none)'}`);
        console.log(`FINAL EMAIL VALIDATION recipient=${recipient} campaignId=${campaign.campaignId} hasTrackingPixel=${validation.hasTrackingPixel} hasInlineImages=${validation.hasInlineImages} hasTrackedLinks=${validation.hasTrackedLinks} containsLocalhost=${validation.containsLocalhost}${localUrls.length ? ` localUrls=${localUrls.join(',')}` : ''}`);
        if (!validation.hasTrackingPixel || !validation.hasInlineImages || validation.containsLocalhost) {
          throw new Error(`Final campaign HTML validation failed: ${JSON.stringify(validation)}`);
        }
        logger.info('mail-campaign.tracking-pixel-injected', {
          campaignId: campaign.campaignId,
          recipientEmail: recipient,
          trackingId,
          trackingPixelUrl: trackingUrl,
          trackingPixelIncluded: validation.hasTrackingPixel,
        });
        console.log(`TRACKING URL: ${trackingUrl}`);
        console.log(`TRACKING PIXEL IN FINAL HTML: ${validation.hasTrackingPixel}`);
        return trackedHtml;
      },
      tracking: (recipient) => {
        const trackingId = trackingIds.get(recipient.toLowerCase());
        return {
          campaignId: campaign.campaignId,
          trackingId,
          url: buildTrackingPixelUrl(trackingBaseUrl, trackingId),
        };
      },
      text: campaign.footer || subject || 'Campaign email',
      to: normalizedRecipients,
      attachments: inlineAttachments.concat((campaign.attachments || []).map((attachmentPath) => ({
        path: path.join(__dirname, '..', attachmentPath.replace(/^[\/]+/, '')),
      }))),
      fromName: process.env.MAIL_FROM_NAME || 'CRM Mail Campaign',
    });

    const sentCount = report.results.filter((item) => item.status === 'Sent').length;
    const failedCount = report.results.filter((item) => item.status === 'Failed').length;

    await Promise.all(report.results.map((item) => EmailLog.updateOne(
      { $or: [{ trackingId: trackingIds.get(item.recipientEmail.toLowerCase()) }, { trackingToken: trackingIds.get(item.recipientEmail.toLowerCase()) }] },
      {
        $set: {
          status: item.status,
          sentAt: new Date(),
          errorMessage: item.errorMessage || '',
          trackingId: trackingIds.get(item.recipientEmail.toLowerCase()),
          trackingToken: trackingIds.get(item.recipientEmail.toLowerCase()),
        },
      }
    )));

    if (groupId && targetGroup) {
      targetGroup.recipientEmails = normalizedRecipients;
      targetGroup.deliveryResults = report.results;
      targetGroup.sentDate = new Date().toISOString();
      targetGroup.status = failedCount === 0 ? 'Sent' : sentCount > 0 ? 'Partially Sent' : 'Failed';
    } else {
      if (failedCount === 0) {
        campaign.status = 'Sent';
      } else if (sentCount > 0) {
        campaign.status = 'Partially Sent';
      } else {
        campaign.status = 'Failed';
      }
      campaign.sentDate = new Date().toISOString();
      campaign.deliveryResults = report.results;
    }

    campaign.recipientCount = normalizedRecipients.length;
    campaign.opens = Number(campaign.opens || 0);
    campaign.clicks = Number(campaign.clicks || 0);
    await campaign.save();

    logger.info('mail-campaign.send', {
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      groupId: groupId || null,
      recipientCount: normalizedRecipients.length,
      successfullySent: report.successfullySent,
      failed: report.failed,
      status: groupId ? (targetGroup ? targetGroup.status : campaign.status) : campaign.status,
    });
    report.results.forEach((item) => {
      const trackingId = trackingIds.get(item.recipientEmail.toLowerCase());
      console.log(`SENT TRACKING: trackingId=${trackingId} recipient=${item.recipientEmail} status=${item.status}`);
    });

    if (failedCount === report.totalRecipients) {
      return res.status(502).json({
        success: false,
        message: 'Campaign was saved, but email delivery failed. Check the mail server configuration and delivery report.',
        data: {
          campaignId: campaign.campaignId,
          groupId: groupId || null,
          totalRecipients: report.totalRecipients,
          successfullySent: report.successfullySent,
          failed: report.failed,
          status: groupId ? (targetGroup ? targetGroup.status : campaign.status) : campaign.status,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: groupId ? 'Campaign group sent successfully.' : (campaign.status === 'Sent' ? 'Campaign Sent Successfully' : campaign.status === 'Partially Sent' ? 'Campaign Partially Sent' : 'Campaign Failed'),
      data: {
        campaignId: campaign.campaignId,
        groupId: groupId || null,
        totalRecipients: report.totalRecipients,
        successfullySent: report.successfullySent,
        failed: report.failed,
        results: report.results,
        status: groupId ? (targetGroup ? targetGroup.status : campaign.status) : campaign.status,
      },
    });
  } catch (error) {
    console.error('[mail-campaign] sendCampaign failed:', error);
    if (error?.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Campaign identifier is invalid.' });
    }
    logger.error('mail-campaign.send.failed', { message: error?.message, stack: error?.stack });
    res.status(500).json({ success: false, message: 'Unable to complete email delivery due to an unexpected server error.' });
  }
};

let scheduledCampaignCheckRunning = false;

exports.processScheduledCampaigns = async (baseUrl) => {
  if (scheduledCampaignCheckRunning) return;
  scheduledCampaignCheckRunning = true;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const candidates = await MailCampaign.find({
      status: 'Scheduled',
      scheduledDate: { $ne: '', $lte: today },
    }).select('_id scheduledDate scheduledTime').lean();

    for (const candidate of candidates) {
      const scheduledAt = new Date(`${candidate.scheduledDate}T${candidate.scheduledTime || '00:00'}:00`);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt > new Date()) continue;

      const claimed = await MailCampaign.findOneAndUpdate(
        { _id: candidate._id, status: 'Scheduled' },
        { $set: { status: 'Sending' } },
        { new: true },
      ).select('_id');
      if (!claimed) continue;

      try {
        const response = await fetch(`${baseUrl}/api/mail-campaigns/${candidate._id}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!response.ok && response.status >= 500) {
          const current = await MailCampaign.findById(candidate._id).select('status').lean();
          if (current?.status === 'Sending') {
            await MailCampaign.updateOne({ _id: candidate._id, status: 'Sending' }, { $set: { status: 'Scheduled' } });
          }
        }
      } catch (error) {
        logger.error('mail-campaign.scheduler.send.failed', { campaignId: candidate._id.toString(), message: error?.message, stack: error?.stack });
        await MailCampaign.updateOne({ _id: candidate._id, status: 'Sending' }, { $set: { status: 'Scheduled' } });
      }
    }
  } catch (error) {
    logger.error('mail-campaign.scheduler.failed', { message: error?.message, stack: error?.stack });
  } finally {
    scheduledCampaignCheckRunning = false;
  }
};
