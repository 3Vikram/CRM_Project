const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const Employee = require('../models/Employee');
const AdminUser = require('../models/AdminUser');

const DEFAULT_SESSION_TTL = '7d';

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured.');
  return process.env.JWT_SECRET;
};

const allPermissions = () => {
  const fullAccess = { view: true, create: true, edit: true, delete: true };
  return {
    dashboard: true,
    customers: { ...fullAccess },
    contacts: { ...fullAccess },
    leads: { ...fullAccess },
    activities: { ...fullAccess },
    mailCampaign: { ...fullAccess },
    suppliers: { ...fullAccess },
    quotations: { ...fullAccess },
    opf: { ...fullAccess },
    calendar: { ...fullAccess },
    funnels: { ...fullAccess },
    renewals: { ...fullAccess },
    reports: { ...fullAccess },
    dataAdmin: { ...fullAccess },
    employees: { ...fullAccess },
    companyProfiles: { ...fullAccess },
    inventory: { ...fullAccess },
    purchaseOrders: { ...fullAccess },
    dcTracking: { ...fullAccess },
    billSale: { ...fullAccess },
  };
};

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

const employeeModuleLabels = {
  customers: 'Customer',
  contacts: 'Contact',
  leads: 'Lead',
  activities: 'Activity',
  mailCampaign: 'Mail Campaign',
  suppliers: 'Supplier',
  quotations: 'Quotation',
  opf: 'OPF',
  calendar: 'Calendar',
  funnels: 'Funnel',
  renewals: 'Renewals',
  reports: 'Report',
  dataAdmin: 'Data Admin',
  employees: 'Employees',
  companyProfiles: 'Company Profiles',
  inventory: 'Inventory',
  purchaseOrders: 'Purchase Orders',
  dcTracking: 'DC Tracking',
  billSale: 'Bill Sale',
};

const employeePermissionActions = {
  view: ['view', 'read'],
  create: ['create'],
  edit: ['edit', 'update'],
  delete: ['delete'],
};

const normalizeOption = (value) => String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const getEmployeePermissions = (employee) => {
  const toSelectionSet = (values) => new Set(
    (Array.isArray(values) ? values : values ? [values] : [])
        .map(normalizeOption)
  );
  const selectedModules = toSelectionSet(employee.modulesOption);
  const selectedCrud = toSelectionSet(employee.crudOption);
  const permissions = {
    dashboard: selectedModules.has('dashboard') && (selectedCrud.has('view') || selectedCrud.has('read')),
  };

  Object.entries(employeeModuleLabels).forEach(([moduleName, label]) => {
    const moduleSelected = selectedModules.has(normalizeOption(moduleName))
      || selectedModules.has(normalizeOption(label));
    permissions[moduleName] = Object.fromEntries(
      Object.entries(employeePermissionActions).map(([action, crudLabels]) => [
        action,
        moduleSelected && crudLabels.some((crudLabel) => selectedCrud.has(normalizeOption(crudLabel))),
      ])
    );
  });

  return permissions;
};

const buildSessionPayload = (employee, role) => ({
  id: String(employee._id),
  email: employee.email,
  name: employee.employeeName || employee.fullName || employee.email,
  role,
  permissions: role === 'admin' ? allPermissions() : getEmployeePermissions(employee),
});

const createToken = (employee, role) => jwt.sign(buildSessionPayload(employee, role), getJwtSecret(), {
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

    const adminAccount = AdminUser.findByEmail(email);
    if (!adminAccount) return respondInvalidLogin(res);

    const isPasswordValid = await bcrypt.compare(password, adminAccount.passwordHash);
    if (!isPasswordValid) {
      return respondInvalidLogin(res);
    }

    const adminUser = {
      _id: 'admin',
      email,
      employeeName: 'Admin',
      fullName: 'Admin',
      role: 'Administrator',
      status: 'Active',
    };

    const token = createToken(adminUser, 'admin');

    return res.status(200).json({
      success: true,
      user: {
        id: 'admin',
        name: 'Admin',
        email,
        role: 'admin',
      },
      token,
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ success: false, message: 'Unable to log in. Please try again.' });
  }
};

exports.getCurrentProfile = async (req, res) => {
  try {
    const employee = req.user?.role === 'admin'
      ? Employee.findByEmail(normalizeEmail(req.user.email || ''))
      : Employee.findById(req.user?.id);

    if (employee) {
      return res.status(200).json({
        success: true,
        data: {
          _id: String(employee._id),
          employeeCode: employee.employeeCode || '',
          officialEmployeeId: employee.officialEmployeeId || employee.employeeCode || '',
          employeeName: employee.employeeName || employee.fullName || employee.email,
          fullName: employee.fullName || employee.employeeName || employee.email,
          email: employee.email || '',
          phone: employee.phone || '',
          contactNo: employee.contactNo || employee.phone || '',
          designation: employee.designation || '',
          department: employee.department || '',
          role: employee.role || '',
          status: employee.status || '',
          joiningDate: employee.joiningDate || null,
          dateOfJoin: employee.dateOfJoin || null,
          dateOfBirth: employee.dateOfBirth || null,
          profilePhoto: employee.profilePhoto || '',
          signature: employee.signature || '',
          canUpdate: true,
          employeeType: employee.employeeType || '',
          reportingTo: employee.reportingTo || '',
          orderApprovalTo: employee.orderApprovalTo || '',
          branchCode: employee.branchCode || '',
          address: employee.address || '',
          notes: employee.notes || '',
        },
      });
    }

    if (req.user?.role === 'admin') {
      return res.status(200).json({
        success: true,
        data: {
          _id: String(req.user.id),
          employeeName: req.user.name || 'Admin',
          fullName: req.user.name || 'Admin',
          email: req.user.email || '',
          role: 'Administrator',
          profilePhoto: '',
          signature: '',
          canUpdate: false,
        },
      });
    }

    return res.status(404).json({ success: false, message: 'Employee profile not found.' });
  } catch (error) {
    console.error('Current profile error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load your profile.' });
  }
};

exports.updateCurrentProfile = async (req, res) => {
  let uploadedPhotoPath = req.file?.path;
  try {
    const employee = req.user?.role === 'admin'
      ? Employee.findByEmail(normalizeEmail(req.user.email || ''))
      : Employee.findById(req.user?.id);

    if (!employee) {
      if (uploadedPhotoPath) await fs.promises.unlink(uploadedPhotoPath).catch(() => {});
      return res.status(404).json({ success: false, message: 'No Employee record is linked to this login.' });
    }

    const password = String(req.body?.password || '');
    const confirmPassword = String(req.body?.confirmPassword || '');
    if (password && password !== confirmPassword) {
      if (uploadedPhotoPath) await fs.promises.unlink(uploadedPhotoPath).catch(() => {});
      return res.status(400).json({ success: false, message: 'Password and confirmation do not match.' });
    }

    const contactNo = String(req.body?.contactNo || '').trim();
    const dateOfJoin = String(req.body?.dateOfJoin || '').trim();
    const dateOfBirth = String(req.body?.dateOfBirth || '').trim();
    const changes = {
      contactNo,
      phone: contactNo,
      dateOfJoin: dateOfJoin || null,
      joiningDate: dateOfJoin || null,
      dateOfBirth: dateOfBirth || null,
      signature: String(req.body?.signature || '').trim(),
    };
    const previousPhoto = employee.profilePhoto;
    if (req.file) changes.profilePhoto = `/uploads/${req.file.filename}`;
    if (password) {
      changes.passwordHash = await bcrypt.hash(password, 10);
      changes.passwordSalt = '';
    }

    const updated = Employee.updateById(employee._id, changes);
    if (!updated) throw new Error('Employee record was removed during profile update.');
    uploadedPhotoPath = null;

    if (req.file && previousPhoto?.startsWith('/uploads/')) {
      const previousPath = path.join(__dirname, '..', previousPhoto.replace(/^\/+/, ''));
      if (previousPath !== req.file.path) await fs.promises.unlink(previousPath).catch(() => {});
    }

    return exports.getCurrentProfile(req, res);
  } catch (error) {
    if (uploadedPhotoPath) await fs.promises.unlink(uploadedPhotoPath).catch(() => {});
    console.error('Current profile update error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Unable to update your profile.' });
  }
};

exports.employeeLogin = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email || '');
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const employee = Employee.findByEmailWithPassword(email);
    if (!employee || employee.status !== 'Active' || !employee.passwordHash) {
      return respondInvalidLogin(res);
    }

    const isPasswordValid = await bcrypt.compare(password, employee.passwordHash);
    if (!isPasswordValid) return respondInvalidLogin(res);

    const token = createToken(employee, 'employee');
    return res.status(200).json({
      success: true,
      user: {
        id: String(employee._id),
        name: employee.employeeName || employee.fullName || employee.email,
        email: employee.email,
        role: 'employee',
        permissions: getEmployeePermissions(employee),
      },
      token,
    });
  } catch (error) {
    console.error('Employee login error:', error);
    return res.status(500).json({ success: false, message: 'Unable to log in. Please try again.' });
  }
};

exports.getEmployeePermissions = getEmployeePermissions;
