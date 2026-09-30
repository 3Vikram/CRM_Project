const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema(
  {
    dashboard: { type: Boolean, default: true },
    customers: {
      view: { type: Boolean, default: true },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },
    contacts: {
      view: { type: Boolean, default: true },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },
    leads: {
      view: { type: Boolean, default: true },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },
    activities: {
      view: { type: Boolean, default: true },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },
    mailCampaign: {
      view: { type: Boolean, default: true },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },
    suppliers: {
      view: { type: Boolean, default: true },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },
    quotations: {
      view: { type: Boolean, default: true },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },
    opf: {
      view: { type: Boolean, default: true },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },
  },
  { _id: false }
);

const EmployeeSchema = new mongoose.Schema(
  {
    employeeCode: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
    },
    officialEmployeeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    employeeName: {
      type: String,
      trim: true,
      required: [true, 'Employee name is required'],
    },
    fullName: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: [true, 'Employee email is required'],
      unique: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      trim: true,
      default: '',
    },
    passwordHash: {
      type: String,
      trim: true,
      default: '',
    },
    passwordSalt: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    contactNo: {
      type: String,
      trim: true,
      default: '',
    },
    designation: {
      type: String,
      trim: true,
      default: '',
    },
    department: {
      type: String,
      trim: true,
      default: 'Sales',
    },
    role: {
      type: String,
      trim: true,
      enum: ['Sales Head', 'Sales Manager', 'Sales Executive', 'Administrator', 'Support'],
      default: 'Sales Executive',
    },
    status: {
      type: String,
      trim: true,
      enum: ['Active', 'Inactive', 'On Leave'],
      default: 'Active',
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    dateOfJoin: {
      type: Date,
      default: null,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    employeeType: {
      type: String,
      trim: true,
      default: '',
    },
    reportingTo: {
      type: String,
      trim: true,
      default: '',
    },
    orderApprovalTo: {
      type: String,
      trim: true,
      default: '',
    },
    branchCode: {
      type: String,
      trim: true,
      default: '',
    },
    crudOption: {
      type: [String],
      default: [],
    },
    modulesOption: {
      type: [String],
      default: [],
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: String,
      trim: true,
      default: 'Admin',
    },
    permissions: {
      type: permissionSchema,
      default: () => ({
        dashboard: true,
        customers: { view: true, create: false, edit: false, delete: false },
        contacts: { view: true, create: false, edit: false, delete: false },
        leads: { view: true, create: false, edit: false, delete: false },
        activities: { view: true, create: false, edit: false, delete: false },
        mailCampaign: { view: true, create: false, edit: false, delete: false },
        suppliers: { view: true, create: false, edit: false, delete: false },
        quotations: { view: true, create: false, edit: false, delete: false },
        opf: { view: true, create: false, edit: false, delete: false },
      }),
    },
  },
  { timestamps: true }
);

EmployeeSchema.index({ employeeName: 1, email: 1, role: 1, status: 1, department: 1, createdAt: -1 });
EmployeeSchema.index({ department: 1, role: 1, status: 1, createdAt: -1 });
EmployeeSchema.index({ email: 1, phone: 1 });

module.exports = mongoose.model('Employee', EmployeeSchema);
