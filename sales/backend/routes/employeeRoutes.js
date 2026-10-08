const express = require('express');
const { requirePermission } = require('../middleware/authMiddleware');
const router = express.Router();
const {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} = require('../controllers/employeeController');

router.get('/', requirePermission('employees', 'view'), getEmployees);
router.get('/:id', requirePermission('employees', 'view'), getEmployeeById);
router.post('/', requirePermission('employees', 'create'), createEmployee);
router.put('/:id', requirePermission('employees', 'edit'), updateEmployee);
router.delete('/:id', requirePermission('employees', 'delete'), deleteEmployee);

module.exports = router;
