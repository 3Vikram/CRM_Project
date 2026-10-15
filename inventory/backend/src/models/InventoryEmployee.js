import mongoose from 'mongoose';

const InventoryEmployeeSchema = new mongoose.Schema(
  {
    employeeName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_document, returned) {
        delete returned.passwordHash;
        delete returned.__v;
        return returned;
      },
    },
  }
);

export const InventoryEmployee = mongoose.model('InventoryEmployee', InventoryEmployeeSchema);