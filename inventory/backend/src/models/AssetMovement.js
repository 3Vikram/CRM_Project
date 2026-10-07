import mongoose from 'mongoose';

const AssetMovementSchema = new mongoose.Schema(
  {
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: true,
    },
    assetName: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['INWARD', 'OUTWARD', 'RENT_OUT', 'RETURNED', 'SOLD', 'SOLD_OUT', 'DAMAGED', 'LOST', 'TRANSFER'],
      required: true,
    },
    customerName: {
      type: String,
      default: '',
    },
    outwardType: {
      type: String,
      enum: ['Rent', 'Sell'],
      default: 'Sell',
    },
    quantity: {
      type: Number,
      required: true,
    },
    serialNumber: {
      type: String,
      default: '',
    },
    productSerialNumber: {
      type: String,
      default: '',
    },
    productModel: {
      type: String,
      default: '',
    },
    vendorName: {
      type: String,
      default: '',
    },
    productName: {
      type: String,
      default: '',
    },
    productDescription: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      default: 0,
    },
    customerId: {
      type: String,
      default: '',
    },
    documentNumber: {
      type: String,
      default: '',
    },
    rentStartDate: {
      type: String,
      default: '',
    },
    rentEndDate: {
      type: String,
      default: '',
    },
    invoiceNumber: {
      type: String,
      default: '',
    },
    remarks: {
      type: String,
      default: '',
    },
    movementDate: {
      type: Date,
      default: Date.now,
    },
    description: {
      type: String,
      default: '',
    },
    performedBy: {
      type: String,
      default: 'Admin',
    },
    reference: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export const AssetMovement = mongoose.model('AssetMovement', AssetMovementSchema);
