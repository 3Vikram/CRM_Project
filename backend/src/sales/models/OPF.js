const mongoose = require('mongoose');

const POFileSchema = new mongoose.Schema(
  {
    fileName: { type: String, trim: true, default: '' },
    filePath: { type: String, trim: true, default: '' },
    mimeType: { type: String, trim: true, default: '' },
    uploadDate: { type: Date, default: Date.now },
  },
  { _id: false }
);

const OPFSchema = new mongoose.Schema(
  {
    // Section 1: Quotation Details
    opfNo: { type: String, trim: true, required: [true, 'OPF No. is required'], unique: true, sparse: true },
    quotationNumber: { type: String, trim: true, required: [true, 'Quotation Number is required'] },
    quotationId: { type: String, trim: true, default: '' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerName: { type: String, trim: true, required: [true, 'Customer Name is required'] },
    contactPerson: { type: String, trim: true, default: '' },

    // Section 2: Supplier/Product Details
    supplierName: { type: String, trim: true, required: [true, 'Supplier Name is required'] },
    supplierContactPerson: { type: String, trim: true, default: '' },
    product: { type: String, trim: true, required: [true, 'Product is required'] },
    description: { type: String, trim: true, default: '' },
    quantity: { type: Number, default: 0 },
    unitPrice: { type: Number, default: 0 },
    vendorPrice: { type: Number, default: 0 },
    tax: { type: String, trim: true, default: '' },
    partNo: { type: String, trim: true, default: '' },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },

    // Section 3: Service/Purchase/End User Details
    serviceName: { type: String, trim: true, default: '' },
    serviceCost: { type: Number, default: 0 },
    serviceTax: { type: Number, default: 0 },
    freightName: { type: String, trim: true, default: '' },
    freightCost: { type: Number, default: 0 },
    freightTax: { type: Number, default: 0 },
    wht: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 1 },
    vendorCurrency: { type: String, trim: true, default: 'INR' },
    eta: { type: Date, default: null },
    customerPONo: { type: String, trim: true, default: '' },
    customerPODate: { type: Date, default: null },
    amc: { type: String, trim: true, default: '' },
    amcRenewalDate: { type: Date, default: null },
    notes: { type: String, trim: true, default: '' },
    customerPaymentTerms: { type: String, trim: true, default: '' },
    supplierPaymentTerms: { type: String, trim: true, default: '' },
    enduserName: { type: String, trim: true, default: '' },
    enduserEmail: { type: String, trim: true, default: '' },
    enduserContact: { type: String, trim: true, default: '' },
    enduserAddress: { type: String, trim: true, default: '' },
    billToAddress: { type: String, trim: true, default: '' },
    shipToAddress: { type: String, trim: true, default: '' },

    // Section 4: Other Documents
    customerPOFile: { type: POFileSchema, default: null },
    additionalDocument: { type: POFileSchema, default: null },
    uploadedDocuments: [POFileSchema],

    // Metadata
    createdBy: { type: String, trim: true, default: 'Admin' },
    createdDate: { type: Date, default: Date.now },
    renewalDate: { type: Date, default: null },
    approvalStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Under Review'],
      default: 'Pending',
    },
  },
  { timestamps: true }
);

OPFSchema.index({ opfNo: 1, quotationNumber: 1, customerName: 1, approvalStatus: 1, createdDate: -1 });
OPFSchema.index({ customerName: 1, createdBy: 1, approvalStatus: 1, createdDate: -1 });

module.exports = mongoose.model('OPF', OPFSchema);
