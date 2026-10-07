import mongoose from 'mongoose';

const DeliveryChallanItemSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      default: '',
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    hsnSac: {
      type: String,
      default: '',
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.01,
    },
    unitPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    uom: {
      type: String,
      default: '',
      trim: true,
    },
    lineTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const DeliveryChallanSchema = new mongoose.Schema(
  {
    challanNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    contactPerson: {
      type: String,
      default: '',
      trim: true,
    },
    opfNo: {
      type: String,
      default: '',
      trim: true,
    },
    accountManager: {
      type: String,
      default: '',
      trim: true,
    },
    poNo: {
      type: String,
      default: '',
      trim: true,
    },
    poDate: {
      type: Date,
      default: null,
    },
    despatchDocumentNo: {
      type: String,
      default: '',
      trim: true,
    },
    dcType: {
      type: String,
      default: '',
      trim: true,
    },
    validityInDays: {
      type: Number,
      default: null,
      min: 0,
    },
    deliveryInDays: {
      type: Number,
      default: null,
      min: 0,
    },
    expectedClosure: {
      type: Date,
      default: null,
    },
    currency: {
      type: String,
      default: '',
      trim: true,
    },
    deliveryNote: {
      type: String,
      default: '',
      trim: true,
    },
    dispatchedThrough: {
      type: String,
      default: '',
      trim: true,
    },
    destination: {
      type: String,
      default: '',
      trim: true,
    },
    returnDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      default: 'Open',
      trim: true,
    },
    signatureRequired: {
      type: Boolean,
      default: false,
    },
    items: {
      type: [DeliveryChallanItemSchema],
      default: [],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'At least one product is required',
      },
    },
  },
  {
    timestamps: true,
  }
);

export const DeliveryChallan = mongoose.model('DeliveryChallan', DeliveryChallanSchema);
