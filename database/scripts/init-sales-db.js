const { db, dbPath } = require('../../sales/backend/utils/salesDatabase');

console.log('Sales database schema created:', dbPath);
console.log('Tables:', db.prepare(
  "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
).all().map(({ name }) => name).join(', '));

db.close();
