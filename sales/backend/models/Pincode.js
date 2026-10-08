const mongoose = require('mongoose');

const PincodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    areaName: { type: String, required: true, trim: true },
    cityName: { type: String, required: true, trim: true },
    stateName: { type: String, required: true, trim: true },
    countryName: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Pincode', PincodeSchema);
