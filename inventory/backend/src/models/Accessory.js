import mongoose from 'mongoose';

const ACCESSORY_TYPES = [
  'RAM',
  'Display',
  'Battery',
  'Base',
  'Keyboard',
  'Mouse',
  'Adapter',
  'HDD',
  'Graphic Card',
  'Panel',
  'SSD',
];

const ACCESSORY_STATUS = ['In Stock', 'Sold', 'Issued'];

const AccessorySchema = new mongoose.Schema(
  {
    accessoryType: {
      type: String,
      required: [true, 'Accessory type is required'],
      trim: true,
      enum: {
        values: ACCESSORY_TYPES,
        message: 'Accessory type is invalid',
      },
    },
    brand: {
      type: String,
      default: '',
      trim: true,
    },
    model: {
      type: String,
      default: '',
      trim: true,
    },
    serialNumber: {
      type: String,
      default: '',
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      default: 1,
    },
    purchasePrice: {
      type: Number,
      default: 0,
      min: [0, 'Purchase price cannot be negative'],
    },
    vendorName: {
      type: String,
      default: '',
      trim: true,
    },
    purchaseDate: {
      type: Date,
      default: null,
    },
    returnedDate: {
      type: Date,
      default: null,
    },
    warrantyExpiry: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ACCESSORY_STATUS,
        message: 'Status is invalid',
      },
      default: 'In Stock',
    },
  },
  {
    timestamps: true,
  }
);

AccessorySchema.index({ accessoryType: 1, serialNumber: 1 }, { unique: false });

export const Accessory = mongoose.model('Accessory', AccessorySchema);
export { ACCESSORY_TYPES, ACCESSORY_STATUS };
