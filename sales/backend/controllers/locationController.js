const Country = require('../models/Country');
const State = require('../models/State');
const City = require('../models/City');
const Area = require('../models/Area');
const Pincode = require('../models/Pincode');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const seedLocations = async () => {
  const existingCountries = await Country.countDocuments();
  if (existingCountries === 0) {
    const sampleCountries = [
      { name: 'India', code: 'IND', isoCode: 'IN' },
      { name: 'United States', code: 'USA', isoCode: 'US' },
      { name: 'Australia', code: 'AUS', isoCode: 'AU' },
      { name: 'Canada', code: 'CAN', isoCode: 'CA' },
      { name: 'Germany', code: 'DEU', isoCode: 'DE' },
      { name: 'Japan', code: 'JPN', isoCode: 'JP' },
      { name: 'France', code: 'FRA', isoCode: 'FR' },
      { name: 'Singapore', code: 'SGP', isoCode: 'SG' },
    ];

    await Country.insertMany(sampleCountries);
  }

  const existingStates = await State.countDocuments();
  if (existingStates === 0) {
    const indiaStates = [
      { name: 'Karnataka', code: 'KA', countryCode: 'IN', countryName: 'India' },
      { name: 'Kerala', code: 'KL', countryCode: 'IN', countryName: 'India' },
      { name: 'Tamil Nadu', code: 'TN', countryCode: 'IN', countryName: 'India' },
      { name: 'Andhra Pradesh', code: 'AP', countryCode: 'IN', countryName: 'India' },
      { name: 'Telangana', code: 'TS', countryCode: 'IN', countryName: 'India' },
      { name: 'Maharashtra', code: 'MH', countryCode: 'IN', countryName: 'India' },
    ];

    const usStates = [
      { name: 'California', code: 'CA', countryCode: 'US', countryName: 'United States' },
      { name: 'Texas', code: 'TX', countryCode: 'US', countryName: 'United States' },
      { name: 'New York', code: 'NY', countryCode: 'US', countryName: 'United States' },
    ];

    await State.insertMany([...indiaStates, ...usStates]);
  }

  const existingCities = await City.countDocuments();
  if (existingCities === 0) {
    const karnatakaCities = [
      { name: 'Bangalore', stateCode: 'KA', stateName: 'Karnataka', countryCode: 'IN', countryName: 'India' },
      { name: 'Bangalore Rural', stateCode: 'KA', stateName: 'Karnataka', countryCode: 'IN', countryName: 'India' },
      { name: 'Bangalore Urban', stateCode: 'KA', stateName: 'Karnataka', countryCode: 'IN', countryName: 'India' },
      { name: 'Tumkur', stateCode: 'KA', stateName: 'Karnataka', countryCode: 'IN', countryName: 'India' },
      { name: 'Mysore', stateCode: 'KA', stateName: 'Karnataka', countryCode: 'IN', countryName: 'India' },
      { name: 'Hubli', stateCode: 'KA', stateName: 'Karnataka', countryCode: 'IN', countryName: 'India' },
      { name: 'Belgaum', stateCode: 'KA', stateName: 'Karnataka', countryCode: 'IN', countryName: 'India' },
      { name: 'Mangalore', stateCode: 'KA', stateName: 'Karnataka', countryCode: 'IN', countryName: 'India' },
    ];

    const usCities = [
      { name: 'Los Angeles', stateCode: 'CA', stateName: 'California', countryCode: 'US', countryName: 'United States' },
      { name: 'San Francisco', stateCode: 'CA', stateName: 'California', countryCode: 'US', countryName: 'United States' },
      { name: 'Austin', stateCode: 'TX', stateName: 'Texas', countryCode: 'US', countryName: 'United States' },
      { name: 'New York City', stateCode: 'NY', stateName: 'New York', countryCode: 'US', countryName: 'United States' },
    ];

    await City.insertMany([...karnatakaCities, ...usCities]);
  }

  const existingAreas = await Area.countDocuments();
  if (existingAreas === 0) {
    const areas = [
      { name: 'Ittmadu', cityName: 'Bangalore', stateName: 'Karnataka', countryName: 'India', pincode: '560001' },
      { name: 'Indiranagar', cityName: 'Bangalore', stateName: 'Karnataka', countryName: 'India', pincode: '560038' },
      { name: 'Koramangala', cityName: 'Bangalore', stateName: 'Karnataka', countryName: 'India', pincode: '560034' },
      { name: 'Whitefield', cityName: 'Bangalore', stateName: 'Karnataka', countryName: 'India', pincode: '560066' },
      { name: 'Bangalore Rural Hub', cityName: 'Bangalore Rural', stateName: 'Karnataka', countryName: 'India', pincode: '562106' },
      { name: 'Bangalore Urban Hub', cityName: 'Bangalore Urban', stateName: 'Karnataka', countryName: 'India', pincode: '560001' },
      { name: 'Tumkur Main', cityName: 'Tumkur', stateName: 'Karnataka', countryName: 'India', pincode: '572101' },
      { name: 'Mysore Palace Road', cityName: 'Mysore', stateName: 'Karnataka', countryName: 'India', pincode: '570001' },
    ];

    const usAreas = [
      { name: 'Downtown', cityName: 'Los Angeles', stateName: 'California', countryName: 'United States', pincode: '90001' },
      { name: 'Mission District', cityName: 'San Francisco', stateName: 'California', countryName: 'United States', pincode: '94105' },
      { name: 'South Congress', cityName: 'Austin', stateName: 'Texas', countryName: 'United States', pincode: '78704' },
      { name: 'Midtown', cityName: 'New York City', stateName: 'New York', countryName: 'United States', pincode: '10001' },
    ];

    await Area.insertMany([...areas, ...usAreas]);
  }

  const existingPincodes = await Pincode.countDocuments();
  if (existingPincodes === 0) {
    const areas = await Area.find({}, { _id: 0, name: 1, cityName: 1, stateName: 1, countryName: 1, pincode: 1 });
    const pincodes = areas.map((area) => ({
      code: area.pincode,
      areaName: area.name,
      cityName: area.cityName,
      stateName: area.stateName,
      countryName: area.countryName,
    }));

    await Pincode.insertMany(pincodes);
  }
};

exports.seedLocations = seedLocations;

exports.getCountries = async (req, res) => {
  try {
    await seedLocations();
    const countries = await Country.find({}, { _id: 0, name: 1, code: 1, isoCode: 1 }).sort({ name: 1 });
    res.status(200).json({ success: true, data: countries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStates = async (req, res) => {
  try {
    const { country } = req.params;
    const countryName = country.replace(/-/g, ' ');
    const states = await State.find({ countryName: { $regex: new RegExp(`^${escapeRegex(countryName)}$`, 'i') } }, { _id: 0, name: 1, code: 1, countryName: 1 }).sort({ name: 1 });
    res.status(200).json({ success: true, data: states });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCities = async (req, res) => {
  try {
    const { state } = req.params;
    const stateName = state.replace(/-/g, ' ');
    const cities = await City.find({ stateName: { $regex: new RegExp(`^${escapeRegex(stateName)}$`, 'i') } }, { _id: 0, name: 1, stateName: 1 }).sort({ name: 1 });
    res.status(200).json({ success: true, data: cities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAreas = async (req, res) => {
  try {
    const { city } = req.params;
    const cityName = city.replace(/-/g, ' ');
    const areas = await Area.find({ cityName: { $regex: new RegExp(`^${escapeRegex(cityName)}$`, 'i') } }, { _id: 0, name: 1, cityName: 1 }).sort({ name: 1 });
    res.status(200).json({ success: true, data: areas });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPincodes = async (req, res) => {
  try {
    const { area } = req.params;
    const areaName = area.replace(/-/g, ' ');
    const pincodes = await Pincode.find({ areaName: { $regex: new RegExp(`^${escapeRegex(areaName)}$`, 'i') } }, { _id: 0, code: 1, areaName: 1 }).sort({ code: 1 });
    res.status(200).json({ success: true, data: pincodes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.seedLocations = seedLocations;

exports.getCountries = async (req, res) => {
  try {
    await seedLocations();
    const countries = await Country.find({}, { _id: 0, name: 1, code: 1, isoCode: 1 }).sort({ name: 1 });
    res.status(200).json({ success: true, data: countries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStates = async (req, res) => {
  try {
    const { country } = req.params;
    const countryName = country.replace(/-/g, ' ');
    const states = await State.find({ countryName: { $regex: new RegExp(countryName, 'i') } }, { _id: 0, name: 1, code: 1, countryName: 1 }).sort({ name: 1 });
    res.status(200).json({ success: true, data: states });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCities = async (req, res) => {
  try {
    const { state } = req.params;
    const stateName = state.replace(/-/g, ' ');
    const cities = await City.find({ stateName: { $regex: new RegExp(stateName, 'i') } }, { _id: 0, name: 1, stateName: 1 }).sort({ name: 1 });
    res.status(200).json({ success: true, data: cities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAreas = async (req, res) => {
  try {
    const { city } = req.params;
    const cityName = city.replace(/-/g, ' ');
    const areas = await Area.find({ cityName: { $regex: new RegExp(cityName, 'i') } }, { _id: 0, name: 1, cityName: 1 }).sort({ name: 1 });
    res.status(200).json({ success: true, data: areas });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPincodes = async (req, res) => {
  try {
    const { area } = req.params;
    const areaName = area.replace(/-/g, ' ');
    const pincodes = await Pincode.find({ areaName: { $regex: new RegExp(areaName, 'i') } }, { _id: 0, code: 1, areaName: 1 }).sort({ code: 1 });
    res.status(200).json({ success: true, data: pincodes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
