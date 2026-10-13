const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const CompanyProfile = require('../models/CompanyProfile');
const { DEFAULT_PAGE_SIZE } = require('../utils/queryUtils');
const { sendQuotationEmail } = require('../services/emailService');
const { db } = require('../utils/salesDatabase');

const PRIORITY_BY_SCORE = (score) => {
  if (score > 80) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
};

const pendingLeadState = new Map();

const convertLeadToCustomer = db.transaction((lead) => {
  let customer = Customer.findByEmail(lead.email);
  if (!customer) {
    const contact = {
      contactType: 'Primary',
      name: lead.contactPerson || lead.companyName || 'Primary Contact',
      email: lead.email,
      phone: lead.mobile || '',
      designation: lead.designation || '',
    };
    customer = Customer.create({
      companyName: lead.companyName || lead.contactPerson || 'Unnamed Company',
      contacts: [contact],
      customerName: contact.name,
      email: contact.email,
      phone: contact.phone,
      createdBy: lead.createdBy || 'System',
      notes: `Converted from Lead ${lead.leadId || lead._id}`,
    });
  }
  const updatedLead = Lead.updateById(lead._id, {
    isConverted: true,
    leadStatus: 'Won',
    customerId: customer._id,
    timeline: [buildTimeline('Converted to customer', `Converted to customer ${customer._id}`, 'success'), ...(lead.timeline || [])],
  });
  if (!updatedLead) throw new Error('Lead not found');
  return { customer, updatedLead };
});

const buildTimeline = (title, description, type = 'info') => ({
  title,
  description,
  type,
  createdAt: new Date(),
});

const calculateFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 4
    ? `${year}-${(year + 1).toString().slice(-2)}`
    : `${year - 1}-${year.toString().slice(-2)}`;
};

const createQuotationId = async () => {
  try {
    const companyProfile = CompanyProfile.findFirst();
    if (!companyProfile || !companyProfile.quotationFormat) {
      throw new Error('Company Profile or Quotation Format not configured');
    }
    const prefix = `${companyProfile.quotationFormat.trim()}${calculateFinancialYear()}/`;
    return Lead.nextQuotationId(prefix);
  } catch (error) {
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

const respondToValidationError = (res, error) => {
  const messages = Object.values(error.errors || {}).map((item) => item.message);
  return res.status(400).json({
    success: false,
    message: messages.join(', ') || error.message,
  });
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

    const onlyQuotations = req.leadResourceFilter?.quotationId?.$exists;
    const result = Lead.list({
      page,
      limit,
      search,
      status,
      priority,
      source,
      assignedTo,
      campaign,
      quotationType,
      sortBy,
      sortOrder,
      onlyQuotations,
    });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLeadById = async (req, res) => {
  try {
    const lead = Lead.findById(req.params.id);
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
    if (leadPayload.leadStatus === 'Proposal Sent' && !leadPayload.quotationId) {
      leadPayload.quotationId = await createQuotationId();
    }
    leadPayload.timeline = [buildTimeline('Lead created', `${leadPayload.companyName} entered the pipeline`, 'info')];
    const lead = Lead.create(leadPayload);
    res.status(201).json({ success: true, message: 'Lead created successfully', data: lead });
  } catch (error) {
    if (Lead.isValidationError(error)) return respondToValidationError(res, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const payload = normalizeLeadPayload(req.body);
    const existing = Lead.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Lead not found' });
    const updated = setLeadMetadata({ ...existing, ...payload });
    updated.timeline = existing.timeline || [];
    if (payload.leadStatus && payload.leadStatus !== existing.leadStatus) {
      updated.timeline.unshift(buildTimeline('Status updated', `Moved to ${payload.leadStatus}`, 'info'));
    }
    if (payload.leadStatus === 'Proposal Sent' && !existing.quotationId && !updated.quotationId) {
      updated.quotationId = await createQuotationId();
    }
    const lead = Lead.updateById(req.params.id, updated);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.status(200).json({ success: true, message: 'Lead updated successfully', data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteLead = async (req, res) => {
  const identifier = String(req.params.id || '').trim();
  try {
    const lead = Lead.deleteByIdentifier(identifier);
    if (!lead) {
      console.error('DELETE LEAD NOT FOUND:', { identifier });
      return res.status(404).json({ success: false, message: `Lead not found for identifier: ${identifier}` });
    }
    res.status(200).json({
      success: true,
      message: 'Lead deleted successfully',
      data: { _id: lead._id, leadId: lead.leadId },
    });
  } catch (error) {
    console.error('DELETE LEAD ERROR:', { identifier, message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.handleMailOpenEvent = async (req, res) => {
  try {
    const {
      email,
      campaignId,
      campaignName,
      companyName,
      contactPerson,
      designation,
      mobile,
      sourceOfLead = 'Mail Campaign',
      eventType = 'open',
    } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const emailKey = String(email).trim().toLowerCase();
    let lead = Lead.findByEmail(emailKey);
    const now = new Date();

    if (!lead) {
      const pending = pendingLeadState.get(emailKey) || {
        email: emailKey,
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
        engagement: { emailOpens: 0, linkClicks: 0, brochureDownloads: 0, replies: 0, websiteVisits: 0 },
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
        pending.engagement.emailOpens = (pending.engagement.emailOpens || 0) + 1;
      } else if (eventType === 'click') {
        pending.linkClicks = (pending.linkClicks || 0) + 1;
        pending.engagement.linkClicks = (pending.engagement.linkClicks || 0) + 1;
      } else if (eventType === 'download') {
        pending.downloads = (pending.downloads || 0) + 1;
        pending.engagement.brochureDownloads = (pending.engagement.brochureDownloads || 0) + 1;
      } else if (eventType === 'reply') {
        pending.replies = (pending.replies || 0) + 1;
        pending.engagement.replies = (pending.engagement.replies || 0) + 1;
      } else if (eventType === 'visit') {
        pending.websiteVisits = (pending.websiteVisits || 0) + 1;
        pending.engagement.websiteVisits = (pending.engagement.websiteVisits || 0) + 1;
      }

      pending.lastOpenTime = now;
      pending.timeline = pending.timeline || [];
      pending.timeline.unshift(buildTimeline('Engagement tracked', `Received ${eventType} event`, 'info'));
      pendingLeadState.set(emailKey, pending);

      if ((pending.openCount || 0) >= 3) {
        const createdLead = Lead.create({
          ...pending,
          leadScore: buildLeadScore(pending),
          priority: PRIORITY_BY_SCORE(buildLeadScore(pending)),
          timeline: [buildTimeline('Lead created', 'Lead auto-created after repeated email opens', 'success')],
        });
        pendingLeadState.delete(emailKey);
        return res.status(200).json({ success: true, message: 'Lead created from mail engagement', data: createdLead });
      }
      return res.status(200).json({ success: true, message: 'Engagement recorded', data: pending });
    }

    if (eventType === 'open') {
      lead.openCount = (lead.openCount || 0) + 1;
      lead.emailOpenCount = (lead.emailOpenCount || 0) + 1;
      lead.engagement.emailOpens = (lead.engagement.emailOpens || 0) + 1;
    } else if (eventType === 'click') {
      lead.linkClicks = (lead.linkClicks || 0) + 1;
      lead.engagement.linkClicks = (lead.engagement.linkClicks || 0) + 1;
    } else if (eventType === 'download') {
      lead.downloads = (lead.downloads || 0) + 1;
      lead.engagement.brochureDownloads = (lead.engagement.brochureDownloads || 0) + 1;
    } else if (eventType === 'reply') {
      lead.replies = (lead.replies || 0) + 1;
      lead.engagement.replies = (lead.engagement.replies || 0) + 1;
    } else if (eventType === 'visit') {
      lead.websiteVisits = (lead.websiteVisits || 0) + 1;
      lead.engagement.websiteVisits = (lead.engagement.websiteVisits || 0) + 1;
    }
    lead.lastOpenTime = now;
    lead.sourceOfLead = lead.sourceOfLead || sourceOfLead;
    lead.campaignId = lead.campaignId || campaignId || '';
    lead.campaignName = lead.campaignName || campaignName || '';
    lead.timeline = lead.timeline || [];
    lead.timeline.unshift(buildTimeline('Engagement tracked', `Received ${eventType} event`, 'info'));
    lead.leadScore = buildLeadScore(lead);
    lead.priority = PRIORITY_BY_SCORE(lead.leadScore);
    lead = Lead.updateById(lead._id, lead);

    res.status(200).json({ success: true, message: 'Engagement updated', data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateLeadStatus = (lead, status, title, description) => Lead.updateById(lead._id, {
  leadStatus: status,
  timeline: [buildTimeline(title, description, 'info'), ...(lead.timeline || [])],
});

exports.moveToActivity = async (req, res) => {
  try {
    const lead = Lead.findById(req.body.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    const updated = updateLeadStatus(lead, 'Follow-up', 'Moved to activity', 'Lead was moved to activity tracking');
    res.status(200).json({ success: true, message: 'Lead moved to activity', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.moveToFunnel = async (req, res) => {
  try {
    const lead = Lead.findById(req.body.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    const updated = updateLeadStatus(lead, 'Qualified', 'Moved to funnel', 'Lead was moved to the sales funnel');
    res.status(200).json({ success: true, message: 'Lead moved to funnel', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.generateQuotation = async (req, res) => {
  try {
    const lead = Lead.findById(req.body.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    const updated = Lead.updateById(lead._id, {
      leadStatus: 'Proposal Sent',
      timeline: [buildTimeline('Quotation generated', 'Quotation was generated for this lead', 'info'), ...(lead.timeline || [])],
    });
    res.status(200).json({ success: true, message: 'Quotation generated', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.convertToCustomer = async (req, res) => {
  try {
    const lead = Lead.findById(req.body.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    const { customer, updatedLead } = convertLeadToCustomer.immediate(lead);
    res.status(200).json({ success: true, message: 'Lead converted to customer', data: { lead: updatedLead, customer } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.scrapLead = async (req, res) => {
  try {
    const { id, reason } = req.body;
    const lead = Lead.findById(id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    const updated = Lead.updateById(lead._id, {
      isScrapped: true,
      reason: reason || 'No reason provided',
      leadStatus: 'Scrapped',
      timeline: [buildTimeline('Lead scrapped', reason || 'Lead was marked scrapped', 'warning'), ...(lead.timeline || [])],
    });
    res.status(200).json({ success: true, message: 'Lead scrapped', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendQuotationPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const { pdfData, recipientEmail } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'Quotation ID is required' });
    if (!pdfData) return res.status(400).json({ success: false, message: 'PDF data is required' });
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
      return res.status(400).json({ success: false, message: 'Valid recipient email is required' });
    }

    const lead = Lead.findById(id);
    if (!lead) return res.status(404).json({ success: false, message: 'Quotation not found' });

    let pdfBuffer;
    try {
      if (typeof pdfData !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid PDF data format' });
      }
      if (pdfData.startsWith('data:application/pdf;base64,')) {
        pdfBuffer = Buffer.from(pdfData.split(',')[1], 'base64');
      } else if (pdfData.startsWith('base64,')) {
        pdfBuffer = Buffer.from(pdfData.split(',')[1], 'base64');
      } else {
        pdfBuffer = Buffer.from(pdfData, 'base64');
      }
    } catch (error) {
      return res.status(400).json({ success: false, message: 'Failed to process PDF data', error: error.message });
    }

    const quotationRef = lead.quotationId || lead.leadId || lead._id;
    const pdfFileName = `quotation-${quotationRef}.pdf`;
    const emailResult = await sendQuotationEmail({
      recipient: recipientEmail.trim(),
      subject: `Quotation ${quotationRef}`,
      quotationNumber: quotationRef,
      pdfBuffer,
      pdfFileName,
    });

    if (emailResult.success) {
      return res.status(200).json({
        success: true,
        message: emailResult.message,
        data: {
          quotationId: id,
          recipient: recipientEmail,
          fileName: pdfFileName,
          messageId: emailResult.messageId,
        },
      });
    }
    return res.status(500).json({
      success: false,
      message: emailResult.message,
      error: emailResult.errorMessage,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to send quotation PDF',
      error: error.message,
    });
  }
};
