const express = require('express');
const { requireLeadRecordPermission } = require('../middleware/authMiddleware');
const router = express.Router();
const {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  handleMailOpenEvent,
  moveToActivity,
  moveToFunnel,
  generateQuotation,
  convertToCustomer,
  scrapLead,
  sendQuotationPdf,
} = require('../controllers/leadController');

router.get('/', requireLeadRecordPermission('view', 'list'), getLeads);
router.get('/:id', requireLeadRecordPermission('view', 'record'), getLeadById);
router.post('/', requireLeadRecordPermission('create', 'new-record'), createLead);
router.put('/:id', requireLeadRecordPermission('edit', 'record'), updateLead);
router.delete('/:id', requireLeadRecordPermission('delete', 'record'), deleteLead);
router.post('/move-activity', requireLeadRecordPermission('edit'), moveToActivity);
router.post('/move-funnel', requireLeadRecordPermission('create'), moveToFunnel);
router.post('/generate-quotation', requireLeadRecordPermission('create', 'quotation'), generateQuotation);
router.post('/convert-customer', requireLeadRecordPermission('create', 'lead'), convertToCustomer);
router.post('/scrap', requireLeadRecordPermission('edit'), scrapLead);
router.post('/:id/send-pdf', requireLeadRecordPermission('edit', 'quotation'), sendQuotationPdf);
router.post('/mailcampaign/open-event', requireLeadRecordPermission('create'), handleMailOpenEvent);

module.exports = router;
