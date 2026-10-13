const { randomUUID } = require('crypto');
const { db } = require('../utils/salesDatabase');

const advance = db.transaction((name, minimumValue = 0) => {
  const normalizedName = String(name || '').trim();
  const minimum = Number(minimumValue);
  if (!normalizedName) throw new TypeError('Counter name is required.');
  if (!Number.isSafeInteger(minimum) || minimum < 0) throw new TypeError('Counter minimum value must be a non-negative safe integer.');

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO counters (id, name, value, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      value = MAX(counters.value, excluded.value),
      updated_at = excluded.updated_at
  `).run(randomUUID(), normalizedName, minimum, now, now);
  db.prepare(`
    UPDATE counters SET value = value + 1, updated_at = ? WHERE name = ?
  `).run(now, normalizedName);
  return db.prepare('SELECT value FROM counters WHERE name = ?').get(normalizedName).value;
});

module.exports = {
  next: (name, minimumValue) => advance.immediate(name, minimumValue),
  get: (name) => db.prepare('SELECT name, value, created_at AS createdAt, updated_at AS updatedAt FROM counters WHERE name = ?').get(String(name)),
};
