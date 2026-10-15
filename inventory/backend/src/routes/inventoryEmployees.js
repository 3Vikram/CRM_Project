import express from 'express';
import { InventoryEmployee } from '../models/InventoryEmployee.js';
import { hashInventoryPassword } from '../utils/inventoryEmployeePassword.js';
import { requireInventoryAdmin } from './inventoryAuth.js';

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toPublicEmployee = (employee) => ({
  _id: employee._id,
  employeeName: employee.employeeName,
  email: employee.email,
  isActive: employee.isActive,
  createdAt: employee.createdAt,
  updatedAt: employee.updatedAt,
});

router.use(requireInventoryAdmin);

router.get('/', async (_req, res) => {
  try {
    const employees = await InventoryEmployee.find().sort({ employeeName: 1 });
    return res.json({ data: employees.map(toPublicEmployee) });
  } catch {
    return res.status(500).json({ error: 'Unable to load Inventory employees.' });
  }
});

router.post('/', async (req, res) => {
  const employeeName = typeof req.body?.employeeName === 'string' ? req.body.employeeName.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!employeeName || employeeName.length > 120 || !emailPattern.test(email) || email.length > 254 || password.length < 8) {
    return res.status(400).json({ error: 'Enter a name, valid email, and password of at least 8 characters.' });
  }

  try {
    const employee = await InventoryEmployee.create({
      employeeName,
      email,
      passwordHash: await hashInventoryPassword(password),
    });
    return res.status(201).json({ data: toPublicEmployee(employee) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'An Inventory employee already uses this email.' });
    return res.status(500).json({ error: 'Unable to create Inventory employee.' });
  }
});

router.put('/:id', async (req, res) => {
  const updates = {};
  if (Object.hasOwn(req.body || {}, 'employeeName')) {
    const employeeName = typeof req.body.employeeName === 'string' ? req.body.employeeName.trim() : '';
    if (!employeeName || employeeName.length > 120) return res.status(400).json({ error: 'Enter a valid employee name.' });
    updates.employeeName = employeeName;
  }
  if (Object.hasOwn(req.body || {}, 'email')) {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!emailPattern.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' });
    updates.email = email;
  }
  if (typeof req.body?.password === 'string' && req.body.password.length > 0) {
    if (req.body.password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    updates.passwordHash = await hashInventoryPassword(req.body.password);
  }

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No employee changes were provided.' });

  try {
    const employee = await InventoryEmployee.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!employee) return res.status(404).json({ error: 'Inventory employee not found.' });
    return res.json({ data: toPublicEmployee(employee) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'An Inventory employee already uses this email.' });
    if (error?.name === 'CastError' || error?.name === 'ValidationError') return res.status(400).json({ error: 'Invalid employee details.' });
    return res.status(500).json({ error: 'Unable to update Inventory employee.' });
  }
});

router.patch('/:id/deactivate', async (req, res) => {
  try {
    const employee = await InventoryEmployee.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!employee) return res.status(404).json({ error: 'Inventory employee not found.' });
    return res.json({ data: toPublicEmployee(employee) });
  } catch (error) {
    if (error?.name === 'CastError') return res.status(400).json({ error: 'Invalid employee id.' });
    return res.status(500).json({ error: 'Unable to deactivate Inventory employee.' });
  }
});

export default router;