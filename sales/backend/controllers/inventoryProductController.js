const { createHmac } = require('node:crypto');

const createInventoryServiceToken = (secret) => {
  const payload = Buffer.from(JSON.stringify({
    exp: Date.now() + 60_000,
    service: 'sales-quotation-products',
    audience: 'inventory-api',
    scope: 'products:read',
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

const getInventoryProductOptions = async (_req, res) => {
  const secret = process.env.INVENTORY_PRODUCTS_SERVICE_SECRET;
  if (!secret || secret.length < 32) {
    console.error('[Sales] Inventory product service is not configured: INVENTORY_PRODUCTS_SERVICE_SECRET is missing or too short.');
    return res.status(503).json({ success: false, message: 'Inventory product service authentication is not configured.' });
  }

  const configuredBaseUrl = process.env.INVENTORY_API_URL?.trim();
  if (!configuredBaseUrl) {
    console.error('[Sales] Inventory product service is not configured: INVENTORY_API_URL is missing.');
    return res.status(503).json({ success: false, message: 'Inventory API URL is not configured.' });
  }

  try {
    const baseUrl = new URL(configuredBaseUrl);
    if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
      console.error('[Sales] Inventory product service is not configured: INVENTORY_API_URL must be an HTTP(S) origin without credentials.');
      return res.status(503).json({ success: false, message: 'Inventory API URL is invalid.' });
    }
    baseUrl.pathname = baseUrl.pathname.replace(/\/+$/, '');
    baseUrl.search = '';
    baseUrl.hash = '';

    const response = await fetch(`${baseUrl.toString().replace(/\/+$/, '')}/api/products`, {
      headers: { Authorization: `Bearer ${createInventoryServiceToken(secret)}` },
      signal: AbortSignal.timeout(7000),
    });

    if (!response.ok) {
      console.error(`[Sales] Inventory product service request failed with HTTP ${response.status}.`);
      return res.status(502).json({ success: false, message: 'Unable to load Inventory products. Check that the Inventory service is running and configured.' });
    }

    const products = await response.json();
    if (!Array.isArray(products)) {
      console.error('[Sales] Inventory product service returned an invalid product list.');
      return res.status(502).json({ success: false, message: 'Inventory returned an invalid product list.' });
    }

    const options = products
      .filter((product) => product && product.isActive !== false && typeof product.productName === 'string')
      .map((product) => ({
        id: String(product.id || product._id || ''),
        productName: product.productName,
        description: typeof product.description === 'string' ? product.description : '',
        defaultPrice: Number(product.defaultPrice) || 0,
        price: Number(product.price) || 0,
        hsnSac: typeof product.hsnSac === 'string' ? product.hsnSac : '',
        gst: typeof product.gst === 'string' ? product.gst : '',
        isActive: product.isActive !== false,
      }));

    return res.json(options);
  } catch (error) {
    console.error('[Sales] Inventory product request failed:', error.message);
    return res.status(502).json({ success: false, message: 'Unable to reach the Inventory product service.' });
  }
};

module.exports = { getInventoryProductOptions };
