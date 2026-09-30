const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const CompanyProfile = require('../models/CompanyProfile');
const { DEFAULT_PAGE_SIZE, parsePagination, normalizeSort, regexFromSearch, escapeRegex } = require('../utils/queryUtils');
const { sendQuotationEmail } = require('../services/emailService');

const PRIORITY_BY_SCORE = (score) => {
  if (score > 80) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
};

const pendingLeadState = new Map();

const buildTimeline = (title, description, type = 'info') => ({
  title,
  description,
  type,
  createdAt: new Date(),
});

const createLeadId = async () => {
  const existingLeadIds = await Lead.find({ leadId: /^LD-\d+$/ }, { leadId: 1 }).lean();
  const highestExistingId = existingLeadIds.reduce((highest, lead) => {
    const numericPart = String(lead.leadId).slice(3);
    const sequence = Number(numericPart);
    return Number.isSafeInteger(sequence) ? Math.max(highest, sequence) : highest;
  }, 0);
  return `LD-${highestExistingId + 1}`;
};

// Calculate Indian financial year (April 1 - March 31)
const calculateFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // getMonth() returns 0-11

  if (month >= 4) {
    // April onwards: current year to next year
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    // January to March: previous year to current year
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
};

// Generate quotation ID based on Company Profile format and financial year
const createQuotationId = async () => {
  try {
    // Fetch the first company profile to get quotation format
    const companyProfile = await CompanyProfile.findOne({}).lean();
    if (!companyProfile || !companyProfile.quotationFormat) {
      throw new Error('Company Profile or Quotation Format not configured');
    }

    const quotationFormat = companyProfile.quotationFormat.trim();
    const financialYear = calculateFinancialYear();

    // Build the prefix pattern to search for quotations
    // e.g., if format is "SIS/Q/" and year is "2026-27", we're looking for "SIS/Q/2026-27/"
    const prefixPattern = `${quotationFormat}${financialYear}/`;

    // Find all quotations that start with this prefix
    const latestQuotation = await Lead.findOne(
      { quotationId: new RegExp(`^${prefixPattern.replace(/\//g, '\\/')}`) },
      { quotationId: 1 }
    )
      .sort({ createdDate: -1 })
      .lean();

    let sequenceNumber = 1;

    if (latestQuotation && latestQuotation.quotationId) {
      // Extract the last number from the quotation ID
      const match = latestQuotation.quotationId.match(/(\d{3})$/);
      if (match) {
        sequenceNumber = parseInt(match[1], 10) + 1;
      }
    }

    const newQuotationId = `${prefixPattern}${String(sequenceNumber).padStart(3, '0')}`;
    return newQuotationId;
  } catch (error) {
    // Fallback in case of error
    console.error('Error generating quotation ID:', error.message);
    throw error;
  }
};

const normalizeLeadPayload = (body = {}) => {
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

const buildLeadScore = (lead) => {
  let score = 0;
  const openCount = Number(lead.emailOpenCount || lead.openCount || 0);
  const clicks = Number(lead.linkClicks || lead.engagement?.linkClicks || 0);
  const downloads = Number(lead.downloads || lead.engagement?.brochureDownloads || 0);
  const replies = Number(lead.replies || lead.engagement?.replies || 0);
  const visits = Number(lead.websiteVisits || lead.engagement?.websiteVisits || 0);

  if (openCount >= 3) score += 20;
  if (clicks > 0) score += 30;
  if (downloads > 0) score += 20;
  if (replies > 0) score += 20;
  if (visits > 0) score += 10;
  return Math.min(score, 100);
};

const setLeadMetadata = (lead) => {
  const score = buildLeadScore(lead);
  lead.leadScore = score;
  lead.priority = PRIORITY_BY_SCORE(score);
  lead.sourceOfLead = lead.sourceOfLead || lead.source || 'Manual';
  lead.source = lead.source || lead.sourceOfLead || 'Manual';
  if (!lead.leadStatus) lead.leadStatus = 'New';
  return lead;
};

exports.getLeads = async (req, res) => {
  try {
    const {
      page = 1,
      limit = DEFAULT_PAGE_SIZE,
      search = '',
      status = '',
      priority = '',
      source = '',
      assignedTo = '',
      campaign = '',
      quotationType = '',
      sortBy = 'createdDate',
      sortOrder = 'desc',
    } = req.query;

    const query = {};
    const searchValue = regexFromSearch(search);
    if (searchValue) {
      query.$or = [
        { companyName: searchValue },
        { contactPerson: searchValue },
        { email: searchValue },
        { mobile: searchValue },
        { campaignName: searchValue },
      ];
    }
    if (status) query.leadStatus = status;
    if (priority) query.priority = priority;
    if (source) query.$or = [{ source: source }, { sourceOfLead: source }];
    if (assignedTo) query.assignedTo = assignedTo;
    if (campaign) query.campaignName = new RegExp(`^${escapeRegex(campaign)}$`, 'i');
    if (quotationType && ['rent', 'sold'].includes(String(quotationType).toLowerCase())) {
      query.quotationType = String(quotationType).toLowerCase();
    }

    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit });
    const projection = {
      _id: 1,
      leadId: 1,
      quotationId: 1,
      companyName: 1,
      contactPerson: 1,
      designation: 1,
      email: 1,
      mobile: 1,
      source: 1,
      sourceOfLead: 1,
      campaignId: 1,
      campaignName: 1,
      leadScore: 1,
      priority: 1,
      leadStatus: 1,
      assignedTo: 1,
      createdBy: 1,
      createdDate: 1,
      followUpDate: 1,
      followUpTime: 1,
      isConverted: 1,
      isScrapped: 1,
      reason: 1,
      timeline: 1,
      notes: 1,
      quotationType: 1,
      products: 1,
      quotationDetails: 1,
    };
    const sortOptions = normalizeSort(sortBy, sortOrder, ['createdDate', 'companyName', 'leadStatus', 'priority', 'assignedTo', 'leadScore']);

    const [leads, total] = await Promise.all([
      Lead.find(query, projection).sort(sortOptions).skip(skip).limit(limitNum).lean(),
      Lead.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: leads,
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

exports.getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).select({ __v: 0 }).lean();
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.status(200).json({ success: true, data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createLead = async (req, res) => {
  try {
    const payload = normalizeLeadPayload(req.body);
    const leadPayload = setLeadMetadata({ ...payload, createdBy: payload.createdBy || 'System' });
    let lead;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const candidate = { ...leadPayload, leadId: await createLeadId() };
        if (payload.leadStatus === 'Proposal Sent' && !candidate.quotationId) {
          candidate.quotationId = await createQuotationId();
        }
        candidate.timeline = [buildTimeline('Lead created', `${candidate.companyName} entered the pipeline`, 'info')];
        lead = await Lead.create(candidate);
        break;
      } catch (error) {
        if (error?.code !== 11000 || attempt === 4) throw error;
      }
    }
    res.status(201).json({ success: true, message: 'Lead created successfully', data: lead });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const payload = normalizeLeadPayload(req.body);
    const existing = await Lead.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Lead not found' });
    const updated = setLeadMetadata({ ...existing.toObject(), ...payload });
    updated.timeline = existing.timeline || [];
    if (payload.leadStatus && payload.leadStatus !== existing.leadStatus) {
      updated.timeline.unshift(buildTimeline('Status updated', `Moved to ${payload.leadStatus}`, 'info'));
    }
    
    // Generate quotation ID if status changed to Proposal Sent
    if (payload.leadStatus === 'Proposal Sent' && !existing.quotationId && !updated.quotationId) {
      updated.quotationId = await createQuotationId();
    }
    
    const lead = await Lead.findByIdAndUpdate(req.params.id, updated, { new: true, runValidators: true });
    res.status(200).json({ success: true, message: 'Lead updated successfully', data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteLead = async (req, res) => {
  try {
    const identifier = String(req.params.id || '').trim();
    const query = mongoose.isValidObjectId(identifier)
      ? { $or: [{ _id: identifier }, { leadId: identifier }] }
      : { leadId: identifier };
    console.log('DELETE LEAD REQUEST:', { identifier, query });
    const lead = await Lead.findOneAndDelete(query);
    if (!lead) {
      console.error('DELETE LEAD NOT FOUND:', { identifier });
      return res.status(404).json({ success: false, message: `Lead not found for identifier: ${identifier}` });
    }
    console.log('DELETE LEAD SUCCESS:', { identifier, mongoId: lead._id.toString(), leadId: lead.leadId });
    res.status(200).json({ success: true, message: 'Lead deleted successfully', data: { _id: lead._id, leadId: lead.leadId } });
  } catch (error) {
    console.error('DELETE LEAD ERROR:', { identifier: req.params.id, message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.handleMailOpenEvent = async (req, res) => {
  try {
    const { email, campaignId, campaignName, companyName, contactPerson, designation, mobile, sourceOfLead = 'Mail Campaign', eventType = 'open' } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    let lead = await Lead.findOne({ email });
    const now = new Date();

    if (!lead) {
      const pending = pendingLeadState.get(email) || {
        email,
        companyName: companyName || 'New Company',
        contactPerson: contactPerson || 'New Contact',
        designation: designation || '',
        mobile: mobile || '',
        sourceOfLead,
        campaignId: campaignId || '',
        campaignName: campaignName || '',
        openCount: 0,
        emailOpenCount: 0,
        linkClicks: 0,
        downloads: 0,
        replies: 0,
        websiteVisits: 0,
        leadStatus: 'New',
        assignedTo: 'Unassigned',
        createdBy: 'System',
        createdDate: now,
        lastOpenTime: now,
        timeline: [],
      };

      if (eventType === 'open') {
        pending.openCount = (pending.openCount || 0) + 1;
        pending.emailOpenCount = (pending.emailOpenCount || 0) + 1;
      } else if (eventType === 'click') {
        pending.linkClicks = (pending.linkClicks || 0) + 1;
      } else if (eventType === 'download') {
        pending.downloads = (pending.downloads || 0) + 1;
      } else if (eventType === 'reply') {
        pending.replies = (pending.replies || 0) + 1;
      } else if (eventType === 'visit') {
        pending.websiteVisits = (pending.websiteVisits || 0) + 1;
      }

      pending.lastOpenTime = now;
      pending.timeline = pending.timeline || [];
      pending.timeline.unshift(buildTimeline('Engagement tracked', `Received ${eventType} event`, 'info'));
      pendingLeadState.set(email, pending);

      if ((pending.openCount || 0) >= 3) {
        const createdLead = await Lead.create({
          leadId: await createLeadId(),
          ...pending,
          leadScore: buildLeadScore(pending),
          priority: PRIORITY_BY_SCORE(buildLeadScore(pending)),
          timeline: [buildTimeline('Lead created', 'Lead auto-created after repeated email opens', 'success')],
        });
        pendingLeadState.delete(email);
        return res.status(200).json({ success: true, message: 'Lead created from mail engagement', data: createdLead });
      }

      return res.status(200).json({ success: true, message: 'Engagement recorded', data: pending });
    }

    if (eventType === 'open') {
      lead.openCount = (lead.openCount || 0) + 1;
      lead.emailOpenCount = (lead.emailOpenCount || 0) + 1;
    } else if (eventType === 'click') {
      lead.linkClicks = (lead.linkClicks || 0) + 1;
    } else if (eventType === 'download') {
      lead.downloads = (lead.downloads || 0) + 1;
    } else if (eventType === 'reply') {
      lead.replies = (lead.replies || 0) + 1;
    } else if (eventType === 'visit') {
      lead.websiteVisits = (lead.websiteVisits || 0) + 1;
    }

    lead.lastOpenTime = now;
    lead.sourceOfLead = lead.sourceOfLead || sourceOfLead;
    lead.campaignId = lead.campaignId || campaignId || '';
    lead.campaignName = lead.campaignName || campaignName || '';
    lead.timeline = lead.timeline || [];
    lead.timeline.unshift(buildTimeline('Engagement tracked', `Received ${eventType} event`, 'info'));
    const nextScore = buildLeadScore(lead);
    lead.leadScore = nextScore;
    lead.priority = PRIORITY_BY_SCORE(nextScore);
    await Lead.findByIdAndUpdate(lead._id, lead, { new: true });

    res.status(200).json({ success: true, message: 'Engagement updated', data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.moveToActivity = async (req, res) => {
  try {
    const lead = await Lead.findById(req.body.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    lead.leadStatus = 'Follow-up';
    lead.timeline.unshift(buildTimeline('Moved to activity', 'Lead was moved to activity tracking', 'info'));
    await lead.save();
    res.status(200).json({ success: true, message: 'Lead moved to activity', data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.moveToFunnel = async (req, res) => {
  try {
    const lead = await Lead.findById(req.body.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    lead.leadStatus = 'Qualified';
    lead.timeline.unshift(buildTimeline('Moved to funnel', 'Lead was moved to the sales funnel', 'info'));
    await lead.save();
    res.status(200).json({ success: true, message: 'Lead moved to funnel', data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.generateQuotation = async (req, res) => {
  try {
    const lead = await Lead.findById(req.body.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    lead.leadStatus = 'Proposal Sent';
    lead.timeline.unshift(buildTimeline('Quotation generated', 'Quotation was generated for this lead', 'info'));
    await lead.save();
    res.status(200).json({ success: true, message: 'Quotation generated', data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.convertToCustomer = async (req, res) => {
  try {
    const lead = await Lead.findById(req.body.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    // Lazy-load Customer model to avoid circular requires at module load time
    const Customer = require('../models/Customer');

    // Reuse existing customer if email matches to avoid duplicates
    let customer = await Customer.findOne({ email: lead.email });
    if (!customer) {
      const contact = {
        contactType: 'Primary',
        name: lead.contactPerson || lead.companyName || 'Primary Contact',
        email: lead.email,
        phone: lead.mobile || '',
        designation: lead.designation || '',
      };

      const customerPayload = {
        companyName: lead.companyName || lead.contactPerson || 'Unnamed Company',
        contacts: [contact],
        customerName: contact.name,
        email: contact.email,
        phone: contact.phone,
        createdBy: lead.createdBy || 'System',
        notes: `Converted from Lead ${lead.leadId || lead._id}`,
      };

      customer = await Customer.create(customerPayload);
    }

    // Mark lead converted and link to customer reference if desired
    lead.isConverted = true;
    lead.leadStatus = 'Won';
    lead.timeline.unshift(buildTimeline('Converted to customer', `Converted to customer ${customer._id}`, 'success'));
    await lead.save();

    res.status(200).json({ success: true, message: 'Lead converted to customer', data: { lead, customer } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.scrapLead = async (req, res) => {
  try {
    const { id, reason } = req.body;
    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    lead.isScrapped = true;
    lead.reason = reason || 'No reason provided';
    lead.leadStatus = 'Scrapped';
    lead.timeline.unshift(buildTimeline('Lead scrapped', reason || 'Lead was marked scrapped', 'warning'));
    await lead.save();
    res.status(200).json({ success: true, message: 'Lead scrapped', data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendQuotationPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const { pdfData, recipientEmail } = req.body;

    // Validate inputs
    if (!id) {
      return res.status(400).json({ success: false, message: 'Quotation ID is required' });
    }

    if (!pdfData) {
      return res.status(400).json({ success: false, message: 'PDF data is required' });
    }

    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
      return res.status(400).json({ success: false, message: 'Valid recipient email is required' });
    }

    // Fetch quotation
    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    // Convert base64 PDF data to buffer
    let pdfBuffer;
    try {
      // Handle different PDF data formats
      if (typeof pdfData === 'string') {
        // If it's base64, decode it
        if (pdfData.startsWith('data:application/pdf;base64,')) {
          pdfBuffer = Buffer.from(pdfData.split(',')[1], 'base64');
        } else if (pdfData.startsWith('base64,')) {
          pdfBuffer = Buffer.from(pdfData.split(',')[1], 'base64');
        } else {
          pdfBuffer = Buffer.from(pdfData, 'base64');
        }
      } else {
        return res.status(400).json({ success: false, message: 'Invalid PDF data format' });
      }
    } catch (error) {
      return res.status(400).json({ success: false, message: 'Failed to process PDF data', error: error.message });
    }

    // Generate PDF filename with quotation reference
    const quotationRef = lead.quotationId || lead.leadId || lead._id;
    const pdfFileName = `quotation-${quotationRef}.pdf`;

    // Send email with PDF
    const emailResult = await sendQuotationEmail({
      recipient: recipientEmail.trim(),
      subject: `Quotation ${quotationRef}`,
      quotationNumber: quotationRef,
      pdfBuffer,
      pdfFileName,
    });

    if (emailResult.success) {
      res.status(200).json({
        success: true,
        message: emailResult.message,
        data: {
          quotationId: id,
          recipient: recipientEmail,
          fileName: pdfFileName,
          messageId: emailResult.messageId,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        message: emailResult.message,
        error: emailResult.errorMessage,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send quotation PDF',
      error: error.message,
    });
  }
};
