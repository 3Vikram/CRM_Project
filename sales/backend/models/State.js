const mongoose = require('mongoose');

const StateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    countryCode: { type: String, required: true, trim: true, uppercase: true },
    countryName: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('State', StateSchema);
