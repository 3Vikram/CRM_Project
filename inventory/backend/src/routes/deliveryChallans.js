import express from 'express';
import { Asset } from '../models/Asset.js';
import { AssetMovement } from '../models/AssetMovement.js';
import { DeliveryChallan } from '../models/DeliveryChallan.js';

const router = express.Router();

const getNextChallanNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `DC-${year}-`;

  const lastChallan = await DeliveryChallan.findOne({
    challanNumber: { $regex: `^DC-${year}-\\d{4}$` },
  }).sort({ challanNumber: -1 }).lean();

  if (!lastChallan?.challanNumber) {
    return `${prefix}0001`;
  }

  const match = lastChallan.challanNumber.match(/^DC-(\d{4})-(\d{4})$/);
  if (!match) {
    return `${prefix}0001`;
  }

  const nextSerial = Number(match[2]) + 1;
  return `DC-${year}-${String(nextSerial).padStart(4, '0')}`;
};

const normalizeItems = (items) => {
  const normalizedItems = Array.isArray(items) ? items : [];
  if (!normalizedItems.length) {
    throw new Error('At least one product is required');
  }

  return normalizedItems.map((item) => {
    const productName = String(item.productName || '').trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice || 0);
    const tax = Number(item.tax || 0);

    if (!productName) throw new Error('Each row must include a product');
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Each product quantity must be greater than 0');
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error('Product unit price must be a valid non-negative number');
    }
    if (!Number.isFinite(tax) || tax < 0) {
      throw new Error('Product tax must be a valid non-negative number');
    }

    return {
      productId: String(item.productId || ''),
      productName,
      description: String(item.description || '').trim(),
      hsnSac: String(item.hsnSac || '').trim(),
      quantity,
      uom: String(item.uom || '').trim(),
      unitPrice,
      tax,
      lineTotal: Number((quantity * unitPrice * (1 + tax / 100)).toFixed(2)),
    };
  });
};

const normalizeChallanFields = (body) => ({
  customerName: String(body.customerName || '').trim(),
  contactPerson: String(body.contactPerson || '').trim(),
  opfNo: String(body.opfNo || '').trim(),
  accountManager: String(body.accountManager || '').trim(),
  poNo: String(body.poNo || '').trim(),
  poDate: body.poDate || null,
  despatchDocumentNo: String(body.despatchDocumentNo || '').trim(),
  dcType: String(body.dcType || '').trim(),
  validityInDays: body.validityInDays === '' || body.validityInDays == null
    ? null
    : Number(body.validityInDays),
  deliveryInDays: body.deliveryInDays === '' || body.deliveryInDays == null
    ? null
    : Number(body.deliveryInDays),
  expectedClosure: body.expectedClosure || null,
  currency: String(body.currency || '').trim(),
  dispatchedThrough: String(body.dispatchedThrough || '').trim(),
  destination: String(body.destination || '').trim(),
  returnDate: body.returnDate || null,
  deliveryNote: String(body.deliveryNote || ''),
  status: String(body.status || 'Open').trim() || 'Open',
});

const validateChallanFields = (fields) => {
  if (!fields.customerName) throw new Error('Customer name is required');
  for (const field of ['validityInDays', 'deliveryInDays']) {
    if (fields[field] !== null && (!Number.isFinite(fields[field]) || fields[field] < 0)) {
      throw new Error(`${field === 'validityInDays' ? 'Validity' : 'Delivery'} must be a non-negative number`);
    }
  }
  for (const field of ['poDate', 'expectedClosure', 'returnDate']) {
    if (fields[field] && Number.isNaN(new Date(fields[field]).getTime())) {
      throw new Error(`${field} must be a valid date`);
    }
  }
};

router.get('/customers', async (_req, res) => {
  try {
    const [assetCustomers, movementCustomers] = await Promise.all([
      Asset.distinct('customerName', { customerName: { $exists: true, $ne: '' } }),
      AssetMovement.distinct('customerName', { customerName: { $exists: true, $ne: '' } }),
    ]);

    const customerNames = [...new Set([...assetCustomers, ...movementCustomers].filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );

    const data = customerNames.map((name) => ({
      id: name,
      name,
      contact: name,
    }));

    res.json(data);
  } catch (error) {
    console.error('Error fetching delivery challan customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

router.get('/', async (_req, res) => {
  try {
    const challans = await DeliveryChallan.find().sort({ createdAt: -1 }).limit(25).lean();
    res.json(challans.map((challan) => ({
      ...challan,
      id: challan._id.toString(),
      items: challan.items || [],
    })));
  } catch (error) {
    console.error('Error fetching delivery challans:', error);
    res.status(500).json({ error: 'Failed to fetch delivery challans' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid delivery challan ID' });
    }
    const challan = await DeliveryChallan.findById(req.params.id).lean();
    if (!challan) return res.status(404).json({ error: 'Delivery challan not found' });
    return res.json({
      ...challan,
      id: challan._id.toString(),
      items: challan.items || [],
    });
  } catch (error) {
    console.error('Error fetching delivery challan:', error);
    return res.status(500).json({ error: 'Failed to fetch delivery challan' });
  }
});

router.post('/', async (req, res) => {
  try {
    const fields = normalizeChallanFields(req.body || {});
    validateChallanFields(fields);
    const validatedItems = normalizeItems(req.body?.items);

    const challanNumber = await getNextChallanNumber();

    const challan = await DeliveryChallan.create({
      challanNumber,
      ...fields,
      items: validatedItems,
    });

    res.status(201).json({
      ...challan.toObject(),
      id: challan._id.toString(),
    });
  } catch (error) {
    console.error('Error creating delivery challan:', error);
    res.status(400).json({
      error: error.message || 'Failed to create delivery challan',
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid delivery challan ID' });
    }
    const fields = normalizeChallanFields(req.body || {});
    validateChallanFields(fields);
    const items = normalizeItems(req.body?.items);
    const challan = await DeliveryChallan.findById(req.params.id);
    if (!challan) return res.status(404).json({ error: 'Delivery challan not found' });

    challan.set({ ...fields, items });
    await challan.save();
    return res.json({
      ...challan.toObject(),
      id: challan._id.toString(),
    });
  } catch (error) {
    console.error('Error updating delivery challan:', error);
    return res.status(400).json({
      error: error.message || 'Failed to update delivery challan',
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid delivery challan ID' });
    }

    const challan = await DeliveryChallan.findByIdAndDelete(req.params.id);
    if (!challan) return res.status(404).json({ error: 'Delivery challan not found' });
    return res.json({ message: 'Delivery challan deleted successfully' });
  } catch (error) {
    console.error('Error deleting delivery challan:', error);
    return res.status(500).json({ error: 'Failed to delete delivery challan' });
  }
});

export default router;
