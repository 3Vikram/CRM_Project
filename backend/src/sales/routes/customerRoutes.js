const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} = require('../controllers/customerController');

router.get('/', getCustomers);
router.get('/:id', getCustomerById);
router.post('/', upload.array('documents', 10), createCustomer);
router.put('/:id', upload.array('documents', 10), updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;
