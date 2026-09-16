import mongoose from 'mongoose'

const DailyEmailSnapshotSchema = new mongoose.Schema(
  {
    reportDate: {
      type: Date,
      required: true,
      index: true,
    },
    reportType: {
      type: String,
      enum: ['morning', 'evening'],
      default: 'morning',
      index: true,
    },
    snapshotTime: {
      type: String,
      default: '10:00',
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    assets: [
      {
        assetId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Asset',
          default: null,
        },
        productName: { type: String, default: '' },
        productDescription: { type: String, default: '' },
        productModel: { type: String, default: '' },
        unitPrice: { type: Number, default: 0 },
        serialNumber: { type: String, default: '' },
        status: { type: String, default: 'In Stock' },
      },
    ],
  },
  {
    timestamps: true,
  }
)

DailyEmailSnapshotSchema.index({ reportDate: 1, reportType: 1 }, { unique: true })

export const DailyEmailSnapshot = mongoose.model('DailyEmailSnapshot', DailyEmailSnapshotSchema)
