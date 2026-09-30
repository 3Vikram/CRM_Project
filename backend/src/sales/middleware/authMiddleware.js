const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'synov-crm-secret-key-change-me';

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (_error) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid.' });
  }
};

module.exports = { authMiddleware, JWT_SECRET };
