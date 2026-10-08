const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
  getOPFs,
  getOPFById,
  createOPF,
  updateOPF,
  deleteOPF,
  sendOPFPdf,
} = require('../controllers/opfController');

router.get('/', getOPFs);
router.get('/:id', getOPFById);
router.post('/', upload.fields([
  { name: 'poFile', maxCount: 1 },
  { name: 'customerPOFile', maxCount: 1 },
  { name: 'additionalDocument', maxCount: 1 },
  { name: 'uploadedDocuments', maxCount: 100 }
]), createOPF);
router.put('/:id', upload.fields([
  { name: 'poFile', maxCount: 1 },
  { name: 'customerPOFile', maxCount: 1 },
  { name: 'additionalDocument', maxCount: 1 },
  { name: 'uploadedDocuments', maxCount: 100 }
]), updateOPF);
router.post('/:id/send-pdf', sendOPFPdf);
router.delete('/:id', deleteOPF);

module.exports = router;
