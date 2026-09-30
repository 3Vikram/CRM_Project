const express = require('express');
const router = express.Router();
const {
  getContacts,
  getContactById,
  moveContactToCustomer,
  createContact,
  importContacts,
  importUpload,
  updateContact,
  deleteContact,
} = require('../controllers/contactController');

router.get('/', getContacts);
router.get('/:id', getContactById);
router.post('/:id/move-to-customer', moveContactToCustomer);
router.post('/import', importUpload.single('file'), importContacts);
router.post('/', createContact);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

module.exports = router;
