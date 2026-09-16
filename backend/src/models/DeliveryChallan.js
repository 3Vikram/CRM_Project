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
    status: {
      type: String,
      default: 'Pending',
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
