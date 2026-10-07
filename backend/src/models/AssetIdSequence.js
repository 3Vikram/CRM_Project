import mongoose from 'mongoose';

const AssetIdSequenceSchema = new mongoose.Schema(
  {
    _id: String,
    value: {
      type: Number,
      default: 0,
    },
    migrationComplete: {
      type: Boolean,
      default: false,
    },
    migrationLockToken: {
      type: String,
      default: '',
    },
    migrationLockExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { versionKey: false }
);

export const AssetIdSequence = mongoose.model('AssetIdSequence', AssetIdSequenceSchema);
