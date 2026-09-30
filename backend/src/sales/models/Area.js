const mongoose = require('mongoose');

const AreaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    cityName: { type: String, required: true, trim: true },
    stateName: { type: String, required: true, trim: true },
    countryName: { type: String, required: true, trim: true },
    pincode: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Area', AreaSchema);
