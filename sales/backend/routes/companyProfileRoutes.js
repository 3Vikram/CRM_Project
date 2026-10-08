const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
  getCompanyProfiles,
  getCompanyProfileById,
  createCompanyProfile,
  updateCompanyProfile,
  deleteCompanyProfile,
} = require('../controllers/companyProfileController');

const fileFields = upload.fields([
  { name: 'companyLogo', maxCount: 1 },
  { name: 'documentLogo', maxCount: 1 },
  { name: 'documentHeader', maxCount: 1 },
  { name: 'documentFooter', maxCount: 1 },
]);

router.get('/', getCompanyProfiles);
router.get('/:id', getCompanyProfileById);
router.post('/', fileFields, createCompanyProfile);
router.put('/:id', fileFields, updateCompanyProfile);
router.delete('/:id', deleteCompanyProfile);

module.exports = router;
