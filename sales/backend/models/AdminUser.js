const { db } = require('../utils/salesDatabase');

const findByEmail = (email) => db.prepare(`
  SELECT id, email, password_hash AS passwordHash
  FROM admin_users
  WHERE email = ? COLLATE NOCASE
  LIMIT 1
`).get(String(email).trim().toLowerCase()) || null;

module.exports = { findByEmail };
