const express = require('express');
const router = express.Router();
const {
  getCountries,
  getStates,
  getCities,
  getAreas,
  getPincodes,
} = require('../controllers/locationController');

router.get('/countries', getCountries);
router.get('/states/:country', getStates);
router.get('/cities/:state', getCities);
router.get('/areas/:city', getAreas);
router.get('/pincodes/:area', getPincodes);

module.exports = router;
