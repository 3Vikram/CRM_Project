const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema(
  {
    supplierId: { type: String, trim: true },
    createdBy: {
      type: String,
      trim: true,
      default: 'Admin',
    },
    supplierName: {
      type: String,
      trim: true,
      required: [true, 'Supplier name is required'],
    },
    gstNumber: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      required: [true, 'Category is required'],
    },
    paymentTerms: {
      type: String,
      trim: true,
      required: [true, 'Payment terms are required'],
    },
    addressLine1: {
      type: String,
      trim: true,
      required: [true, 'Address line 1 is required'],
    },
    country: {
      type: String,
      trim: true,
      required: [true, 'Country is required'],
    },
    state: {
      type: String,
      trim: true,
      required: [true, 'State is required'],
    },
    city: {
      type: String,
      trim: true,
      default: '',
    },
    pinCode: {
      type: String,
      trim: true,
      default: '',
    },
    bankName: {
      type: String,
      trim: true,
      default: '',
    },
    bankAddress: {
      type: String,
      trim: true,
      default: '',
    },
    accountHolder: {
      type: String,
      trim: true,
      default: '',
    },
    accountNumber: {
      type: String,
      trim: true,
      default: '',
    },
    ifscCode: {
      type: String,
      trim: true,
      default: '',
    },
    loginEmailId: {
      type: String,
      trim: true,
      default: '',
    },
    loginPassword: {
      type: String,
      trim: true,
      default: '',
    },
    contactType: {
      type: String,
      trim: true,
      default: '',
    },
    contactName: {
      type: String,
      trim: true,
      default: '',
    },
    designation: {
      type: String,
      trim: true,
      default: '',
    },
    emailId: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    contactNumber: {
      type: String,
      trim: true,
      default: '',
    },
    product: {
      type: String,
      trim: true,
      default: '',
    },
    calendarStatus: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  },
  { timestamps: true }
);

SupplierSchema.index({
  supplierName: 'text',
  contactName: 'text',
  emailId: 'text',
  contactNumber: 'text',
  product: 'text',
});
SupplierSchema.index({ createdBy: 1, product: 1, createdAt: -1 });
SupplierSchema.index({ supplierName: 1, emailId: 1, contactNumber: 1 });
SupplierSchema.index({ supplierName: 1, contactName: 1, emailId: 1, contactNumber: 1, product: 1, createdAt: -1 });
SupplierSchema.index({ contactName: 1, emailId: 1, contactNumber: 1, product: 1, createdAt: -1 });
SupplierSchema.index({ supplierId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Supplier', SupplierSchema);
