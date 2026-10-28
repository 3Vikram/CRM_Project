const Employee = require('../models/Employee');

const isObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));

const resolveCustomerCreator = async (user) => {
  const userId = String(user?.id || '').trim();
  let employee = null;

  if (isObjectId(userId)) {
    employee = await Employee.findById(userId).select('employeeName fullName').lean();
  }

  if (!employee && user?.role === 'admin' && user?.email) {
    employee = await Employee.findOne({ email: String(user.email).trim().toLowerCase() })
      .select('employeeName fullName')
      .lean();
  }

  const createdBy = String(employee?.fullName || employee?.employeeName || user?.name || '').trim();
  if (!createdBy) {
    throw new Error('Authenticated user name is unavailable; customer creator cannot be recorded.');
  }

  return {
    createdBy,
    createdById: employee?._id || null,
  };
};

module.exports = { resolveCustomerCreator };
