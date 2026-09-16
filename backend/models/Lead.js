const mongoose = require('mongoose');

const TimelineEntrySchema = new mongoose.Schema(
  {
    type: { type: String, trim: true, default: 'info' },
    title: { type: String, trim: true, required: true },
    description: { type: String, trim: true, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const NoteSchema = new mongoose.Schema(
  {
    message: { type: String, trim: true, required: true },
    createdBy: { type: String, trim: true, default: 'System' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const EngagementSchema = new mongoose.Schema(
  {
    emailOpens: { type: Number, default: 0 },
    linkClicks: { type: Number, default: 0 },
    brochureDownloads: { type: Number, default: 0 },
    replies: { type: Number, default: 0 },
    websiteVisits: { type: Number, default: 0 },
  },
  { _id: false }
);

const LeadSchema = new mongoose.Schema(
  {
    leadId: { type: String, trim: true, unique: true, sparse: true },
    companyName: { type: String, trim: true, required: [true, 'Company name is required'] },
    contactPerson: { type: String, trim: true, default: 'Not provided' },
    designation: { type: String, trim: true, default: '' },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'noemail@noemail.com',
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    mobile: { type: String, trim: true, default: '0000000000' },
    source: { type: String, trim: true, default: 'Manual' },
    sourceOfLead: { type: String, trim: true, default: 'Manual' },
    campaignId: { type: String, trim: true, default: '' },
    campaignName: { type: String, trim: true, default: '' },
    openCount: { type: Number, default: 0 },
    emailOpenCount: { type: Number, default: 0 },
    linkClicks: { type: Number, default: 0 },
    firstOpenedAt: { type: Date, default: null },
    lastOpenedAt: { type: Date, default: null },
    firstClickedAt: { type: Date, default: null },
    lastClickedAt: { type: Date, default: null },
    downloads: { type: Number, default: 0 },
    replies: { type: Number, default: 0 },
    websiteVisits: { type: Number, default: 0 },
    engagement: { type: EngagementSchema, default: () => ({}) },
    leadScore: { type: Number, default: 0 },
    priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Low' },
    leadStatus: {
      type: String,
      enum: ['New', 'Contacted', 'Follow-up', 'Interested', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Scrapped'],
      default: 'New',
    },
    calendarStatus: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
    assignedTo: { type: String, trim: true, default: 'Unassigned' },
    createdBy: { type: String, trim: true, default: 'System' },
    createdDate: { type: Date, default: Date.now },
    followUpDate: { type: String, trim: true, default: '' },
    followUpTime: { type: String, trim: true, default: '' },
    customerRequirements: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    lastOpenTime: { type: Date, default: null },
    timeline: { type: [TimelineEntrySchema], default: [] },
    notes: { type: [NoteSchema], default: [] },
    isConverted: { type: Boolean, default: false },
    isScrapped: { type: Boolean, default: false },
    reason: { type: String, trim: true, default: '' },
    // Quotation fields
    quotationId: { type: String, trim: true, unique: true, sparse: true },
    products: { type: Array, default: [] },
    quotationDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
      customerId: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

LeadSchema.index({ companyName: 'text', contactPerson: 'text', email: 'text' });
LeadSchema.index({ leadStatus: 1, priority: 1, assignedTo: 1, createdDate: -1 });
LeadSchema.index({ companyName: 1, email: 1, mobile: 1, assignedTo: 1, createdDate: -1 });
LeadSchema.index({ companyName: 1, status: 1, createdDate: -1 });
LeadSchema.index({ assignedTo: 1, leadStatus: 1, createdDate: -1 });

module.exports = mongoose.model('Lead', LeadSchema);
