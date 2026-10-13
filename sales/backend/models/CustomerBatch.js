const { db } = require('../utils/salesDatabase');

const batchContacts = db.prepare(`
  SELECT contact_id
  FROM customer_batch_contacts
  WHERE batch_id = ?
  ORDER BY position, contact_id
`);

const rowToBatch = (row) => {
  if (!row) return null;
  return {
    _id: String(row.id),
    employeeId: row.employee_id || '',
    employeeEmail: row.employee_email || '',
    employeeName: row.employee_name || '',
    batchName: row.batch_name || '',
    batchNumber: Number(row.batch_number),
    customerCount: Number(row.customer_count) || 0,
    customers: batchContacts.all(row.id).map(({ contact_id: contactId }) => contactId),
    fileName: row.file_name || '',
    createdDate: row.created_date || row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const findById = (id) => rowToBatch(
  db.prepare('SELECT * FROM customer_batches WHERE id = ?').get(String(id)),
);

const findByEmployeeAndNumber = (employeeId, batchNumber) => rowToBatch(
  db.prepare(`
    SELECT * FROM customer_batches
    WHERE employee_id = ? AND batch_number = ?
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT 1
  `).get(String(employeeId), Number(batchNumber)),
);

const findAll = () => db.prepare(`
  SELECT * FROM customer_batches
  ORDER BY employee_id COLLATE NOCASE, batch_number, datetime(created_at), id
`).all().map(rowToBatch);

module.exports = {
  findById,
  findByEmployeeAndNumber,
  findAll,
  findForEmployee: (employeeId) => db.prepare(`
    SELECT * FROM customer_batches
    WHERE employee_id = ?
    ORDER BY batch_number
  `).all(String(employeeId)).map(rowToBatch),
};
