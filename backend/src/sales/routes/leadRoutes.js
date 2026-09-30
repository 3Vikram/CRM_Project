const express = require('express');
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

router.get('/', getLeads);
router.get('/:id', getLeadById);
router.post('/', createLead);
router.put('/:id', updateLead);
router.delete('/:id', deleteLead);
router.post('/move-activity', moveToActivity);
router.post('/move-funnel', moveToFunnel);
router.post('/generate-quotation', generateQuotation);
router.post('/convert-customer', convertToCustomer);
router.post('/scrap', scrapLead);
router.post('/:id/send-pdf', sendQuotationPdf);
router.post('/mailcampaign/open-event', handleMailOpenEvent);

module.exports = router;
