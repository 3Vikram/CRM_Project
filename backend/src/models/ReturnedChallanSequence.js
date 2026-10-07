import mongoose from 'mongoose';

const ReturnedChallanSequenceSchema = new mongoose.Schema(
  {
    _id: { type: String },
    value: { type: Number, default: 0 },
  },
  { versionKey: false }
);

export const ReturnedChallanSequence = mongoose.model(
  'ReturnedChallanSequence',
  ReturnedChallanSequenceSchema
);
