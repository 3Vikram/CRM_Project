const express = require('express');
const router = express.Router();
const {
  getActivities,
  getActivityById,
  checkActivityCompany,
  createActivity,
  updateActivity,
  deleteActivity,
} = require('../controllers/activityController');
const { getActivityAnalytics } = require('../controllers/activityAnalyticsController');

router.get('/', getActivities);
router.get('/check-company', checkActivityCompany);
router.get('/analytics', getActivityAnalytics);
router.get('/:id', getActivityById);
router.post('/', createActivity);
router.put('/:id', updateActivity);
router.delete('/:id', deleteActivity);

module.exports = router;
