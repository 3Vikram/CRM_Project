const mongoose = require('mongoose');

const FileReferenceSchema = new mongoose.Schema(
  {
    fileName: { type: String, trim: true, default: '' },
    filePath: { type: String, trim: true, default: '' },
    mimeType: { type: String, trim: true, default: '' },
    uploadDate: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CompanyProfileSchema = new mongoose.Schema(
  {
    directorName: { type: String, trim: true, required: [true, 'Director Name is required'] },
    directorDesignation: { type: String, trim: true, required: [true, 'Director Designation is required'] },
    companyName: { type: String, trim: true, required: [true, 'Company Name is required'] },
    branchName: { type: String, trim: true, default: '' },
    branchCode: { type: String, trim: true, default: '' },
    registeredAddress: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, required: [true, 'City is required'] },
    state: { type: String, trim: true, required: [true, 'State is required'] },
    pin: { type: String, trim: true, required: [true, 'PIN is required'] },
    country: { type: String, trim: true, required: [true, 'Country is required'] },
    companyContactNo: { type: String, trim: true, default: '' },
    website: { type: String, trim: true, required: [true, 'Website is required'] },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: [true, 'Email is required'],
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    companyLogo: { type: FileReferenceSchema, default: () => ({}) },
    documentLogo: { type: FileReferenceSchema, default: () => ({}) },
    documentHeader: { type: FileReferenceSchema, default: () => ({}) },
    documentHeaderRequired: { type: Boolean, default: false },
    documentFooter: { type: FileReferenceSchema, default: () => ({}) },
    documentFooterRequired: { type: Boolean, default: false },
    gstNo: { type: String, trim: true, uppercase: true, required: [true, 'GST No. is required'] },
    panNo: { type: String, trim: true, uppercase: true, required: [true, 'PAN No. is required'] },
    bankName: { type: String, trim: true, required: [true, 'Bank Name is required'] },
    accountHolderName: { type: String, trim: true, required: [true, 'Account Holder Name is required'] },
    accountNo: { type: String, trim: true, required: [true, 'Account No. is required'] },
    ifscCode: { type: String, trim: true, uppercase: true, required: [true, 'IFSC Code is required'] },
    swiftCode: { type: String, trim: true, uppercase: true, required: [true, 'Swift Code is required'] },
    cin: { type: String, trim: true, required: [true, 'CIN is required'] },
    iec: { type: String, trim: true, required: [true, 'IEC is required'] },
    quotationFormat: { type: String, trim: true, required: [true, 'Quotation Format is required'] },
    idNoFormat: { type: String, trim: true, required: [true, 'ID No. Format is required'] },
    opfFormat: { type: String, trim: true, required: [true, 'OPF Format is required'] },
    poFormat: { type: String, trim: true, required: [true, 'PO Format is required'] },
    piFormat: { type: String, trim: true, required: [true, 'PI Format is required'] },
    invoiceFormat: { type: String, trim: true, required: [true, 'Invoice Format is required'] },
    prFormat: { type: String, trim: true, required: [true, 'PR Format is required'] },
    enquiryFormat: { type: String, trim: true, required: [true, 'Enquiry Format is required'] },
    challanFormat: { type: String, trim: true, required: [true, 'Challan Format is required'] },
    createdBy: { type: String, trim: true, default: 'Admin' },
  },
  { timestamps: true }
);

CompanyProfileSchema.index({ companyName: 1, email: 1, directorName: 1 });

module.exports = mongoose.model('CompanyProfile', CompanyProfileSchema);
