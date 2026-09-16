import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema(
  {
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
    productModel: {
      type: String,
      default: '',
      trim: true,
    },
    vendorName: {
      type: String,
      default: '',
      trim: true,
    },
    defaultPrice: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    hsnSac: {
      type: String,
      default: '',
      trim: true,
    },
    gst: {
      type: String,
      required: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    documents: {
      fileName: {
        type: String,
        default: '',
      },
      fileUrl: {
        type: String,
        default: '',
      },
      uploadedAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

export const Product = mongoose.model('Product', ProductSchema);
