import express from 'express';
import { Accessory, ACCESSORY_TYPES, ACCESSORY_STATUS } from '../models/Accessory.js';
import { AccessoryMovement } from '../models/AccessoryMovement.js';

const router = express.Router();

const normalizeAccessory = (item) => ({
  ...item.toObject(),
  id: item._id.toString(),
});

const normalizeMovement = (item) => ({
  ...item.toObject(),
  id: item._id.toString(),
});

const buildHistoryPayload = ({ accessory, action, date, startDate, quantity, price = 0, relatedAssetSerialNumber = '', person = '', remarks = '' }) => ({
  accessory: accessory._id,
  accessoryType: accessory.accessoryType,
  action,
  date: date ? new Date(date) : new Date(),
  startDate: startDate ? new Date(startDate) : null,
  quantity: Number(quantity || 0),
  price: Number(price || 0),
  relatedAssetSerialNumber: String(relatedAssetSerialNumber || '').trim(),
  person: String(person || '').trim(),
  remarks: String(remarks || '').trim(),
});

const syncAccessoryStatus = async (accessory, action, { startDate, returnedDate, movementDate, relatedAssetSerialNumber } = {}) => {
  if (!accessory) return;

  if (action === 'Purchased' || action === 'Adjusted') {
    accessory.status = accessory.status || 'In Stock';
  } else if (action === 'Issued') {
    accessory.status = 'Issued';
    if (String(relatedAssetSerialNumber || '').trim()) {
      accessory.serialNumber = String(relatedAssetSerialNumber).trim();
    }
    accessory.returnedDate = null;
  } else if (action === 'Returned') {
    accessory.status = 'In Stock';
    accessory.returnedDate = returnedDate ? new Date(returnedDate) : (movementDate ? new Date(movementDate) : new Date());
  } else if (action === 'Sold') {
    accessory.status = 'Sold';
  }

  await accessory.save();
};

router.get('/', async (req, res) => {
  try {
    await Accessory.updateMany({ status: 'Returned' }, { $set: { status: 'In Stock' } });

    const { search = '', type = '', status = '' } = req.query;
    const filters = {};
    const text = String(search || '').trim();

    if (type) {
      filters.accessoryType = type;
    }

    if (status) {
      filters.status = status;
    }

    if (text) {
      filters.$or = [
        { accessoryType: { $regex: text, $options: 'i' } },
        { brand: { $regex: text, $options: 'i' } },
        { model: { $regex: text, $options: 'i' } },
        { serialNumber: { $regex: text, $options: 'i' } },
      ];
    }

    const accessories = await Accessory.find(filters).sort({ accessoryType: 1, createdAt: -1 });
    const accessoryIds = accessories.map((item) => item._id);
    const issuedMovements = await AccessoryMovement.find({ accessory: { $in: accessoryIds }, action: 'Issued' })
      .sort({ date: -1, createdAt: -1 })
      .lean();
    const latestStartDates = new Map();

    issuedMovements.forEach((movement) => {
      const accessoryId = String(movement.accessory);
      if (!latestStartDates.has(accessoryId)) {
        latestStartDates.set(accessoryId, movement.startDate || null);
      }
    });

    res.json(accessories.map((item) => ({
      ...normalizeAccessory(item),
      startDate: latestStartDates.get(String(item._id)) || null,
    })));
  } catch (error) {
    console.error('Error fetching accessories:', error);
    res.status(500).json({ error: 'Failed to fetch accessories' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { accessoryId, accessoryType } = req.query;
    const filters = {};

    if (accessoryId) {
      filters.accessory = accessoryId;
    }

    if (accessoryType) {
      filters.accessoryType = accessoryType;
    }

    const history = await AccessoryMovement.find(filters)
      .populate('accessory')
      .sort({ date: -1, createdAt: -1 });

    res.json(history.map(normalizeMovement));
  } catch (error) {
    console.error('Error fetching accessory history:', error);
    res.status(500).json({ error: 'Failed to fetch accessory history' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const accessory = await Accessory.findById(req.params.id);
    if (!accessory) {
      return res.status(404).json({ error: 'Accessory not found' });
    }

    res.json(normalizeAccessory(accessory));
  } catch (error) {
    console.error('Error fetching accessory by id:', error);
    res.status(500).json({ error: 'Failed to fetch accessory' });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const history = await AccessoryMovement.find({ accessory: req.params.id })
      .populate('accessory')
      .sort({ date: -1, createdAt: -1 });

    res.json(history.map(normalizeMovement));
  } catch (error) {
    console.error('Error fetching accessory movement history:', error);
    res.status(500).json({ error: 'Failed to fetch accessory history' });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const accessoryType = String(body.accessoryType || '').trim();
    const quantity = Number(body.quantity);

    if (!ACCESSORY_TYPES.includes(accessoryType)) {
      return res.status(400).json({ error: 'Accessory type is required and must be valid' });
    }

    if (!Number.isFinite(quantity) || quantity < 0) {
      return res.status(400).json({ error: 'Quantity is required and must be a valid number' });
    }

    const status = ACCESSORY_STATUS.includes(body.status) ? body.status : 'In Stock';

    const accessory = await Accessory.create({
      accessoryType,
      brand: String(body.brand || '').trim(),
      model: String(body.model || '').trim(),
      serialNumber: String(body.serialNumber || '').trim(),
      quantity,
      purchasePrice: Number(body.purchasePrice || 0),
      vendorName: String(body.vendorName || '').trim(),
      purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
      warrantyExpiry: body.warrantyExpiry ? new Date(body.warrantyExpiry) : null,
      status,
    });

    const purchaseRemarks = String(body.vendorName || '').trim()
      ? `Purchased from ${String(body.vendorName).trim()}`
      : 'Purchased';

    await AccessoryMovement.create(
      buildHistoryPayload({
        accessory,
        action: 'Purchased',
        date: body.purchaseDate || new Date(),
        quantity: accessory.quantity,
        remarks: purchaseRemarks,
      })
    );

    res.status(201).json(normalizeAccessory(accessory));
  } catch (error) {
    console.error('Error creating accessory:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((item) => item.message);
      return res.status(400).json({ error: messages.join(', ') || 'Validation failed' });
    }
    res.status(500).json({ error: 'Failed to create accessory' });
  }
});

router.post('/history', async (req, res) => {
  try {
    const body = req.body || {};
    const { accessoryId, action, date, startDate, returnedDate, quantity, price, relatedAssetSerialNumber, person, remarks } = body;

    if (!accessoryId) {
      return res.status(400).json({ error: 'Accessory ID is required' });
    }

    if (!action || !['Purchased', 'Issued', 'Returned', 'Sold', 'Adjusted'].includes(action)) {
      return res.status(400).json({ error: 'Valid action is required' });
    }

    if (action === 'Issued' && !String(relatedAssetSerialNumber || '').trim()) {
      return res.status(400).json({ error: 'Serial Number is required.' });
    }

    const accessory = await Accessory.findById(accessoryId);
    if (!accessory) {
      return res.status(404).json({ error: 'Accessory not found' });
    }

    const movement = await AccessoryMovement.create(
      buildHistoryPayload({
        accessory,
        action,
        date,
        startDate,
        quantity,
        price,
        relatedAssetSerialNumber,
        person,
        remarks,
      })
    );

    await syncAccessoryStatus(accessory, action, { startDate, returnedDate, movementDate: date, relatedAssetSerialNumber });

    res.status(201).json(normalizeMovement(movement));
  } catch (error) {
    console.error('Error creating accessory history:', error);
    res.status(500).json({ error: 'Failed to create accessory history' });
  }
});

router.post('/:id/history', async (req, res) => {
  try {
    const accessory = await Accessory.findById(req.params.id);
    if (!accessory) {
      return res.status(404).json({ error: 'Accessory not found' });
    }

    const body = req.body || {};
    const { action, date, startDate, returnedDate, quantity, price, relatedAssetSerialNumber, person, remarks } = body;

    if (!action || !['Purchased', 'Issued', 'Returned', 'Sold', 'Adjusted'].includes(action)) {
      return res.status(400).json({ error: 'Valid action is required' });
    }

    if (action === 'Issued' && !String(relatedAssetSerialNumber || '').trim()) {
      return res.status(400).json({ error: 'Serial Number is required.' });
    }

    const movement = await AccessoryMovement.create(
      buildHistoryPayload({
        accessory,
        action,
        date,
        startDate,
        quantity,
        price,
        relatedAssetSerialNumber,
        person,
        remarks,
      })
    );

    await syncAccessoryStatus(accessory, action, { startDate, returnedDate, movementDate: date, relatedAssetSerialNumber });

    res.status(201).json(normalizeMovement(movement));
  } catch (error) {
    console.error('Error saving accessory history:', error);
    res.status(500).json({ error: 'Failed to save accessory history' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const accessory = await Accessory.findById(req.params.id);
    if (!accessory) {
      return res.status(404).json({ error: 'Accessory not found' });
    }

    const body = req.body || {};
    const previousStatus = accessory.status;
    const previousQuantity = accessory.quantity;

    if (body.accessoryType && !ACCESSORY_TYPES.includes(String(body.accessoryType).trim())) {
      return res.status(400).json({ error: 'Accessory type is invalid' });
    }

    if (body.status && !ACCESSORY_STATUS.includes(body.status)) {
      return res.status(400).json({ error: 'Status is invalid' });
    }

    const nextQuantity = body.quantity === undefined ? accessory.quantity : Number(body.quantity);
    if (!Number.isFinite(nextQuantity) || nextQuantity < 0) {
      return res.status(400).json({ error: 'Quantity must be a valid number greater than or equal to zero' });
    }

    accessory.accessoryType = body.accessoryType ? String(body.accessoryType).trim() : accessory.accessoryType;
    accessory.brand = body.brand !== undefined ? String(body.brand || '').trim() : accessory.brand;
    accessory.model = body.model !== undefined ? String(body.model || '').trim() : accessory.model;
    accessory.serialNumber = body.serialNumber !== undefined ? String(body.serialNumber || '').trim() : accessory.serialNumber;
    accessory.quantity = nextQuantity;
    accessory.purchasePrice = body.purchasePrice !== undefined ? Number(body.purchasePrice || 0) : accessory.purchasePrice;
    accessory.vendorName = body.vendorName !== undefined ? String(body.vendorName || '').trim() : accessory.vendorName;
    accessory.purchaseDate = body.purchaseDate !== undefined ? (body.purchaseDate ? new Date(body.purchaseDate) : null) : accessory.purchaseDate;
    accessory.returnedDate = body.returnedDate !== undefined ? (body.returnedDate ? new Date(body.returnedDate) : null) : accessory.returnedDate;
    accessory.warrantyExpiry = body.warrantyExpiry !== undefined ? (body.warrantyExpiry ? new Date(body.warrantyExpiry) : null) : accessory.warrantyExpiry;
    accessory.status = body.status ? body.status : accessory.status;

    await accessory.save();

    if (body.status && body.status !== previousStatus) {
      await AccessoryMovement.create(
        buildHistoryPayload({
          accessory,
          action: body.status,
          date: new Date(),
          quantity: accessory.quantity,
          remarks: `Status changed to ${body.status}`,
        })
      );
    } else if (body.quantity !== undefined && Number(body.quantity) !== previousQuantity) {
      await AccessoryMovement.create(
        buildHistoryPayload({
          accessory,
          action: 'Adjusted',
          date: new Date(),
          quantity: accessory.quantity,
          remarks: 'Quantity adjusted',
        })
      );
    }

    res.json(normalizeAccessory(accessory));
  } catch (error) {
    console.error('Error updating accessory:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((item) => item.message);
      return res.status(400).json({ error: messages.join(', ') || 'Validation failed' });
    }
    res.status(500).json({ error: 'Failed to update accessory' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const accessory = await Accessory.findById(req.params.id);
    if (!accessory) {
      return res.status(404).json({ error: 'Accessory not found' });
    }

    await AccessoryMovement.deleteMany({ accessory: accessory._id });
    await accessory.deleteOne();

    res.json({ success: true, id: req.params.id });
  } catch (error) {
    console.error('Error deleting accessory:', error);
    res.status(500).json({ error: 'Failed to delete accessory' });
  }
});

export default router;
