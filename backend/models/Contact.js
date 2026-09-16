const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    customerName: {
      type: String,
      trim: true,
      default: '',
    },
    contactName: {
      type: String,
      trim: true,
      required: [true, 'Contact name is required'],
    },
    designation: {
      type: String,
      trim: true,
      default: '',
    },
    mail: {
      type: String,
      trim: true,
      default: '',
    },
    contactNumber: {
      type: String,
      trim: true,
      required: [true, 'Contact number is required'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: [true, 'Email is required'],
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    calendarStatus: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  },
  { timestamps: true }
);

ContactSchema.index({ customerId: 1, email: 1, contactNumber: 1, contactName: 1 });
ContactSchema.index({ customerName: 1, contactName: 1, email: 1, contactNumber: 1 });
ContactSchema.index({ customerName: 1, contactName: 1, email: 1, createdAt: -1 });
ContactSchema.index({ customerName: 1, contactName: 1, createdAt: -1 });
ContactSchema.index({ email: 1, contactNumber: 1, customerId: 1 });
ContactSchema.index({ contactNumber: 1, email: 1, customerName: 1 });

module.exports = mongoose.model('Contact', ContactSchema);
