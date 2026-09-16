const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema(
  {
    addressLine1: { type: String, trim: true, default: '' },
    area: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const ContactSchema = new mongoose.Schema(
  {
    contactType: { type: String, trim: true, default: '' },
    name: { type: String, trim: true, required: [true, 'Contact name is required'] },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: [true, 'Contact email is required'],
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    phone: { type: String, trim: true, required: [true, 'Contact number is required'] },
    designation: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const CustomerSchema = new mongoose.Schema(
  {
    customerId: { type: String, trim: true },
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    gstNumber: { type: String, trim: true, uppercase: true, default: '' },
    panNumber: { type: String, trim: true, uppercase: true, default: '' },
    website: { type: String, trim: true, default: '' },
    industry: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    billToAddress: { type: AddressSchema, default: () => ({}) },
    shipToSameAsBilling: { type: Boolean, default: true },
    shipToAddress: { type: AddressSchema, default: () => ({}) },
    contacts: {
      type: [ContactSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'At least one contact is required',
      },
    },
    customerName: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    documents: [
      {
        fileName: { type: String, trim: true },
        filePath: { type: String, trim: true },
        uploadDate: { type: Date, default: Date.now },
        customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
        documentType: { type: String, trim: true, default: '' },
        _id: false,
      },
    ],
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    calendarStatus: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
    accountType: {
      type: String,
      enum: ['Individual', 'Business', 'Enterprise'],
      default: 'Individual',
    },
    createdBy: {
      type: String,
      required: [true, 'Created By is required'],
      trim: true,
    },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

CustomerSchema.pre('validate', function syncPrimaryContact(next) {
  if (this.contacts && this.contacts.length > 0) {
    this.customerName = this.contacts[0].name;
    this.email = this.contacts[0].email;
    this.phone = this.contacts[0].phone;
  }
  next();
});

CustomerSchema.index({ companyName: 1, customerName: 1, email: 1, phone: 1, status: 1, createdAt: -1 });
CustomerSchema.index({ companyName: 1, status: 1, createdAt: -1 });
CustomerSchema.index({ customerName: 1, status: 1, createdAt: -1 });
CustomerSchema.index({ email: 1, status: 1, createdAt: -1 });
CustomerSchema.index({ phone: 1, status: 1, createdAt: -1 });
CustomerSchema.index({ status: 1, createdAt: -1 });
CustomerSchema.index({ createdBy: 1, status: 1, accountType: 1, createdAt: -1 });
CustomerSchema.index({ email: 1, phone: 1, companyName: 1 });
CustomerSchema.index({ companyName: 1, email: 1, status: 1 });
CustomerSchema.index({ customerId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Customer', CustomerSchema);
