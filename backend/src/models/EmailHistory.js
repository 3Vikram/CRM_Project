import mongoose from 'mongoose'

const EmailHistorySchema = new mongoose.Schema(
  {
    reportType: {
      type: String,
      enum: ['daily', 'morning', 'evening', 'test'],
      required: true,
    },
    reportDateKey: {
      type: String,
      default: null,
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    scheduledTime: {
      type: String,
      required: true,
    },
    recipients: {
      to: {
        type: String,
        required: true,
      },
      cc: {
        type: [String],
        default: [],
      },
    },
    subject: {
      type: String,
      required: true,
    },
    reportFilename: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    sentAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: '',
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    lastRetryAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

// Index for querying email history
EmailHistorySchema.index({ scheduledDate: -1 })
EmailHistorySchema.index({ reportType: 1, scheduledDate: -1 })
EmailHistorySchema.index({ reportType: 1, reportDateKey: 1 }, { unique: true, sparse: true })
EmailHistorySchema.index({ status: 1 })

export const EmailHistory = mongoose.model('EmailHistory', EmailHistorySchema)
