const express = require('express');
const { authMiddleware, requirePermission } = require('../middleware/authMiddleware');
const router = express.Router();
const {
  uploads,
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  sendCampaign,
  trackOpen,
  getTrackingDiagnostic,
  trackClick,
  getCampaignReport,
  getCampaignPreview,
  getRecipientCounts,
  getRecipientData,
} = require('../controllers/mailCampaignController');

router.get('/recipient-counts', authMiddleware, requirePermission('mailCampaign', 'view'), getRecipientCounts);
router.get('/recipient-data', authMiddleware, requirePermission('mailCampaign', 'view'), getRecipientData);
router.get('/track/diagnostic/:trackingId', getTrackingDiagnostic);
router.get('/track/open/:trackingId', trackOpen);
router.get('/track/click/:trackingId', trackClick);
router.get('/open/:trackingId', trackOpen);
router.get('/tracking/open/:trackingId', trackOpen);
router.get('/tracking/click/:token', trackClick);
router.get('/:id/report', authMiddleware, requirePermission('mailCampaign', 'view'), getCampaignReport);
router.get('/:id/preview', authMiddleware, requirePermission('mailCampaign', 'view'), getCampaignPreview);
router.get('/', authMiddleware, requirePermission('mailCampaign', 'view'), getCampaigns);
router.get('/:id', authMiddleware, requirePermission('mailCampaign', 'view'), getCampaignById);
router.post('/', authMiddleware, requirePermission('mailCampaign', 'create'), uploads, createCampaign);
router.put('/:id', authMiddleware, requirePermission('mailCampaign', 'edit'), uploads, updateCampaign);
router.post('/:id/send', authMiddleware, requirePermission('mailCampaign', 'edit'), sendCampaign);
router.delete('/:id', authMiddleware, requirePermission('mailCampaign', 'delete'), deleteCampaign);

module.exports = router;
