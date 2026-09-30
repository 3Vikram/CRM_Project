const express = require('express');
const { getRevenueMarginReport, getReport } = require('../controllers/reportController');

const router = express.Router();

router.get('/revenue-margin', getRevenueMarginReport);
router.get('/:reportKey', getReport);

module.exports = router;
