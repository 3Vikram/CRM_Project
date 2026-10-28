const express = require('express');
const {
  getMappingCustomers,
  getMappingEmployees,
  assignCustomers,
} = require('../controllers/customerMappingController');

const router = express.Router();

router.get('/customers', getMappingCustomers);
router.get('/employees', getMappingEmployees);
router.put('/assign', assignCustomers);

module.exports = router;
