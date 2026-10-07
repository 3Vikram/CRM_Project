import mongoose from 'mongoose';

const ReturnedChallanItemSchema = new mongoose.Schema(
  {
    productId: { type: String, default: '' },
    productName: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    hsnSac: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 0.01 },
    uom: { type: String, default: '' },
    serialNumber: { type: String, default: '' },
    unitPrice: { type: Number, default: 0, min: 0 },
    taxLabel: { type: String, default: '' },
    taxRate: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const ReturnedChallanSchema = new mongoose.Schema(
  {
    rcNumber: { type: String, required: true, unique: true, trim: true },
    createdBy: { type: String, default: 'System', trim: true },
    customerName: { type: String, required: true, trim: true },
    contactPerson: { type: String, default: '', trim: true },
    rcDate: { type: Date, required: true },
    collectingPerson: { type: String, required: true, enum: ['Person', 'Courier'] },
    collectingName: { type: String, required: true, trim: true },
    termsOfDelivery: { type: String, default: '' },
    purpose: { type: String, default: '' },
    remarks: { type: String, default: '' },
    status: { type: String, enum: ['Open', 'Close'], default: 'Open' },
    items: {
      type: [ReturnedChallanItemSchema],
      default: [],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'At least one product is required',
      },
    },
  },
  { timestamps: true }
);

export const ReturnedChallan = mongoose.model('ReturnedChallan', ReturnedChallanSchema);
