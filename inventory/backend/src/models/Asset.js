import mongoose from 'mongoose';

const AssetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    productName: {
      type: String,
      default: '',
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    assetId: {
      type: String,
      unique: true,
      sparse: true,
    },
    bulkUploadId: {
      type: String,
      default: null,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    productDescription: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: '',
    },
    sku: {
      type: String,
      default: '',
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
    hsnSac: {
      type: String,
      default: '',
    },
    gst: {
      type: String,
      default: '',
    },
    manufacturer: {
      type: String,
      default: '',
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
    },
    availableQuantity: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['available', 'outwarding', 'rented', 'sold', 'returned', 'damaged', 'lost'],
      default: 'available',
    },
    price: {
      type: Number,
      default: 0,
    },
    minStockLevel: {
      type: Number,
      default: 0,
    },
    location: {
      type: String,
      default: '',
    },
    purchaseDate: {
      type: Date,
      default: null,
    },
    warrantyExpiry: {
      type: Date,
      default: null,
    },
    warrantyDate: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: String,
      default: 'System',
    },
    // Inward-specific fields
    inwardDate: {
      type: Date,
      default: null,
    },
    vendorName: {
      type: String,
      default: '',
    },
    invoiceNumber: {
      type: String,
      default: '',
    },
    customerName: {
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
    document: {
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
    inwardType: {
      type: String,
      enum: ['Rent In', 'Purchase', 'In Stock'],
      required: true,
      default: 'Purchase',
    },
  },
  {
    timestamps: true,
  }
);

export const Asset = mongoose.model('Asset', AssetSchema);
