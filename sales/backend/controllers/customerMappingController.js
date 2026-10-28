const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Employee = require('../models/Employee');
const { escapeRegex } = require('../utils/queryUtils');

exports.getMappingCustomers = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const assignment = String(req.query.assignment || 'all').trim().toLowerCase();
    const employeeId = String(req.query.employeeId || '').trim();
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 100);
    const filters = [];

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), 'i');
      filters.push({
        $or: [
          { companyName: searchRegex },
          { customerName: searchRegex },
          { customerId: searchRegex },
        ],
      });
    }
    if (assignment === 'assigned') filters.push({ 'assignedEmployees.0': { $exists: true } });
    if (assignment === 'unassigned') {
      filters.push({
        $or: [
          { assignedEmployees: { $size: 0 } },
          { assignedEmployees: { $exists: false } },
        ],
      });
    }
    if (employeeId) filters.push({ 'assignedEmployees.employeeId': employeeId });
    const query = filters.length ? { $and: filters } : {};

    const skip = (page - 1) * limit;
    const [customers, total] = await Promise.all([
      Customer.find(query)
        .select('_id customerId companyName customerName accountType status createdBy assignedEmployees')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: customers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMappingEmployees = async (_req, res) => {
  try {
    const employees = await Employee.find({ status: 'Active' })
      .select('employeeName fullName email employeeType')
      .sort({ employeeName: 1, fullName: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: employees.map((employee) => ({
        id: String(employee._id),
        name: employee.employeeName || employee.fullName,
        email: employee.email,
        employeeType: employee.employeeType || '',
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.assignCustomers = async (req, res) => {
  try {
    const { customerIds, employeeIds } = req.body || {};
    if (
      !Array.isArray(customerIds)
      || customerIds.length === 0
      || customerIds.length > 500
      || customerIds.some((id) => !mongoose.isValidObjectId(id))
    ) {
      return res.status(400).json({ success: false, message: 'Customer IDs must be a non-empty array of at most 500 valid IDs.' });
    }
    if (!Array.isArray(employeeIds)) {
      return res.status(400).json({ success: false, message: 'Employee IDs must be an array.' });
    }

    const validEmployeeIds = employeeIds.filter((id) => mongoose.isValidObjectId(id));
    const employees = await Employee.find({ _id: { $in: validEmployeeIds } })
      .select('_id employeeName fullName')
      .lean();
    if (employees.length !== employeeIds.length) {
      return res.status(400).json({ success: false, message: 'One or more employees were not found.' });
    }

    const result = await Customer.updateMany(
      { _id: { $in: customerIds } },
      {
        $set: {
          assignedEmployees: employees.map((employee) => ({
            employeeId: String(employee._id),
            employeeName: employee.employeeName || employee.fullName,
          })),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Assignment saved.',
      data: { updated: result.modifiedCount ?? result.nModified },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
