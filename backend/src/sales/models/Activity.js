const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    activityId: { type: String, trim: true, default: '' },
    leadId: { type: String, trim: true, default: '' },
    leadSource: { type: String, trim: true, default: '' },
    customerName: { type: String, trim: true, default: '' },
    contactPerson: { type: String, trim: true, default: '' },
    designation: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    mobileNo: { type: String, trim: true, default: '' },
    sourceOfLead: { type: String, trim: true, default: '' },
    customerRequirements: { type: String, trim: true, default: '' },
    customerRemarks: { type: String, trim: true, default: '' },
    assignedUser: { type: String, trim: true, default: '' },
    leadIdLabel: { type: String, trim: true, default: '' },
    company: { type: String, trim: true, default: '' },
    priority: { type: String, trim: true, default: 'Medium' },
    campaign: { type: String, trim: true, default: '' },
    activityType: { type: String, trim: true, default: '' },
    activityDate: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' },
    response: { type: String, trim: true, default: '' },
    followUp: { type: String, trim: true, default: '' },
    product: { type: String, trim: true, default: '' },
    tagResource: { type: String, trim: true, default: '' },
    followUpDate: { type: String, trim: true, default: '' },
    reminder: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['Open', 'Pending', 'Completed', 'Overdue'], default: 'Open' },
    createdBy: { type: String, trim: true, default: 'Current User' },
    lastModifiedBy: { type: String, trim: true, default: 'Current User' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

activitySchema.index(
  { activityId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
activitySchema.index({ leadId: 1, status: 1, activityDate: 1 });
activitySchema.index({ customerName: 1, contactPerson: 1, email: 1, mobileNo: 1, activityDate: 1 });
activitySchema.index({ createdBy: 1, activityDate: 1, response: 1, followUpDate: 1, status: 1 });
activitySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
