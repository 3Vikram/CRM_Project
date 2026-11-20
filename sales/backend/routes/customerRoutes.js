const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
  getCustomers,
  getCustomerSummary,
  getCustomerAnalytics,
  getCustomerById,
  checkCustomerDuplicate,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} = require('../controllers/customerController');

router.get('/', getCustomers);
router.get('/analytics', getCustomerAnalytics);
router.get('/summary', getCustomerSummary);
router.post('/check-duplicate', checkCustomerDuplicate);
router.get('/:id', getCustomerById);
router.post('/', upload.array('documents', 10), createCustomer);
router.put('/:id', upload.array('documents', 10), updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;
