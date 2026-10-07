import express from 'express';
import mongoose from 'mongoose';
import { Asset } from '../models/Asset.js';
import { AssetMovement } from '../models/AssetMovement.js';
import { Product } from '../models/Product.js';
import { ReturnedChallan } from '../models/ReturnedChallan.js';
import { ReturnedChallanSequence } from '../models/ReturnedChallanSequence.js';

const router = express.Router();

const normalizeRecord = (record) => ({
  ...record,
  id: record._id.toString(),
  items: record.items || [],
});

const normalizeFields = (body) => ({
  customerName: String(body.customerName || '').trim(),
  contactPerson: String(body.contactPerson || '').trim(),
  rcDate: body.rcDate || null,
  collectingPerson: String(body.collectingPerson || ''),
  collectingName: String(body.collectingName || '').trim(),
  termsOfDelivery: String(body.termsOfDelivery || ''),
  purpose: String(body.purpose || '').trim(),
  remarks: String(body.remarks || '').trim(),
  status: String(body.status || 'Open'),
});

const validateFields = (fields) => {
  if (!fields.customerName) throw new Error('Customer name is required');
  if (!fields.rcDate || Number.isNaN(new Date(fields.rcDate).getTime())) {
    throw new Error('A valid RC date is required');
  }
  if (!['Person', 'Courier'].includes(fields.collectingPerson)) {
    throw new Error('Collecting Person must be Person or Courier');
  }
  if (!fields.collectingName) {
    throw new Error(`${fields.collectingPerson} name is required`);
  }
  if (!['Open', 'Close'].includes(fields.status)) {
    throw new Error('Status must be Open or Close');
  }
};

const parseTaxRate = (label) => {
  const match = String(label || '').match(/(\d+(?:\.\d+)?)\s*%/);
  if (match) return Number(match[1]);
  const legacyRate = Number(String(label || '').trim());
  return Number.isFinite(legacyRate) ? legacyRate : 0;
};

const normalizeItems = async (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one product is required');
  }

  const productIds = [...new Set(items.map((item) => String(item.productId || '')))];
  if (productIds.some((id) => !mongoose.isValidObjectId(id))) {
    throw new Error('Select a valid product for every row');
  }
  const products = await Product.find({ _id: { $in: productIds }, isActive: { $ne: false } }).lean();
  const productById = new Map(products.map((product) => [product._id.toString(), product]));
  if (products.length !== productIds.length) {
    throw new Error('One or more selected products are no longer available');
  }
  const configuredTaxes = new Set(
    (await Product.distinct('gst', { isActive: { $ne: false }, gst: { $exists: true, $ne: '' } }))
      .map((tax) => String(tax).trim())
  );

  return items.map((item) => {
    const productId = String(item.productId || '');
    const product = productById.get(productId);
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const taxLabel = String(item.taxLabel || '').trim();
    if (!product) throw new Error('Select a valid product for every row');
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Product quantity must be greater than 0');
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error('Unit price must be a valid non-negative number');
    }
    if (taxLabel && !configuredTaxes.has(taxLabel)) {
      throw new Error('Select a tax option configured in the Product module');
    }

    return {
      productId,
      productName: String(product.productName || '').trim(),
      description: String(item.description ?? product.description ?? ''),
      hsnSac: String(item.hsnSac ?? product.hsnSac ?? ''),
      quantity,
      uom: String(item.uom || ''),
      serialNumber: String(item.serialNumber || '').trim(),
      unitPrice,
      taxLabel,
      taxRate: parseTaxRate(taxLabel),
    };
  });
};

router.get('/customers', async (_req, res) => {
  try {
    const customerGroups = await Promise.all([
      Asset.aggregate([
        { $match: { customerName: { $exists: true, $ne: '' } } },
        { $group: { _id: '$customerName', contacts: { $addToSet: '$contactPerson' } } },
      ]),
      AssetMovement.aggregate([
        { $match: { customerName: { $exists: true, $ne: '' } } },
        { $group: { _id: '$customerName', contacts: { $addToSet: '$contactPerson' } } },
      ]),
    ]);
    const byName = new Map();
    for (const group of customerGroups.flat()) {
      const name = String(group._id || '').trim();
      if (!name) continue;
      const contacts = (group.contacts || [])
        .map((contact) => String(contact || '').trim())
        .filter((contact) => contact && contact !== name);
      byName.set(name, [...new Set([...(byName.get(name) || []), ...contacts])]);
    }
    const data = [...byName.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, contactPersons]) => ({ id: name, name, contactPersons }));
    return res.json(data);
  } catch (error) {
    console.error('Error fetching returned challan customers:', error);
    return res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

router.get('/', async (_req, res) => {
  try {
    const records = await ReturnedChallan.find().sort({ rcDate: -1, createdAt: -1 }).lean();
    return res.json(records.map(normalizeRecord));
  } catch (error) {
    console.error('Error fetching returned challans:', error);
    return res.status(500).json({ error: 'Failed to fetch returned challans' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid returned challan ID' });
    }
    const record = await ReturnedChallan.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ error: 'Returned challan not found' });
    return res.json(normalizeRecord(record));
  } catch (error) {
    console.error('Error fetching returned challan:', error);
    return res.status(500).json({ error: 'Failed to fetch returned challan' });
  }
});

router.post('/', async (req, res) => {
  try {
    const fields = normalizeFields(req.body || {});
    validateFields(fields);
    const items = await normalizeItems(req.body?.items);
    const year = new Date(fields.rcDate).getFullYear();
    const sequence = await ReturnedChallanSequence.findByIdAndUpdate(
      `returned-challan-${year}`,
      { $inc: { value: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    const rcNumber = `RC-${year}-${String(sequence.value).padStart(6, '0')}`;
    const record = await ReturnedChallan.create({ ...fields, items, rcNumber });
    return res.status(201).json(normalizeRecord(record.toObject()));
  } catch (error) {
    console.error('Error creating returned challan:', error);
    return res.status(400).json({ error: error.message || 'Failed to create returned challan' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid returned challan ID' });
    }
    const fields = normalizeFields(req.body || {});
    validateFields(fields);
    const items = await normalizeItems(req.body?.items);
    const record = await ReturnedChallan.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Returned challan not found' });
    record.set({ ...fields, items });
    await record.save();
    return res.json(normalizeRecord(record.toObject()));
  } catch (error) {
    console.error('Error updating returned challan:', error);
    return res.status(400).json({ error: error.message || 'Failed to update returned challan' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid returned challan ID' });
    }
    const record = await ReturnedChallan.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ error: 'Returned challan not found' });
    return res.json({ message: 'Returned challan deleted successfully' });
  } catch (error) {
    console.error('Error deleting returned challan:', error);
    return res.status(500).json({ error: 'Failed to delete returned challan' });
  }
});

export default router;
