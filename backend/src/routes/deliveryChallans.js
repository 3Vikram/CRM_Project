import express from 'express';
import { Asset } from '../models/Asset.js';
import { AssetMovement } from '../models/AssetMovement.js';
import { DeliveryChallan } from '../models/DeliveryChallan.js';

const router = express.Router();

const getNextChallanNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `DC-${year}-`;

  const lastChallan = await DeliveryChallan.findOne({
    challanNumber: { $regex: `^DC-${year}-\d{4}$` },
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

router.post('/', async (req, res) => {
  try {
    const {
      customerName,
      contactPerson,
      deliveryNote,
      dispatchedThrough,
      destination,
      status,
      signatureRequired,
      items,
    } = req.body || {};

    if (!customerName || String(customerName).trim() === '') {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const normalizedItems = Array.isArray(items) ? items : [];
    if (!normalizedItems.length) {
      return res.status(400).json({ error: 'At least one product is required' });
    }

    const validatedItems = normalizedItems.map((item) => {
      const productName = String(item.productName || '').trim();
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice || 0);
      const tax = Number(item.tax || 0);

      if (!productName) {
        throw new Error('Each row must include a product');
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error('Each product quantity must be greater than 0');
      }

      const lineTotal = Number(((quantity * unitPrice) * (1 + tax / 100)).toFixed(2));

      return {
        productId: String(item.productId || ''),
        productName,
        description: String(item.description || '').trim(),
        quantity,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
        tax: Number.isFinite(tax) ? tax : 0,
        lineTotal,
      };
    });

    const challanNumber = await getNextChallanNumber();

    const challan = await DeliveryChallan.create({
      challanNumber,
      customerName: String(customerName).trim(),
      contactPerson: String(contactPerson || '').trim(),
      deliveryNote: String(deliveryNote || '').trim(),
      dispatchedThrough: String(dispatchedThrough || '').trim(),
      destination: String(destination || '').trim(),
      status: String(status || 'Pending').trim() || 'Pending',
      signatureRequired: Boolean(signatureRequired),
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

export default router;
