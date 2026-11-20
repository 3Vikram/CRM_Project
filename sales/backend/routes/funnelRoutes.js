const express = require('express');
const { getFunnelAnalytics } = require('../controllers/funnelAnalyticsController');

const router = express.Router();

router.get('/analytics', getFunnelAnalytics);

module.exports = router;
