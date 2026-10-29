import express from 'express';
import { DeliveryChallan } from '../models/DeliveryChallan.js';

const router = express.Router();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  customerId: String(body.customerId || '').trim(),
  customer: {
    name: String(body.customer?.name || '').trim(),
    addressLine1: String(body.customer?.addressLine1 || '').trim(),
    area: String(body.customer?.area || '').trim(),
    city: String(body.customer?.city || '').trim(),
    state: String(body.customer?.state || '').trim(),
    pincode: String(body.customer?.pincode || '').trim(),
    country: String(body.customer?.country || '').trim(),
    gstNumber: String(body.customer?.gstNumber || '').trim(),
    email: String(body.customer?.email || '').trim(),
    shipToSameAsBilling: body.customer?.shipToSameAsBilling !== false,
    shipToAddress: {
      addressLine1: String(body.customer?.shipToAddress?.addressLine1 || '').trim(),
      area: String(body.customer?.shipToAddress?.area || '').trim(),
      city: String(body.customer?.shipToAddress?.city || '').trim(),
      state: String(body.customer?.shipToAddress?.state || '').trim(),
      pincode: String(body.customer?.shipToAddress?.pincode || '').trim(),
      country: String(body.customer?.shipToAddress?.country || '').trim(),
    },
  },
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

router.get('/customers', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const page = Number(req.query.page ?? 0);
    const requestedPageSize = Number(req.query.pageSize ?? 50);
    if (!Number.isInteger(page) || page < 0 || !Number.isInteger(requestedPageSize) || requestedPageSize < 1) {
      return res.status(400).json({ error: 'Invalid pagination parameters' });
    }
    const pageSize = Math.min(requestedPageSize, 100);
    const match = { customerName: { $type: 'string', $ne: '' } };
    if (search) {
      match.customerName.$regex = escapeRegex(search);
      match.customerName.$options = 'i';
    }

    const [result] = await DeliveryChallan.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $toLower: { $trim: { input: '$customerName' } } },
          name: { $first: { $trim: { input: '$customerName' } } },
        },
      },
      { $match: { _id: { $ne: '' } } },
      {
        $facet: {
          options: [
            { $sort: { _id: 1 } },
            { $skip: page * pageSize },
            { $limit: pageSize },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    res.json({
      options: result.options.map(({ name }) => name),
      total: result.total[0]?.count || 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Error fetching delivery challan customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {};
    const customerName = String(req.query.customerName || '').trim();
    const status = String(req.query.status || '').trim();
    if (customerName) filters.customerName = { $regex: escapeRegex(customerName), $options: 'i' };
    if (status) filters.status = status;

    const challans = await DeliveryChallan.find(filters).sort({ createdAt: -1 }).limit(25).lean();
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
