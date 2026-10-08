const mongoose = require('mongoose');

const CustomerBatchSchema = new mongoose.Schema(
  {
    employeeId: { type: String, trim: true, default: '' },
    employeeEmail: { type: String, trim: true, lowercase: true, default: '' },
    employeeName: { type: String, trim: true, default: '' },
    batchNumber: { type: Number, min: 1, required: true },
    customerCount: { type: Number, min: 0, default: 0 },
    customers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
    fileName: { type: String, trim: true, default: '' },
    createdDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

CustomerBatchSchema.index({ employeeId: 1, batchNumber: 1 });

module.exports = mongoose.model('CustomerBatch', CustomerBatchSchema);