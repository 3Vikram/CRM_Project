const path = require('node:path');
const { createRequire } = require('node:module');
const requireSales = createRequire(path.resolve(__dirname, '../../sales/backend/package.json'));
requireSales('dotenv').config({ path: path.resolve(__dirname, '../../sales/backend/.env') });
const { db, dbPath } = require('../../sales/backend/utils/salesDatabase');
const bcrypt = requireSales('bcryptjs');

const demoEmail = 'admin@synov.in';
const demoPassword = 'admin123';

const ensureDemoAdmin = async () => {
  const existing = db.prepare('SELECT id, password_hash FROM admin_users WHERE email = ? COLLATE NOCASE').get(demoEmail);
  if (existing && await bcrypt.compare(demoPassword, existing.password_hash)) return;

  const passwordHash = await bcrypt.hash(demoPassword, 12);
  db.prepare(`
    INSERT INTO admin_users (id, email, password_hash)
    VALUES (?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      password_hash = excluded.password_hash,
      updated_at = CURRENT_TIMESTAMP
  `).run(existing?.id || 'admin', demoEmail, passwordHash);
};

ensureDemoAdmin()
  .then(() => {
    console.log('Sales database initialized:', dbPath);
    console.log('Tables:', db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    ).all().map(({ name }) => name).join(', '));
  })
  .catch((error) => {
    console.error('Sales database initialization failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
