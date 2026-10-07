import mongoose from 'mongoose'

const DailyEmailSettingsSchema = new mongoose.Schema(
  {
    ceoEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/.+@.+\..+/, 'Please enter a valid email address'],
    },
    ccEmails: {
      type: [
        {
          type: String,
          trim: true,
          lowercase: true,
          match: [/.+@.+\..+/, 'Please enter a valid email address'],
        },
      ],
      default: [],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length <= 5
        },
        message: 'CC emails cannot exceed 5 recipients',
      },
    },
    dailyReportEnabled: {
      type: Boolean,
      default: true,
    },
    morningReportEnabled: {
      type: Boolean,
      default: true,
    },
    morningReportTime: {
      type: String,
      default: '10:00',
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter time in HH:MM format'],
    },
    eveningReportEnabled: {
      type: Boolean,
      default: true,
    },
    eveningReportTime: {
      type: String,
      default: '17:50',
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter time in HH:MM format'],
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    companyName: {
      type: String,
      default: '3Vikram Technologies',
    },
    lastUpdatedBy: {
      type: String,
      default: 'System',
    },
  },
  {
    timestamps: true,
  }
)

// Ensure there's only one settings document
DailyEmailSettingsSchema.pre('save', async function (next) {
  if (this.isNew) {
    const existingSettings = await mongoose.model('DailyEmailSettings').findOne()
    if (existingSettings) {
      throw new Error('Daily Email Settings already exists. Update the existing record instead.')
    }
  }
  next()
})

export const DailyEmailSettings = mongoose.model('DailyEmailSettings', DailyEmailSettingsSchema)
