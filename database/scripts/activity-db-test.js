
const { db, dbPath } = require('../../sales/backend/utils/salesDatabase');

console.log('SQLite Activity table is ready.');
console.log('Database:', dbPath);

db.close();
