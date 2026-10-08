const mongoose = require('mongoose');

const CountrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    isoCode: { type: String, trim: true, uppercase: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Country', CountrySchema);
