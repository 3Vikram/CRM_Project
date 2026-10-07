import mongoose from 'mongoose';

const AccessoryMovementSchema = new mongoose.Schema(
  {
    accessory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Accessory',
      required: true,
      index: true,
    },
    accessoryType: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      enum: ['Purchased', 'Issued', 'Returned', 'Sold', 'Adjusted'],
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    startDate: {
      type: Date,
      default: null,
    },
    quantity: {
      type: Number,
      default: 0,
      min: [0, 'Quantity cannot be negative'],
    },
    price: {
      type: Number,
      default: 0,
      min: [0, 'Price cannot be negative'],
    },
    relatedAssetSerialNumber: {
      type: String,
      default: '',
      trim: true,
    },
    person: {
      type: String,
      default: '',
      trim: true,
    },
    remarks: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

AccessoryMovementSchema.index({ accessory: 1, date: -1 });
AccessoryMovementSchema.index({ accessoryType: 1, date: -1 });

export const AccessoryMovement = mongoose.model('AccessoryMovement', AccessoryMovementSchema);
