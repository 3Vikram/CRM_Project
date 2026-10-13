const { seedLocations } = require('../models/LocationRepository');
const Country = require('../models/Country');
const State = require('../models/State');
const City = require('../models/City');
const Area = require('../models/Area');
const Pincode = require('../models/Pincode');

const normalizePathName = (value = '') => String(value).replace(/-/g, ' ').trim();

exports.seedLocations = seedLocations;

exports.getCountries = async (_req, res) => {
  try {
    seedLocations();
    return res.status(200).json({ success: true, data: Country.findAll() });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStates = async (req, res) => {
  try {
    const data = State.findByCountry(normalizePathName(req.params.country));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCities = async (req, res) => {
  try {
    const data = City.findByState(normalizePathName(req.params.state));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAreas = async (req, res) => {
  try {
    const data = Area.findByCity(normalizePathName(req.params.city));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPincodes = async (req, res) => {
  try {
    const data = Pincode.findByArea(normalizePathName(req.params.area));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
