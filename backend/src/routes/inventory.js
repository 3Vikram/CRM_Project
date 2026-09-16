import express from 'express';
import { randomUUID } from 'crypto';
import { Asset } from '../models/Asset.js';
import { AssetMovement } from '../models/AssetMovement.js';

const router = express.Router();

const normalizeName = (value = '') => String(value || '').trim().toLowerCase();
const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const buildNameQuery = (name = '', serial = '') => {
  const predicates = [];
  if (name) {
    predicates.push({ name: { $regex: `^${escapeRegExp(name)}$`, $options: 'i' } });
  }
  if (serial) {
    predicates.push({ serialNumber: { $regex: `^${escapeRegExp(serial)}$`, $options: 'i' } });
  }
  return predicates.length ? { $or: predicates } : {};
};

const statusMap = {
  available: 'available',
  in_stock: 'available',
  IN_STOCK: 'available',
  outwarding: 'available',
  OUTWARDING: 'available',
  rented: 'rented',
  RENTED: 'rented',
  RENT_OUT: 'rented',
  RENTOUT: 'rented',
  sold: 'sold',
  SOLD: 'sold',
  SOLD_OUT: 'sold',
  SOLDOUT: 'sold',
  returned: 'returned',
  RETURNED: 'returned',
  return: 'returned',
  damaged: 'damaged',
  DAMAGED: 'damaged',
  lost: 'lost',
  LOST: 'lost',
};

const normalizeInwardType = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return 'Purchase';
  const normalized = raw.toLowerCase();

  if (['purchase', 'new purchase', 'new_purchase'].includes(normalized)) {
    return 'Purchase';
  }

  if (['in stock', 'in_stock', 'instock'].includes(normalized)) {
    return 'In Stock';
  }

  if (['rent in', 'rent_in', 'rent-in', 'rent out', 'rent_out', 'rent-out'].includes(normalized)) {
    return 'Rent In';
  }

  return raw;
};

const displayStatusMap = {
  available: 'IN_STOCK',
  rented: 'RENTED',
  sold: 'SOLD',
  returned: 'RETURNED',
  damaged: 'DAMAGED',
  lost: 'LOST',
};

const normalizeAssetStatus = (status) => {
  const raw = String(status || '').trim();
  if (!raw) return 'available';
  return statusMap[raw] ?? statusMap[raw.toLowerCase()] ?? raw.toLowerCase();
};

const formatAssetStatus = (status) => {
  const normalized = normalizeAssetStatus(status);
  return displayStatusMap[normalized] ?? normalized.toUpperCase();
};

const buildStatusQuery = (status) => {
  if (!status || typeof status !== 'string') return normalizeAssetStatus(status);
  const normalized = normalizeAssetStatus(status);
  if (status.includes(',')) {
    const values = status.split(',').map((item) => normalizeAssetStatus(item.trim())).filter(Boolean);
    const mapped = values.flatMap((value) => {
      if (value === 'available') return ['available', 'IN_STOCK', 'in_stock'];
      if (value === 'outwarding') return ['outwarding', 'OUTWARDING'];
      if (value === 'rented') return ['rented', 'RENTED'];
      if (value === 'sold') return ['sold', 'SOLD'];
      if (value === 'returned') return ['returned', 'RETURNED'];
      if (value === 'damaged') return ['damaged', 'DAMAGED'];
      if (value === 'lost') return ['lost', 'LOST'];
      return [value];
    });
    return { $in: Array.from(new Set(mapped)) };
  }
  if (normalized === 'available') return { $in: ['available', 'IN_STOCK', 'in_stock', 'outwarding', 'OUTWARDING'] };
  if (normalized === 'rented') return { $in: ['rented', 'RENTED', 'RENT_OUT', 'RENTOUT'] };
  if (normalized === 'sold') return { $in: ['sold', 'SOLD', 'SOLD_OUT', 'SOLDOUT'] };
  if (normalized === 'returned') return { $in: ['returned', 'RETURNED'] };
  if (normalized === 'damaged') return { $in: ['damaged', 'DAMAGED'] };
  if (normalized === 'lost') return { $in: ['lost', 'LOST'] };
  return normalized;
};

const createNextAssetId = async () => {
  const lastAsset = await Asset.findOne({ assetId: { $regex: /^AST-\d+$/ } }).sort({ assetId: -1 }).lean();
  if (!lastAsset?.assetId) return 'AST-0001';

  const match = lastAsset.assetId.match(/^AST-(\d+)$/);
  if (!match) return 'AST-0001';

  const next = Number(match[1]) + 1;
  return `AST-${String(next).padStart(4, '0')}`;
};

const getUniqueAssetId = async () => {
  const candidate = await createNextAssetId();
  const existing = await Asset.findOne({ assetId: candidate });
  if (!existing) return candidate;

  const match = candidate.match(/^AST-(\d+)$/);
  if (!match) throw new Error('Unable to determine the next Asset ID');

  let next = Number(match[1]) + 1;
  while (next < Number.MAX_SAFE_INTEGER) {
    const nextCandidate = `AST-${String(next).padStart(4, '0')}`;
    const existingNext = await Asset.findOne({ assetId: nextCandidate });
    if (!existingNext) return nextCandidate;
    next += 1;
  }

  throw new Error('Unable to determine the next available Asset ID');
};

const ensureAssetId = async (asset) => {
  if (asset.assetId) return asset.assetId;

  let attempts = 0;
  while (attempts < 100) {
    const nextAssetId = await getUniqueAssetId();
    asset.assetId = nextAssetId;

    try {
      await asset.save();
      return asset.assetId;
    } catch (error) {
      if (error?.code === 11000) {
        attempts += 1;
        continue;
      }
      throw error;
    }
  }

  throw new Error('Unable to assign a unique asset ID');
};

const toAssetPayload = (asset) => {
  const productName = asset.productName || asset.name || '';
  const productDescription = asset.productDescription || asset.description || '';
  const productSerialNumber = asset.productSerialNumber || asset.serialNumber || '';
  const warrantyDate = asset.warrantyDate || asset.warrantyExpiry || null;
  const depreciatedPrice = calculateDepreciatedPrice(asset);

  return {
    id: asset._id.toString(),
    name: productName,
    productName,
    productId: asset.productId ? asset.productId.toString() : null,
    assetId: asset.assetId || '',
    bulkUploadId: asset.bulkUploadId || null,
    serialNumber: asset.serialNumber || asset.productSerialNumber || '',
    productSerialNumber,
    category: asset.category || '',
    location: asset.location || '',
    status: normalizeAssetStatus(asset.status),
    quantity: asset.quantity,
    availableQuantity: asset.availableQuantity ?? asset.quantity,
    price: asset.price,
    depreciatedPrice,
    minStockLevel: asset.minStockLevel,
    productModel: asset.productModel || '',
    hsnSac: asset.hsnSac || '',
    gst: asset.gst || '',
    manufacturer: asset.manufacturer || '',
    purchaseDate: asset.purchaseDate,
    invoiceDate: asset.purchaseDate,
    warrantyExpiry: warrantyDate,
    warrantyDate,
    description: productDescription,
    productDescription,
    createdBy: asset.createdBy,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    vendorName: asset.vendorName || '',
    invoiceNumber: asset.invoiceNumber || '',
    customerName: asset.customerName || '',
    documentNumber: asset.documentNumber || '',
    rentStartDate: asset.rentStartDate || '',
    rentEndDate: asset.rentEndDate || '',
    inwardType: asset.inwardType || 'Purchase',
    inwardDate: asset.inwardDate,
    document: asset.document || { fileName: '', fileUrl: '', uploadedAt: null },
  };
};

const formatOverviewMovement = (movement) => ({
  id: movement._id.toString(),
  asset: movement.assetName || 'Unknown Asset',
  type: movement.type,
  quantity: movement.quantity,
  date: movement.createdAt ? new Date(movement.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) : '-',
  by: movement.performedBy || 'System',
  reference: movement.reference || '',
});

const normalizeHistoryMovementType = (movement) => {
  if (!movement) return 'UNKNOWN';
  if (movement.type === 'INWARD') return 'INWARD';
  if (movement.type === 'OUTWARD') {
    return String(movement.outwardType || '').toLowerCase() === 'rent' ? 'RENT_OUT' : 'SOLD';
  }
  if (movement.type === 'RENT_OUT') return 'RENT_OUT';
  if (movement.type === 'RETURNED') return 'RETURN';
  if (movement.type === 'SOLD' || movement.type === 'SOLD_OUT') return 'SOLD';
  return String(movement.type || '').toUpperCase();
};

const calculateRentalMonths = (startDate, endDate) => {
  if (!startDate || !String(startDate).trim()) return 0

  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return 0

  const end = endDate && String(endDate).trim() ? new Date(endDate) : new Date()
  if (Number.isNaN(end.getTime())) return 0
  if (end.getTime() < start.getTime()) return 0

  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() < start.getDate()) {
    months -= 1
  }

  return Math.max(0, months)
};

const calculateDepreciatedPrice = (asset) => {
  // Need both invoice/purchase date and price to calculate depreciation
  if (!asset.purchaseDate || !asset.price || asset.price <= 0) {
    return asset.price || 0;
  }

  // Parse the invoice date (stored as purchaseDate in the model)
  const invoiceDate = new Date(asset.purchaseDate);
  if (Number.isNaN(invoiceDate.getTime())) {
    return asset.price;
  }

  const today = new Date();
  const invoiceMonth = invoiceDate.getMonth(); // 0-11 (January = 0, December = 11)
  const invoiceYear = invoiceDate.getFullYear();

  // Determine season of purchase
  // April-September = months 3-8 (0-indexed)
  // October-March = months 9-11, 0-2 (0-indexed)
  const isPurchasedAprilToSeptember = invoiceMonth >= 3 && invoiceMonth <= 8;

  // Step 1: Apply initial depreciation based on purchase season
  let depreciatedPrice = asset.price;
  if (isPurchasedAprilToSeptember) {
    // April-September purchase: Initial depreciation = 40%
    depreciatedPrice = asset.price * 0.6;
  } else {
    // October-March purchase: Initial depreciation = 20%
    depreciatedPrice = asset.price * 0.8;
  }

  // Step 2: Count how many April 1st dates have passed since invoice date
  // Depreciation is applied every April 1st
  // Each April 1: depreciate 40% of previous value = retain 60% = multiply by 0.6

  // Find the first April 1st that occurs after the invoice date.
  // For October-March purchases, do not count the next April 1st in the same year,
  // because the asset was purchased after that date and the first 40% depreciation
  // should happen only on the following April 1.
  const firstAprilDate = new Date(invoiceYear + 1, 3, 1);

  // Count how many April 1st dates have passed (including today if today is Apr 1 or later)
  let aprilCount = 0;
  let currentAprilDate = new Date(firstAprilDate);

  while (currentAprilDate <= today) {
    aprilCount++;
    // Move to next April 1st
    currentAprilDate = new Date(currentAprilDate.getFullYear() + 1, 3, 1);
  }

  // Step 3: Apply 40% depreciation for each April 1st that has passed
  // Each April: depreciate 40% of previous value = retain 60% = multiply by 0.6
  for (let i = 0; i < aprilCount; i++) {
    depreciatedPrice = depreciatedPrice * 0.6;
  }

  // Return rounded value to 2 decimal places, minimum ₹0
  return Math.max(0, Math.round(depreciatedPrice * 100) / 100);
};

const updateLatestRentOutMovement = async (assetId, payload) => {
  const latestRentOut = await AssetMovement.findOne({
    assetId,
    $and: [
      {
        $or: [
          { type: 'RENT_OUT' },
          { type: 'OUTWARD', outwardType: 'Rent' },
        ],
      },
      {
        $or: [
          { rentEndDate: '' },
          { rentEndDate: null },
        ],
      },
    ],
  })
    .sort({ movementDate: -1, createdAt: -1 })
    .exec()

  if (!latestRentOut) return null

  const fieldsToUpdate = [
    'customerName',
    'documentNumber',
    'invoiceNumber',
    'rentStartDate',
    'rentEndDate',
    'remarks',
    'price',
    'productName',
    'productDescription',
    'productModel',
    'productSerialNumber',
  ]

  let updated = false
  for (const field of fieldsToUpdate) {
    if (payload[field] !== undefined) {
      latestRentOut[field] = payload[field]
      updated = true
    }
  }

  if (updated) {
    await latestRentOut.save()
  }

  return latestRentOut
}

const buildSerialHistoryRows = (asset, movements) => {
  const rows = [];

  const getMovementCustomerName = (movement) => {
    const directName = String(movement.customerName || movement.customer || '').trim();
    if (directName) return directName;

    const description = String(movement.description || '').trim();
    const match = description.match(/(?:for|to)\s+(.+)$/i);
    if (match) return match[1].trim();

    return '';
  };

  const pushRow = (movement, movementType, extra = {}) => {
    const rentOutPrice = Number(movement.price) || Number(asset.price) || 0
    const totalMonths = calculateRentalMonths(movement.rentStartDate, movement.rentEndDate)
    const monthwiseTotalPrice = totalMonths && rentOutPrice ? totalMonths * rentOutPrice : 0

    const movementCustomerName = getMovementCustomerName(movement);

    rows.push({
      id: `${movement._id.toString()}-${movementType}`,
      date: movement.movementDate || movement.createdAt || null,
      inwardInvoiceNumber: asset.invoiceNumber || '',
      outwardInvoiceNumber: movement.invoiceNumber || '',
      documentNumber: movement.documentNumber || '',
      productSerialNumber: movement.productSerialNumber || asset.productSerialNumber || asset.serialNumber || '',
      productModel: movement.productModel || asset.productModel || '',
      vendorName: movement.vendorName || asset.vendorName || '',
      customerName: movementCustomerName,
      productName: movement.productName || asset.productName || asset.name || '',
      productDescription: movement.productDescription || asset.productDescription || asset.description || '',
      movementType,
      rentStartDate: movement.rentStartDate || '',
      rentEndDate: movement.rentEndDate || '',
      rentOutPrice,
      totalMonths,
      monthwiseTotalPrice,
      remarks: movement.remarks || movement.description || '',
      ...extra,
    });
  };

  movements.forEach((movement) => {
    const normalizedType = normalizeHistoryMovementType(movement);

    if (normalizedType === 'INWARD') {
      pushRow(movement, 'INWARD');
      return;
    }

    if (normalizedType === 'RENT_OUT') {
      pushRow(movement, 'RENT_OUT');
      return;
    }

    if (normalizedType === 'RETURN') {
      pushRow(movement, 'RETURNED');
      return;
    }

    if (normalizedType === 'SOLD') {
      pushRow(movement, 'SOLD');
      return;
    }

    pushRow(movement, String(normalizedType).toUpperCase());
  });

  return rows.sort((left, right) => {
    const leftDate = left.date ? new Date(left.date).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDate = right.date ? new Date(right.date).getTime() : Number.MAX_SAFE_INTEGER;
    return leftDate - rightDate;
  });
};

// GET /api/inventory/overview - Get inventory overview data
router.get('/overview', async (req, res) => {
  try {
    const assets = await Asset.find({}, 'name quantity availableQuantity status createdAt price').sort({ createdAt: -1 }).lean();
    const totalAssets = assets.length;
    const inStock = assets.filter((asset) => normalizeAssetStatus(asset.status) === 'available').length;
    const rentedOutCount = assets.filter((asset) => normalizeAssetStatus(asset.status) === 'rented').length;
    const soldOutCount = assets.filter((asset) => normalizeAssetStatus(asset.status) === 'sold').length;
    const returnedCount = assets.filter((asset) => normalizeAssetStatus(asset.status) === 'returned').length;

    const recentAssets = assets.slice(0, 5).map((asset) => ({
      id: asset._id.toString(),
      name: asset.name || 'Unnamed Asset',
      quantity: Number(asset.quantity) || 0,
      status: asset.status || 'available',
      createdAt: asset.createdAt,
    }));

    const recentInward = await AssetMovement.find({ type: 'INWARD' }).sort({ createdAt: -1 }).limit(5).lean();
    const recentRentals = await AssetMovement.find({ type: 'RENT_OUT' }).sort({ createdAt: -1 }).limit(5).lean();
    const recentSales = await AssetMovement.find({ type: { $in: ['SOLD', 'SOLD_OUT'] } }).sort({ createdAt: -1 }).limit(5).lean();

    res.json({
      summary: {
        totalAssets,
        inStock,
        rentedOut: rentedOutCount,
        soldOut: soldOutCount,
        returned: returnedCount,
      },
      recentAssets,
      recentInward: recentInward.map(formatOverviewMovement),
      recentRentals: recentRentals.map(formatOverviewMovement),
      recentSales: recentSales.map(formatOverviewMovement),
    });
  } catch (error) {
    console.error('Error fetching inventory overview:', error);
    res.status(500).json({ error: 'Failed to fetch inventory overview' });
  }
});

// GET /api/inventory/stats - Get inventory dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const assets = await Asset.find({}, 'quantity availableQuantity status price');

    await Promise.all(assets.filter((asset) => !asset.assetId).map((asset) => ensureAssetId(asset)));

    const totalAssets = assets.length;
    const inStockCount = assets.filter((asset) => normalizeAssetStatus(asset.status) === 'available').length;
    const outwardingCount = assets.filter((asset) => normalizeAssetStatus(asset.status) === 'outwarding').length;
    const rentedOutCount = assets.filter((asset) => normalizeAssetStatus(asset.status) === 'rented').length;
    const soldOutCount = assets.filter((asset) => normalizeAssetStatus(asset.status) === 'sold').length;
    const returnedCount = assets.filter((asset) => normalizeAssetStatus(asset.status) === 'returned').length;
    const damagedLostCount = assets.filter((asset) => ['damaged', 'lost'].includes(normalizeAssetStatus(asset.status))).length;

    const totalAssetValue = assets.reduce((sum, asset) => sum + ((Number(asset.price) || 0) * (Number(asset.quantity) || 0)), 0);

    res.json({
      allAssets: totalAssets,
      inStock: inStockCount,
      outwarding: outwardingCount,
      rentOut: rentedOutCount,
      soldOut: soldOutCount,
      returned: returnedCount,
      damagedLost: damagedLostCount,
      totalAssetValue: totalAssetValue.toFixed(2),
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch inventory stats' });
  }
});

// GET /api/inventory/movements - Get recent asset movements
router.get('/movements', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const assetName = req.query.assetName ? String(req.query.assetName) : '';
    const type = req.query.type ? String(req.query.type).toUpperCase() : '';

    const query = {};
    if (assetName) {
      query.assetName = { $regex: assetName, $options: 'i' };
    }
    if (type) {
      query.type = type;
    }

    const movements = await AssetMovement.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({ path: 'assetId', select: 'assetId vendorName location invoiceNumber' })
      .select('assetId assetName type quantity createdAt performedBy reference');

    const formattedMovements = movements.map((m) => {
      const assetDoc = m.assetId;
      const isoDate = m.createdAt ? new Date(m.createdAt).toISOString().split('T')[0] : '';
      return {
        id: m._id.toString(),
        date: isoDate,
        assetId: assetDoc?.assetId || String(m.assetId),
        assetName: m.assetName,
        vendor: assetDoc?.vendorName || '',
        quantity: m.quantity,
        invoiceNumber: assetDoc?.invoiceNumber || m.reference || '',
        location: assetDoc?.location || '',
        createdBy: m.performedBy || 'System',
      };
    });

    res.json(formattedMovements);
  } catch (error) {
    console.error('Error fetching movements:', error);
    res.status(500).json({ error: 'Failed to fetch movements' });
  }
});

// GET /api/inventory/low-stock - Get low stock alerts
router.get('/low-stock', async (req, res) => {
  try {
    const lowStockAssets = await Asset.find({
      $expr: { $lte: ['$quantity', '$minStockLevel'] },
      minStockLevel: { $gt: 0 },
    }).select('name quantity minStockLevel');

    const alerts = lowStockAssets.map((asset) => ({
      id: asset._id.toString(),
      asset: asset.name,
      available: asset.quantity,
      minStock: asset.minStockLevel,
      status: asset.quantity === 0 ? 'CRITICAL' : asset.quantity <= Math.ceil(asset.minStockLevel * 0.5) ? 'CRITICAL' : 'LOW',
    }));

    res.json(alerts);
  } catch (error) {
    console.error('Error fetching low stock:', error);
    res.status(500).json({ error: 'Failed to fetch low stock alerts' });
  }
});

// GET /api/inventory/quick-summary - Today's activity
router.get('/quick-summary', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayInward = await AssetMovement.aggregate([
      {
        $match: {
          type: 'INWARD',
          createdAt: { $gte: today },
        },
      },
      { $group: { _id: null, total: { $sum: '$quantity' } } },
    ]);

    const todayOutward = await AssetMovement.aggregate([
      {
        $match: {
          type: 'OUTWARD',
          createdAt: { $gte: today },
        },
      },
      { $group: { _id: null, total: { $sum: '$quantity' } } },
    ]);

    const dueReturns = await AssetMovement.countDocuments({
      type: 'RENT_OUT',
      createdAt: { $lt: today },
    });

    const overdueRentals = await AssetMovement.countDocuments({
      type: 'RENT_OUT',
      createdAt: { $lt: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) },
    });

    res.json({
      todayInward: todayInward[0]?.total || 0,
      todayOutward: todayOutward[0]?.total || 0,
      dueReturns,
      overdueRentals,
    });
  } catch (error) {
    console.error('Error fetching quick summary:', error);
    res.status(500).json({ error: 'Failed to fetch quick summary' });
  }
});

// GET /api/inventory/assets - Get all assets with search and filters
router.get('/assets', async (req, res) => {
  try {
    const { search, category, location, status } = req.query;
    
    console.log('\n=== GET /assets ===');
    console.log('Request params:', { search: search ? '(set)' : 'none', category, location, status });
    
    let query = {};
    
    // Search across multiple fields
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { assetId: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } },
        { productModel: { $regex: search, $options: 'i' } },
        { manufacturer: { $regex: search, $options: 'i' } },
      ];
    }
    
    // Apply category filter
    if (category && category !== 'all') {
      query.category = category;
    }
    
    // Apply location filter
    if (location && location !== 'all') {
      query.location = location;
    }
    
    // Apply status filter
    if (status && status !== 'all') {
      query.status = buildStatusQuery(status);
      console.log('Status query:', { requested: status, mongoQuery: JSON.stringify(query.status) });
    }
    
    const assets = await Asset.find(query).sort({ createdAt: -1 });
    console.log('Database returned:', assets.length, 'assets');

    const formattedAssets = await Promise.all(assets.map(async (asset) => {
      if (!asset.assetId) {
        await ensureAssetId(asset);
      }
      return toAssetPayload(asset);
    }));
    
    console.log('Formatted response:', formattedAssets.length, 'assets');
    console.log('=== END GET /assets ===\n');
    
    res.json(formattedAssets);
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// POST /api/inventory/assets/bulk - Create one asset per serial number.
router.post('/assets/bulk', async (req, res) => {
  try {
    const { serialNumbers, ...common } = req.body || {};
    const serials = Array.isArray(serialNumbers)
      ? serialNumbers.map((serial) => String(serial ?? '')).filter((serial) => serial.trim().length > 0)
      : [];
    const normalizedSerials = serials.map((serial) => serial.toLowerCase());
    const duplicateSerials = serials.filter((serial, index) => normalizedSerials.indexOf(serial.toLowerCase()) !== index);
    const uniqueDuplicateSerials = [...new Set(duplicateSerials)];

    if (!serials.length) return res.status(400).json({ error: 'At least one serial number is required' });
    if (uniqueDuplicateSerials.length) {
      return res.status(400).json({ error: `Duplicate serial numbers: ${uniqueDuplicateSerials.join(', ')}` });
    }

    const existingAssets = await Asset.find({
      $or: serials.flatMap((serial) => [
        { productSerialNumber: { $regex: `^${escapeRegExp(serial)}$`, $options: 'i' } },
        { serialNumber: { $regex: `^${escapeRegExp(serial)}$`, $options: 'i' } },
      ]),
    }).select('serialNumber productSerialNumber');
    if (existingAssets.length) {
      const existingSerials = [...new Set(existingAssets.flatMap((asset) => [asset.productSerialNumber, asset.serialNumber]).filter(Boolean))];
      return res.status(409).json({ error: `Serial numbers already exist: ${existingSerials.join(', ')}` });
    }

    const assetName = String(common.productName || common.name || '').trim();
    const vendorName = String(common.vendorName || '').trim();
    const invoiceNumber = String(common.invoiceNumber || '').trim();
    const invoiceDateValue = common.invoiceDate || common.inwardDate || common.purchaseDate || new Date().toISOString().split('T')[0];
    const invoiceDate = new Date(invoiceDateValue);
    const warrantyDate = common.warrantyDate || common.warrantyExpiry || null;
    const warrantyDateCheck = warrantyDate ? new Date(warrantyDate) : null;
    const price = Number(common.price);

    if (!assetName) return res.status(400).json({ error: 'Product Name is required' });
    if (!vendorName) return res.status(400).json({ error: 'Vendor Name is required' });
    if (!invoiceNumber) return res.status(400).json({ error: 'Invoice Number is required' });
    if (Number(common.quantity) !== serials.length) return res.status(400).json({ error: 'Quantity must match the number of serial numbers' });
    if (Number.isNaN(price)) return res.status(400).json({ error: 'Price must be numeric' });
    if (Number.isNaN(invoiceDate.getTime())) return res.status(400).json({ error: 'Invoice Date is invalid' });
    if (warrantyDateCheck && (Number.isNaN(warrantyDateCheck.getTime()) || warrantyDateCheck < invoiceDate)) {
      return res.status(400).json({ error: 'Warranty Date cannot be before Invoice Date' });
    }

    const assetFields = {
      name: assetName,
      productName: assetName,
      productId: common.productId || null,
      category: common.category || '',
      productModel: common.productModel || '',
      hsnSac: common.hsnSac || '',
      gst: common.gst || '',
      manufacturer: common.manufacturer || '',
      location: common.location || 'Main Warehouse',
      quantity: 1,
      availableQuantity: 1,
      minStockLevel: Number(common.minStockLevel) || 0,
      price,
      purchaseDate: invoiceDate,
      warrantyExpiry: warrantyDate ? new Date(warrantyDate) : null,
      warrantyDate: warrantyDate ? new Date(warrantyDate) : null,
      description: String(common.productDescription || common.description || '').trim(),
      productDescription: String(common.productDescription || common.description || '').trim(),
      status: 'available',
      inwardDate: invoiceDate,
      vendorName,
      invoiceNumber,
      inwardType: common.inwardType || 'Purchase',
      createdBy: common.createdBy || 'System',
      bulkUploadId: `BULK-${randomUUID()}`,
    };
    const assets = [];
    const movements = [];
    try {
      for (const serial of serials) {
        const asset = new Asset({
          ...assetFields,
          serialNumber: serial,
          productSerialNumber: serial,
        });
        await ensureAssetId(asset);
        assets.push(asset);
      }

      for (const asset of assets) {
        const movement = await new AssetMovement({
          assetId: asset._id,
          assetName: asset.name,
          type: 'INWARD',
          quantity: 1,
          description: `${asset.inwardType || 'Purchase'} from ${asset.vendorName || 'System'}${asset.invoiceNumber ? ` (Invoice: ${asset.invoiceNumber})` : ''}`,
          performedBy: asset.createdBy || 'System',
          reference: asset.invoiceNumber || '',
        }).save();
        movements.push(movement);
      }
    } catch (creationError) {
      const assetIds = assets.map((asset) => asset._id);
      if (assetIds.length) {
        await AssetMovement.deleteMany({ assetId: { $in: assetIds } });
        await Asset.deleteMany({ _id: { $in: assetIds } });
      }
      throw creationError;
    }

    return res.status(201).json({ count: assets.length, assets: assets.map(toAssetPayload) });
  } catch (error) {
    console.error('Error creating bulk assets:', error);
    return res.status(error?.name === 'ValidationError' ? 400 : 500).json({ error: error?.message || 'Failed to create bulk assets' });
  }
});

// POST /api/inventory/assets - Create new asset or inward record
router.post('/assets', async (req, res) => {
  try {
    console.log('Incoming Asset:', req.body);
    const {
      name,
      assetId,
      category,
      productId,
      productModel,
      serialNumber,
      manufacturer,
      location,
      quantity,
      minStockLevel,
      price,
      purchaseDate,
      warrantyExpiry,
      description,
      createdBy,
      inwardDate,
      invoiceNumber,
      vendorName,
      productName,
      productDescription,
      warrantyDate,
      productSerialNumber,
      inwardType,
      status,
      mode,
      hsnSac,
      gst,
    } = req.body;

    const isInwardSubmission = mode === 'inward';
    const assetName = String(productName || name || '').trim();
    const invoiceDateValue = inwardDate || purchaseDate || new Date().toISOString().split('T')[0];
    const assetCategory = category ?? '';
    const assetVendorName = String(vendorName || '').trim();
    const assetSerialNumber = String(productSerialNumber || serialNumber || '').trim();
    const descriptionText = String(productDescription || description || '').trim();
    const assetWarrantyExpiry = warrantyDate || warrantyExpiry || null;
    const assetQuantity = Number(quantity) || 0;
    const assetLocation = String(location || '').trim();
    const defaultStatus = normalizeAssetStatus('IN_STOCK');
    const invoiceDate = invoiceDateValue ? new Date(invoiceDateValue) : new Date();
    const warrantyDateCheck = assetWarrantyExpiry ? new Date(assetWarrantyExpiry) : null;

    if (!assetName) return res.status(400).json({ error: 'Product Name is required' });
    if (!assetVendorName) return res.status(400).json({ error: 'vendorName is required' });
    if (!invoiceNumber || String(invoiceNumber).trim() === '') return res.status(400).json({ error: 'invoiceNumber is required' });
    if (!assetSerialNumber) return res.status(400).json({ error: 'Product Serial Number is required' });
    if (assetQuantity <= 0) return res.status(400).json({ error: 'Quantity must be greater than 0' });
    if (price === undefined || price === null || Number.isNaN(Number(price))) return res.status(400).json({ error: 'Price must be numeric' });
    if (warrantyDateCheck && invoiceDate && warrantyDateCheck < invoiceDate) {
      return res.status(400).json({ error: 'Warranty Date cannot be before Invoice Date' });
    }

    if (assetSerialNumber) {
      const duplicateSerial = await Asset.findOne({
        $or: [
          { productSerialNumber: { $regex: `^${escapeRegExp(assetSerialNumber)}$`, $options: 'i' } },
          { serialNumber: { $regex: `^${escapeRegExp(assetSerialNumber)}$`, $options: 'i' } },
        ],
      });
      if (duplicateSerial) {
        return res.status(409).json({ error: 'Product Serial Number already exists' });
      }
    }

    if (assetId) {
      const duplicateAssetId = await Asset.findOne({ assetId: String(assetId).trim() });
      if (duplicateAssetId) {
        return res.status(409).json({ error: 'Asset ID already exists' });
      }
    }

    const existingAsset = await Asset.findOne(buildNameQuery(assetName, assetSerialNumber));

    if (isInwardSubmission && existingAsset) {
      existingAsset.name = assetName || existingAsset.name;
      existingAsset.productName = assetName || existingAsset.productName || existingAsset.name;
      existingAsset.description = descriptionText || existingAsset.description || '';
      existingAsset.productDescription = descriptionText || existingAsset.productDescription || existingAsset.description || '';
      existingAsset.category = assetCategory !== undefined ? assetCategory : existingAsset.category || '';
      existingAsset.vendorName = assetVendorName || existingAsset.vendorName || '';
      existingAsset.invoiceNumber = invoiceNumber || existingAsset.invoiceNumber || '';
      existingAsset.inwardType = inwardType || existingAsset.inwardType || 'Purchase';
      existingAsset.inwardDate = invoiceDate;
      existingAsset.productModel = productModel || existingAsset.productModel || '';
      existingAsset.serialNumber = assetSerialNumber || existingAsset.serialNumber || '';
      existingAsset.productSerialNumber = assetSerialNumber || existingAsset.productSerialNumber || existingAsset.serialNumber || '';
      existingAsset.location = assetLocation || existingAsset.location || '';
      existingAsset.price = price ? Number(price) : existingAsset.price || 0;
      existingAsset.quantity = Number(existingAsset.quantity || 0) + assetQuantity;
      existingAsset.availableQuantity = Number(existingAsset.availableQuantity ?? existingAsset.quantity ?? 0) + assetQuantity;
      existingAsset.status = defaultStatus;
      existingAsset.warrantyExpiry = assetWarrantyExpiry ? new Date(assetWarrantyExpiry) : existingAsset.warrantyExpiry || null;
      existingAsset.warrantyDate = existingAsset.warrantyExpiry;
      await ensureAssetId(existingAsset);
      await existingAsset.save();

      const movement = new AssetMovement({
        assetId: existingAsset._id,
        assetName: existingAsset.name,
        type: 'INWARD',
        quantity: assetQuantity,
        description: `${existingAsset.inwardType} from ${existingAsset.vendorName || 'System'}${invoiceNumber ? ` (Invoice: ${invoiceNumber})` : ''}`,
        performedBy: createdBy || 'System',
        reference: invoiceNumber || '',
      });
      await movement.save();

      return res.status(201).json(toAssetPayload(existingAsset));
    }

    const assetStatus = status ? normalizeAssetStatus(status) : defaultStatus;
    const asset = new Asset({
      name: assetName,
      productName: assetName,
      productId: productId || null,
      assetId: assetId || undefined,
      category: assetCategory || '',
      productModel: productModel || '',
      hsnSac: hsnSac || '',
      gst: gst || '',
      serialNumber: assetSerialNumber,
      productSerialNumber: assetSerialNumber,
      manufacturer: manufacturer || '',
      location: assetLocation || 'Main Warehouse',
      quantity: assetQuantity,
      availableQuantity: assetQuantity,
      minStockLevel: minStockLevel || 0,
      price: Number(price) || 0,
      purchaseDate: invoiceDate,
      warrantyExpiry: assetWarrantyExpiry ? new Date(assetWarrantyExpiry) : null,
      warrantyDate: assetWarrantyExpiry ? new Date(assetWarrantyExpiry) : null,
      description: descriptionText,
      productDescription: descriptionText,
      status: assetStatus,
      inwardDate: invoiceDate,
      vendorName: assetVendorName,
      invoiceNumber: String(invoiceNumber || '').trim(),
      inwardType: inwardType || 'Purchase',
      createdBy: createdBy || 'System',
    });

    const savedAsset = await asset.save();
    await ensureAssetId(savedAsset);
    console.log('Saved Asset:', savedAsset.toObject());

    const movement = new AssetMovement({
      assetId: savedAsset._id,
      assetName: savedAsset.name,
      type: 'INWARD',
      quantity: assetQuantity,
      description: `${savedAsset.inwardType || 'Purchase'} from ${savedAsset.vendorName || 'System'}${savedAsset.invoiceNumber ? ` (Invoice: ${savedAsset.invoiceNumber})` : ''}`,
      performedBy: createdBy || 'System',
      reference: savedAsset.invoiceNumber || '',
    });
    await movement.save();

    res.status(201).json(toAssetPayload(savedAsset));
  } catch (error) {
    console.error('Error creating asset:', error);
    const message = error?.message || 'Failed to create asset';
    const statusCode = error?.name === 'ValidationError' ? 400 : 500;
    return res.status(statusCode).json({ error: message });
  }
});

// POST /api/inventory/inward - Create asset with inward movement
router.post('/inward', async (req, res) => {
  try {
    const payload = { ...req.body };
    const response = await fetch(`${process.env.BASE_URL || 'http://localhost:5000'}/api/inventory/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Error creating inward:', error);
    res.status(500).json({ error: 'Failed to create inward record' });
  }
});

// POST /api/inventory/outward - Create outward movement
router.post('/outward', async (req, res) => {
  try {
    console.log('Outward Request:', req.body);
    const {
      assetId,
      assetName,
      customerName,
      customerId,
      outwardType,
      quantity,
      documentNumber,
      invoiceNumber,
      remarks,
      performedBy,
      outwardDate,
      rentStartDate,
      rentEndDate,
      productName,
      productDescription,
      productSerialNumber,
      productModel,
      price,
    } = req.body;

    const outwardQuantity = Number(quantity) || 0;

    if (!assetName && !assetId) {
      return res.status(400).json({ error: 'Asset is required' });
    }

    if (!customerName || String(customerName).trim() === '') {
      return res.status(400).json({ error: 'Customer Name is required' });
    }

    if (!outwardType || !['Rent', 'Sell'].includes(String(outwardType))) {
      return res.status(400).json({ error: 'Outward Type must be Rent or Sell' });
    }

    if (!outwardQuantity || outwardQuantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    if (outwardType === 'Rent' && (!rentStartDate || String(rentStartDate).trim() === '')) {
      return res.status(400).json({ error: 'Rent Start Date is required for Rent' });
    }

    if (outwardType === 'Sell' && (!invoiceNumber || String(invoiceNumber).trim() === '')) {
      return res.status(400).json({ error: 'Invoice Number is required for Sell' });
    }

    let asset = null;
    if (assetId) {
      asset = await Asset.findById(assetId);
    }
    if (!asset && (assetName || productSerialNumber)) {
      const serial = String(productSerialNumber || '').trim();
      if (serial) {
        asset = await Asset.findOne({
          $or: [
            { productSerialNumber: { $regex: `^${escapeRegExp(serial)}$`, $options: 'i' } },
            { serialNumber: { $regex: `^${escapeRegExp(serial)}$`, $options: 'i' } },
          ],
        });
      }
      if (!asset && assetName) {
        asset = await Asset.findOne(buildNameQuery(assetName, ''));
      }
    }

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const normalizedStatus = normalizeAssetStatus(asset.status);
    const hasActiveRental = normalizedStatus === 'rented';
    if (outwardType === 'Rent' && hasActiveRental) {
      return res.status(409).json({ error: 'This asset is already rented.' });
    }

    const currentQuantity = Number(asset.quantity ?? 0);
    const availableQuantity = Number(asset.availableQuantity ?? currentQuantity);
    if (String(outwardType) !== 'Rent' && outwardQuantity > availableQuantity) {
      return res.status(400).json({ error: `Insufficient stock. Only ${availableQuantity} units are available.` });
    }

    asset.customerName = String(customerName || '').trim();
    asset.documentNumber = String(documentNumber || '').trim();
    asset.rentStartDate = String(rentStartDate || '').trim();
    asset.rentEndDate = String(rentEndDate || '').trim();
    if (productName !== undefined) asset.productName = String(productName || '').trim() || asset.productName;
    if (productSerialNumber !== undefined) asset.productSerialNumber = String(productSerialNumber || '').trim() || asset.productSerialNumber;
    if (productModel !== undefined) asset.productModel = String(productModel || '').trim() || asset.productModel;
    // NOTE: productDescription is NOT modified here to preserve the master asset description

    if (String(outwardType) === 'Rent') {
      asset.status = 'rented';
      asset.availableQuantity = 0;
      asset.serialNumber = String(productSerialNumber || asset.serialNumber || '').trim() || asset.serialNumber;
      asset.productSerialNumber = asset.serialNumber;
      asset.name = String(productName || asset.name || '').trim() || asset.name;
      asset.productName = asset.name;
      asset.invoiceNumber = String(invoiceNumber || asset.invoiceNumber || '').trim();
      asset.documentNumber = String(documentNumber || asset.documentNumber || '').trim();
      asset.rentStartDate = String(rentStartDate || asset.rentStartDate || '').trim();
      asset.rentEndDate = String(rentEndDate || asset.rentEndDate || '').trim();
      // Keep the original productDescription - do NOT overwrite it with rental-specific description
    } else {
      const remainingQuantity = currentQuantity - outwardQuantity;
      asset.quantity = remainingQuantity;
      asset.availableQuantity = Math.max(0, availableQuantity - outwardQuantity);
      asset.status = 'sold';
      asset.name = String(productName || asset.name || '').trim() || asset.name;
      asset.serialNumber = String(productSerialNumber || asset.serialNumber || '').trim() || asset.serialNumber;
      asset.productSerialNumber = asset.serialNumber;
      asset.productName = asset.name;
    }

    await asset.save();
    console.log('Updated Asset:', asset);

    const movement = new AssetMovement({
      assetId: asset._id,
      assetName: asset.name,
      customerName: String(customerName).trim(),
      customerId: String(customerId || ''),
      type: outwardType === 'Rent' ? 'RENT_OUT' : 'OUTWARD',
      outwardType: String(outwardType),
      quantity: outwardQuantity,
      serialNumber: asset.serialNumber || asset.productSerialNumber || '',
      productSerialNumber: asset.productSerialNumber || asset.serialNumber || '',
      productModel: asset.productModel || '',
      vendorName: asset.vendorName || '',
      productName: asset.productName || asset.name || '',
      // Store the rental-specific description in the movement record
      // This is separate from the master asset description
      productDescription: String(productDescription || asset.productDescription || asset.description || '').trim(),
      price: Number(price) || asset.price || 0,
      documentNumber: String(documentNumber || ''),
      rentStartDate: String(rentStartDate || ''),
      rentEndDate: String(rentEndDate || ''),
      invoiceNumber: String(invoiceNumber || ''),
      remarks: String(remarks || ''),
      movementDate: outwardDate ? new Date(outwardDate) : new Date(),
      description: `Outward ${String(outwardType)} for ${String(customerName).trim()}`,
      performedBy: performedBy || 'System',
      reference: String(invoiceNumber || ''),
    });
    await movement.save();

    res.status(201).json({
      id: asset._id.toString(),
      name: asset.name,
      quantity: asset.quantity,
      availableQuantity: asset.availableQuantity,
      status: asset.status,
      movement: {
        id: movement._id.toString(),
        type: movement.type,
        quantity: movement.quantity,
      },
    });
  } catch (error) {
    console.error('Error creating outward:', error);
    res.status(500).json({ error: 'Failed to create outward movement' });
  }
});

router.post('/return', async (req, res) => {
  try {
    console.log('\n=== RETURN REQUEST ===');
    console.log('Body:', req.body);
    const { assetId, customerName, supplierName, supplier, quantity, remarks, performedBy, returnDate, rentEndDate } = req.body;
    const returnQuantity = Number(quantity) || 1;
    const selectedSupplier = String(supplierName || supplier || '').trim();
    const returnDateValue = String(returnDate || '').trim();

    if (!assetId) {
      return res.status(400).json({ error: 'Asset is required' });
    }
    if (!returnQuantity || returnQuantity <= 0) {
      return res.status(400).json({ error: 'Return quantity must be greater than 0' });
    }

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    console.log('Asset BEFORE return:', {
      id: asset._id.toString(),
      name: asset.name,
      status: asset.status,
      inwardType: asset.inwardType,
      serialNumber: asset.serialNumber,
    });

    const normalizedInwardType = normalizeInwardType(asset.inwardType);
    const normalizedStatus = normalizeAssetStatus(asset.status);
    console.log('Normalized values:', { normalizedStatus, normalizedInwardType, rawInwardType: asset.inwardType });

    if (normalizedStatus === 'available' && normalizedInwardType === 'Purchase') {
      console.log('REJECTED: Purchase asset cannot be returned');
      return res.status(400).json({ error: 'Return is only allowed for Rent In assets.' });
    }

    if (normalizedInwardType === 'In Stock') {
      asset.inwardType = 'Rent In';
    }
    const originalRentStartDate = String(asset.rentStartDate || '').trim();
    const originalRentEndDate = String(asset.rentEndDate || '').trim();
    const originalDocumentNumber = String(asset.documentNumber || '').trim();
    const originalCustomerName = String(asset.customerName || '').trim();

    if (normalizedStatus === 'rented') {
      const rentReturnDate = String(rentEndDate || returnDateValue || '').trim();
      asset.status = 'available';
      asset.availableQuantity = Math.max(Number(asset.availableQuantity ?? asset.quantity ?? 0), Number(asset.quantity ?? 1));
      asset.customerName = '';
      asset.rentStartDate = '';
      asset.rentEndDate = ''; 
      asset.documentNumber = '';

      await asset.save();

      const movement = new AssetMovement({
        assetId: asset._id,
        assetName: asset.name,
        customerName: String(customerName || originalCustomerName || '').trim(),
        type: 'RETURNED',
        quantity: returnQuantity,
        serialNumber: asset.serialNumber || asset.productSerialNumber || '',
        productSerialNumber: asset.productSerialNumber || asset.serialNumber || '',
        productModel: asset.productModel || '',
        vendorName: asset.vendorName || '',
        productName: asset.productName || asset.name || '',
        productDescription: asset.productDescription || asset.description || '',
        price: Number(asset.price) || 0,
        documentNumber: originalDocumentNumber,
        rentStartDate: originalRentStartDate,
        rentEndDate: rentReturnDate || originalRentEndDate,
        movementDate: returnDateValue ? new Date(returnDateValue) : new Date(),
        remarks: String(remarks || 'Rental returned to stock'),
        description: 'Rental return processed',
        performedBy: performedBy || 'System',
        reference: '',
      });
      await movement.save();

      return res.status(201).json({
        id: asset._id.toString(),
        name: asset.name,
        quantity: asset.quantity,
        availableQuantity: asset.availableQuantity,
        status: asset.status,
        movement: { id: movement._id.toString(), type: movement.type, quantity: movement.quantity },
      });
    }

    if (normalizedStatus !== 'available') {
      return res.status(400).json({ error: 'Asset must be available in In Stock or rented before return processing' });
    }

    if (!selectedSupplier) {
      return res.status(400).json({ error: 'Supplier is required' });
    }
    if (!returnDateValue) {
      return res.status(400).json({ error: 'Return Date is required' });
    }

    asset.status = 'returned';
    asset.inwardType = 'Rent In';
    asset.availableQuantity = 0;
    asset.vendorName = selectedSupplier;
    asset.customerName = '';
    asset.rentStartDate = '';
    asset.rentEndDate = returnDateValue || originalRentEndDate;
    asset.documentNumber = '';

    console.log('Asset BEFORE Mongoose save:', {
      status: asset.status,
      inwardType: asset.inwardType,
      vendorName: asset.vendorName,
    });

    const savedAsset = await asset.save();
    console.log('Asset AFTER Mongoose save:', {
      id: savedAsset._id.toString(),
      status: savedAsset.status,
      inwardType: savedAsset.inwardType,
    });

    // Verify by refetching
    const verifyAsset = await Asset.findById(savedAsset._id);
    console.log('Asset VERIFIED from DB:', {
      id: verifyAsset._id.toString(),
      status: verifyAsset.status,
      inwardType: verifyAsset.inwardType,
    });

    const movement = new AssetMovement({
      assetId: asset._id,
      assetName: asset.name,
      customerName: String(customerName || originalCustomerName || '').trim(),
      type: 'RETURNED',
      quantity: returnQuantity,
      serialNumber: asset.serialNumber || asset.productSerialNumber || '',
      productSerialNumber: asset.productSerialNumber || asset.serialNumber || '',
      productModel: asset.productModel || '',
      vendorName: selectedSupplier,
      productName: asset.productName || asset.name || '',
      productDescription: asset.productDescription || asset.description || '',
      price: Number(asset.price) || 0,
      documentNumber: originalDocumentNumber,
      rentStartDate: originalRentStartDate,
      rentEndDate: returnDateValue || originalRentEndDate,
      movementDate: returnDateValue ? new Date(returnDateValue) : new Date(),
      remarks: String(remarks || `Returned to supplier ${selectedSupplier}`),
      description: `Returned to supplier ${selectedSupplier}`,
      performedBy: performedBy || 'System',
      reference: '',
    });
    await movement.save();

    res.status(201).json({
      id: asset._id.toString(),
      name: asset.name,
      quantity: asset.quantity,
      availableQuantity: asset.availableQuantity,
      status: asset.status,
      movement: {
        id: movement._id.toString(),
        type: movement.type,
        quantity: movement.quantity,
      },
    });
  } catch (error) {
    console.error('Error processing return:', error);
    res.status(500).json({ error: 'Failed to process return movement' });
  }
});

// GET /api/inventory/assets/serial/:serialNumber/history - Get serial number history
router.get('/assets/serial/:serialNumber/history', async (req, res) => {
  try {
    const serialNumber = String(req.params.serialNumber || '').trim();
    if (!serialNumber) {
      return res.status(400).json({ error: 'Serial number is required' });
    }

    const asset = await Asset.findOne({
      $or: [
        { productSerialNumber: { $regex: `^${escapeRegExp(serialNumber)}$`, $options: 'i' } },
        { serialNumber: { $regex: `^${escapeRegExp(serialNumber)}$`, $options: 'i' } },
      ],
    }).lean();

    if (!asset) {
      return res.status(404).json({ error: `Asset with serial number ${serialNumber} was not found.` });
    }

    const movements = await AssetMovement.find({ assetId: asset._id }).sort({ movementDate: 1, createdAt: 1 }).lean();
    const history = buildSerialHistoryRows(asset, movements);
    const rentalRows = history
      .filter((row) => row.movementType === 'RENT_OUT')
      .sort((left, right) => {
        const leftStart = left.rentStartDate ? new Date(left.rentStartDate).getTime() : Number.MAX_SAFE_INTEGER;
        const rightStart = right.rentStartDate ? new Date(right.rentStartDate).getTime() : Number.MAX_SAFE_INTEGER;
        if (leftStart !== rightStart) return leftStart - rightStart;

        const leftMovement = left.date ? new Date(left.date).getTime() : Number.MAX_SAFE_INTEGER;
        const rightMovement = right.date ? new Date(right.date).getTime() : Number.MAX_SAFE_INTEGER;
        return leftMovement - rightMovement;
      });
    const returnRows = history.filter((row) => row.movementType === 'RETURNED');
    const usedReturnIds = new Set();
    const rentalHistory = rentalRows.map((rental, index) => {
      const rentalStart = rental.rentStartDate ? new Date(rental.rentStartDate).getTime() : 0;
      const matchingReturn = returnRows.find((returned) => {
        if (usedReturnIds.has(returned.id)) return false;
        const returnDate = returned.date ? new Date(returned.date).getTime() : 0;
        const sameCustomer = !rental.customerName || !returned.customerName || rental.customerName.toLowerCase() === returned.customerName.toLowerCase();
        return returnDate >= rentalStart && sameCustomer;
      });

      if (matchingReturn) usedReturnIds.add(matchingReturn.id);
      const rentEndDate = matchingReturn?.rentEndDate || rental.rentEndDate || '';
      const totalMonths = calculateRentalMonths(rental.rentStartDate, rentEndDate);
      const monthlyRentalPrice = Number(rental.rentOutPrice) || 0;

      return {
        ...rental,
        cycleNumber: index + 1,
        rentEndDate,
        totalMonths,
        monthlyRentalPrice,
        rentalRevenue: totalMonths * monthlyRentalPrice,
        monthwiseTotalPrice: totalMonths * monthlyRentalPrice,
        status: matchingReturn ? 'RETURNED' : 'RENTED',
        remarks: matchingReturn?.remarks || rental.remarks || '',
      };
    });
    const purchasePrice = Number(asset.price) || 0;
    const saleMovement = history
      .filter((row) => row.movementType === 'SOLD')
      .sort((left, right) => {
        const leftDate = left.date ? new Date(left.date).getTime() : 0;
        const rightDate = right.date ? new Date(right.date).getTime() : 0;
        return rightDate - leftDate;
      })[0];
    const finalSale = saleMovement ? {
      customerName: saleMovement.customerName,
      invoiceNumber: saleMovement.outwardInvoiceNumber,
      saleDate: saleMovement.date,
      saleAmount: Number(saleMovement.rentOutPrice) || 0,
      remarks: saleMovement.remarks,
    } : null;
    const totalRentalRevenue = rentalHistory.reduce((sum, rental) => sum + rental.rentalRevenue, 0);
    const saleProfit = finalSale ? finalSale.saleAmount - purchasePrice : 0;
    const completeAssetProfit = totalRentalRevenue + (finalSale ? finalSale.saleAmount : 0) - purchasePrice;
    res.json({
      asset: {
        id: asset._id.toString(),
        productName: asset.productName || asset.name || '',
        productDescription: asset.productDescription || asset.description || '',
        productModel: asset.productModel || '',
        serialNumber: asset.productSerialNumber || asset.serialNumber || '',
        vendorName: asset.vendorName || '',
        invoiceNumber: asset.invoiceNumber || '',
        customerName: asset.customerName || '',
        status: formatAssetStatus(asset.status),
        purchasePrice,
        purchaseDate: asset.purchaseDate,
      },
      history,
      rentalHistory,
      finalSale,
      financialSummary: {
        purchasePrice,
        totalRentalRevenue,
        saleAmount: finalSale?.saleAmount || 0,
        saleProfit,
        completeAssetProfit,
      },
    });
  } catch (error) {
    console.error('Error fetching serial history:', error);
    res.status(500).json({ error: 'Failed to fetch serial history' });
  }
});

// GET /api/inventory/assets/:id - Get single asset
router.get('/assets/:id', async (req, res) => {
  try {
    let asset = await Asset.findById(req.params.id);
    
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    if (!asset.assetId) {
      await ensureAssetId(asset);
    }
    
    res.json({
      ...toAssetPayload(asset),
      availableQuantity: asset.availableQuantity ?? asset.quantity,
    });
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// PUT /api/inventory/assets/:id - Update asset
router.put('/assets/:id', async (req, res) => {
  try {
    const {
      name,
      assetId,
      category,
      productModel,
      serialNumber,
      manufacturer,
      location,
      quantity,
      minStockLevel,
      price,
      purchaseDate,
      warrantyExpiry,
      description,
      status,
      inwardDate,
      invoiceNumber,
      vendorName,
      inwardType,
      customerName,
      documentNumber,
      rentStartDate,
      rentEndDate,
      remarks,
    } = req.body;
    
    let asset = await Asset.findById(req.params.id);
    
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const previousStatus = asset.status;
    const originalRentStartDate = String(asset.rentStartDate || '').trim();
    const originalRentEndDate = String(asset.rentEndDate || '').trim();
    const originalCustomerName = String(asset.customerName || '').trim();
    const originalDocumentNumber = String(asset.documentNumber || '').trim();

    const nextName = name || req.body.productName || asset.name;
    const nextDescription = description || req.body.productDescription || asset.description;
    const nextSerial = serialNumber || req.body.productSerialNumber || asset.serialNumber;
    const nextWarranty = warrantyExpiry ?? req.body.warrantyDate ?? asset.warrantyExpiry;

    if (nextName) {
      asset.name = nextName;
      asset.productName = nextName;
    }
    if (assetId !== undefined && assetId) {
      asset.assetId = assetId;
    }
    if (category !== undefined) asset.category = category;
    if (productModel !== undefined) asset.productModel = productModel;
    if (nextSerial) {
      asset.serialNumber = nextSerial;
      asset.productSerialNumber = nextSerial;
    }
    if (manufacturer !== undefined) asset.manufacturer = manufacturer;
    if (location !== undefined) asset.location = location;
    if (quantity !== undefined) {
      asset.quantity = Number(quantity);
      asset.availableQuantity = Math.min(asset.availableQuantity ?? asset.quantity, Number(quantity));
    }
    if (minStockLevel !== undefined) asset.minStockLevel = minStockLevel;
    if (purchaseDate !== undefined) asset.purchaseDate = purchaseDate;
    if (nextWarranty !== undefined) {
      asset.warrantyExpiry = nextWarranty;
      asset.warrantyDate = nextWarranty;
    }
    if (nextDescription !== undefined) {
      asset.description = nextDescription;
      asset.productDescription = nextDescription;
    }
    if (inwardDate !== undefined) asset.inwardDate = inwardDate;
    if (invoiceNumber !== undefined) asset.invoiceNumber = invoiceNumber;
    if (vendorName !== undefined) asset.vendorName = vendorName;
    if (inwardType) asset.inwardType = inwardType;
    if (customerName !== undefined) asset.customerName = String(customerName || '').trim();
    if (documentNumber !== undefined) asset.documentNumber = String(documentNumber || '').trim();
    if (rentStartDate !== undefined) asset.rentStartDate = String(rentStartDate || '').trim();
    if (rentEndDate !== undefined) asset.rentEndDate = String(rentEndDate || '').trim();

    let newStatusNormalized = null;
    const previousNormalizedStatus = normalizeAssetStatus(previousStatus);
    const updatedRentEndDate = String(asset.rentEndDate || '').trim();

    if (status !== undefined) {
      newStatusNormalized = normalizeAssetStatus(status);
      if (newStatusNormalized !== previousNormalizedStatus) {
        asset.status = newStatusNormalized;
      }
    }

    const isAutoReturnByEndDate =
      previousNormalizedStatus === 'rented' &&
      !originalRentEndDate &&
      !newStatusNormalized &&
      updatedRentEndDate !== '';

    if (newStatusNormalized === 'available' || isAutoReturnByEndDate) {
      if (previousNormalizedStatus === 'rented') {
        asset.customerName = '';
        asset.rentStartDate = '';
        asset.rentEndDate = '';
        asset.documentNumber = '';
        // When returning a rented serial asset, ensure availableQuantity reflects the returned items (default 1)
        const returnedQty = Number(req.body.quantity) || 1;
        asset.availableQuantity = Math.max(Number(asset.availableQuantity ?? 0), returnedQty);
      }
      if (newStatusNormalized === 'available') {
        asset.status = 'available';
      }
      if (isAutoReturnByEndDate) {
        asset.status = 'available';
      }
    }

    // Build an atomic update payload and persist via findByIdAndUpdate to avoid
    // triggering unrelated document validation errors during save (eg. enum mismatches).
    const updatePayload = {};
    const allowedFields = [
      'name', 'productName', 'assetId', 'category', 'productModel',
      'serialNumber', 'productSerialNumber', 'manufacturer', 'location',
      'quantity', 'availableQuantity', 'minStockLevel', 'price', 'purchaseDate',
      'warrantyExpiry', 'warrantyDate', 'description', 'productDescription',
      'inwardDate', 'invoiceNumber', 'vendorName', 'inwardType', 'customerName',
      'documentNumber', 'rentStartDate', 'rentEndDate', 'status'
    ];

    for (const f of allowedFields) {
      if (asset[f] !== undefined) updatePayload[f] = asset[f];
    }

    // If this operation is an automatic return by providing rentEndDate on a rented asset,
    // ensure we update the latest RENT_OUT movement first, then mark the asset available
    // and set availableQuantity so it appears in In Stock.
    // If the client supplied a rentEndDate and the asset was rented, treat this as a return.
    const providedRentEndDate = String(rentEndDate || '').trim();
    const shouldAutoReturn = (previousNormalizedStatus === 'rented' && providedRentEndDate !== '') || isAutoReturnByEndDate || (newStatusNormalized === 'available' && previousNormalizedStatus === 'rented');

    if (shouldAutoReturn) {
      try {
        await updateLatestRentOutMovement(asset._id, {
          rentEndDate: String(rentEndDate || '').trim(),
          invoiceNumber: String(invoiceNumber || asset.invoiceNumber || ''),
          documentNumber: String(documentNumber || asset.documentNumber || ''),
          customerName: String(asset.customerName || ''),
          remarks: String(req.body.remarks || ''),
          price: price !== undefined ? Number(price) : undefined,
        });
      } catch (err) {
        console.error('Non-fatal: failed to update latest RENT_OUT movement before returning asset:', err);
      }

      updatePayload.status = 'available';
      updatePayload.customerName = '';
      updatePayload.rentStartDate = '';
      updatePayload.rentEndDate = '';
      updatePayload.documentNumber = '';
      // Set availableQuantity to the returned quantity so the asset appears back In Stock.
      // Prefer an explicit returned quantity from the request, fallback to 1 for serial assets.
      const returnedQty = Number(req.body.quantity) || 1;
      updatePayload.availableQuantity = Math.max(Number(asset.availableQuantity ?? 0), returnedQty);
    }

    // Always persist the minimal payload with validators off to avoid unrelated failures
    let updatedAsset;
    try {
      updatedAsset = await Asset.findByIdAndUpdate(req.params.id, updatePayload, { new: true, runValidators: false });
      if (!updatedAsset) return res.status(500).json({ error: 'Failed to save asset during update' });
      Object.assign(asset, updatedAsset.toObject ? updatedAsset.toObject() : updatedAsset);
    } catch (err) {
      console.error('Failed to persist asset update via findByIdAndUpdate:', err);
      return res.status(500).json({ error: 'Failed to save asset during update' });
    }

    if (normalizeAssetStatus(asset.status) === 'sold' && price !== undefined) {
      const soldMovement = await AssetMovement.findOne({
        assetId: asset._id,
        type: { $in: ['SOLD', 'SOLD_OUT'] },
      }).sort({ movementDate: -1, createdAt: -1 });

      if (soldMovement) {
        soldMovement.price = Number(price);
        if (remarks !== undefined) soldMovement.remarks = String(remarks || '').trim();
        await soldMovement.save();
      }
    }

    // If status changed, create a corresponding movement
    try {
      const statusChangedTo = newStatusNormalized || (shouldAutoReturn ? 'available' : null);
      if (statusChangedTo && statusChangedTo !== previousNormalizedStatus) {
        const from = previousNormalizedStatus;
        const to = statusChangedTo;
        let movementType = null;

        if (from === 'available' && to === 'rented') movementType = 'RENT_OUT';
        else if (from === 'rented' && to === 'available') movementType = 'RETURNED';
        else if (to === 'sold') movementType = 'SOLD_OUT';
        else if (to === 'damaged') movementType = 'DAMAGED';
        else if (to === 'outwarding') movementType = 'OUTWARD';

        if (movementType) {
          const movementQty = Number(req.body.quantity) || asset.quantity || 1;
            // If returning from a rental, update the latest RENT_OUT movement with the provided rentEndDate
            if (movementType === 'RETURNED' && previousNormalizedStatus === 'rented') {
              try {
                await updateLatestRentOutMovement(asset._id, {
                  rentEndDate: String(rentEndDate || '').trim(),
                  invoiceNumber: String(invoiceNumber || asset.invoiceNumber || ''),
                  documentNumber: String(documentNumber || asset.documentNumber || ''),
                  customerName: String(originalCustomerName || asset.customerName || ''),
                  remarks: String(req.body.remarks || ''),
                  price: price !== undefined ? Number(price) : undefined,
                })
              } catch (err) {
                console.error('Failed to update latest RENT_OUT movement before creating RETURNED movement:', err)
              }
            }
          const movement = new AssetMovement({
            assetId: asset._id,
            assetName: asset.name,
            type: movementType,
            quantity: movementQty,
            serialNumber: asset.serialNumber || asset.productSerialNumber || '',
            productSerialNumber: asset.productSerialNumber || asset.serialNumber || '',
            productModel: asset.productModel || '',
            vendorName: asset.vendorName || '',
            productName: asset.productName || asset.name || '',
            productDescription: asset.productDescription || asset.description || '',
            price: Number(asset.price) || 0,
            documentNumber:
              newStatusNormalized === 'available' && normalizeAssetStatus(previousStatus) === 'rented'
                ? originalDocumentNumber
                : String(asset.documentNumber || ''),
            rentStartDate:
              newStatusNormalized === 'available' && normalizeAssetStatus(previousStatus) === 'rented'
                ? originalRentStartDate
                : String(asset.rentStartDate || '').trim(),
            rentEndDate:
              newStatusNormalized === 'available' && normalizeAssetStatus(previousStatus) === 'rented'
                ? originalRentEndDate
                : String(asset.rentEndDate || '').trim(),
            invoiceNumber: String(asset.invoiceNumber || ''),
            customerName:
              newStatusNormalized === 'available' && normalizeAssetStatus(previousStatus) === 'rented'
                ? originalCustomerName
                : String(asset.customerName || '').trim(),
            remarks: String(req.body.remarks || ''),
            description: `Status changed from ${from} to ${to}`,
            performedBy: req.body.performedBy || 'System',
            reference: invoiceNumber || '',
          });
          await movement.save();
        }
      } else if (normalizeAssetStatus(asset.status) === 'rented') {
        await updateLatestRentOutMovement(asset._id, {
          customerName: asset.customerName,
          documentNumber: asset.documentNumber,
          invoiceNumber: asset.invoiceNumber,
          rentStartDate: asset.rentStartDate,
          rentEndDate: asset.rentEndDate,
          remarks: req.body.remarks,
          price: price !== undefined ? Number(price) : undefined,
          productName: asset.productName,
          productDescription: asset.productDescription,
          productModel: asset.productModel,
          productSerialNumber: asset.productSerialNumber,
        })
      }
    } catch (err) {
      console.error('Failed to record status change movement:', err);
    }

    res.json({
      ...toAssetPayload(asset),
      availableQuantity: asset.availableQuantity ?? asset.quantity,
    });
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// DELETE /api/inventory/assets/bulk - Delete selected assets and their movements.
router.delete('/assets/bulk', async (req, res) => {
  try {
    const bulkUploadId = String(req.body?.bulkUploadId || '').trim();
    const assetIds = Array.isArray(req.body?.assetIds)
      ? [...new Set(req.body.assetIds.map((id) => String(id || '').trim()).filter(Boolean))]
      : [];

    if (!assetIds.length && !bulkUploadId) {
      return res.status(400).json({ error: 'Asset IDs or a Bulk Upload ID is required' });
    }

    const assets = await Asset.find(
      bulkUploadId ? { bulkUploadId } : { _id: { $in: assetIds } }
    ).select('_id');
    const foundIds = assets.map((asset) => asset._id);
    if (!bulkUploadId && foundIds.length !== assetIds.length) {
      return res.status(404).json({ error: 'One or more selected assets were not found' });
    }
    if (!foundIds.length) return res.status(404).json({ error: 'No assets found for the requested deletion' });

    await AssetMovement.deleteMany({ assetId: { $in: foundIds } });
    const result = await Asset.deleteMany({ _id: { $in: foundIds } });

    return res.json({ message: `${result.deletedCount} assets deleted successfully`, count: result.deletedCount });
  } catch (error) {
    console.error('Error deleting selected assets:', error);
    return res.status(500).json({ error: 'Failed to delete selected assets' });
  }
});

// DELETE /api/inventory/assets/:id - Delete asset
router.delete('/assets/:id', async (req, res) => {
  try {
    let asset = await Asset.findById(req.params.id);
    
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    await AssetMovement.deleteMany({ assetId: asset._id });
    await Asset.deleteOne({ _id: asset._id });
    
    res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// GET /api/inventory/filter-options - Get available filters
router.get('/filter-options', async (req, res) => {
  try {
    const categories = await Asset.distinct('category');
    const locations = await Asset.distinct('location');
    const statuses = ['available', 'rented', 'sold', 'returned', 'damaged', 'lost'];
    
    res.json({
      categories: categories.filter(Boolean),
      locations: locations.filter(Boolean),
      statuses,
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({ error: 'Failed to fetch filter options' });
  }
});

export default router;
