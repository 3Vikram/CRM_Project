const express = require('express');
const { getRevenueMarginReport, getReport } = require('../controllers/reportController');
const { askSalesAssistant, exportAnalytics, getAnalytics } = require('../controllers/salesAnalyticsController');
const { reportIssue } = require('../controllers/assistantIssueController');

const router = express.Router();

router.get('/analytics', getAnalytics);
router.get('/analytics/export.xlsx', exportAnalytics);
router.post('/analytics/assistant', askSalesAssistant);
router.post('/analytics/assistant/report-issue', reportIssue);
router.get('/export/:reportKey', getReport);
router.get('/revenue-margin', getRevenueMarginReport);
router.get('/:reportKey', getReport);

module.exports = router;
