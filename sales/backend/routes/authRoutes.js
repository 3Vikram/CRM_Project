const express = require('express');
const { adminLogin, employeeLogin, getCurrentProfile, updateCurrentProfile } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

const router = express.Router();

router.post('/admin-login', adminLogin);
router.post('/employee-login', employeeLogin);
router.get('/me', authMiddleware, getCurrentProfile);
router.put('/me', authMiddleware, upload.single('profilePhoto'), updateCurrentProfile);

module.exports = router;
