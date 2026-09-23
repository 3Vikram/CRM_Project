const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');

const JWT_SECRET = process.env.JWT_SECRET || 'synov-crm-secret-key-change-me';
const DEFAULT_SESSION_TTL = '7d';
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || 'admin@synov.in').trim().toLowerCase();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2b$10$ELsMJoMB1toHUyneHX9ys.ZfKo7f9dXucBIYCBpfJeiSxbUz0d5jm';

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

const buildSessionPayload = (employee, role) => ({
  id: String(employee._id),
  email: employee.email,
  name: employee.employeeName || employee.fullName || employee.email,
  role,
});

const createToken = (employee, role) => jwt.sign(buildSessionPayload(employee, role), JWT_SECRET, {
  expiresIn: DEFAULT_SESSION_TTL,
});

const respondInvalidLogin = (res) => res.status(401).json({
  success: false,
  message: 'Invalid email or password.',
});

exports.adminLogin = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email || '');
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    if (email !== ADMIN_EMAIL) {
      return respondInvalidLogin(res);
    }

    const isPasswordValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    if (!isPasswordValid) {
      return respondInvalidLogin(res);
    }

    const adminUser = {
      _id: 'admin',
      email: ADMIN_EMAIL,
      employeeName: 'Administrator',
      fullName: 'Administrator',
      role: 'Administrator',
      status: 'Active',
    };

    const token = createToken(adminUser, 'admin');

    return res.status(200).json({
      success: true,
      user: {
        id: 'admin',
        name: 'Administrator',
        email: ADMIN_EMAIL,
        role: 'admin',
      },
      token,
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ success: false, message: 'Unable to log in. Please try again.' });
  }
};
