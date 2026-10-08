const mongoose = require('mongoose');

const CitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    stateCode: { type: String, required: true, trim: true, uppercase: true },
    stateName: { type: String, required: true, trim: true },
    countryCode: { type: String, required: true, trim: true, uppercase: true },
    countryName: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('City', CitySchema);
