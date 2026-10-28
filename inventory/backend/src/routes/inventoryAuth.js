import express from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { InventoryEmployee } from '../models/InventoryEmployee.js';
import { verifyInventoryPassword } from '../utils/inventoryEmployeePassword.js';

const router = express.Router();
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

const getAuthConfig = () => ({
  email: process.env.INVENTORY_LOGIN_EMAIL?.trim().toLowerCase(),
  password: process.env.INVENTORY_LOGIN_PASSWORD,
  secret: process.env.INVENTORY_AUTH_SECRET,
});

const createSignature = (payload, secret) =>
  createHmac('sha256', secret).update(payload).digest('base64url');

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const createToken = (secret, claims = {}) => {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + SESSION_DURATION_MS, ...claims })
  ).toString('base64url');
  return `${payload}.${createSignature(payload, secret)}`;
};

const getTokenClaims = (token, secret) => {
  if (typeof token !== 'string') return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;

  const expectedSignature = createSignature(payload, secret);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(data.exp) && data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
};

const isValidToken = (token, secret) => Boolean(getTokenClaims(token, secret));

const configured = ({ email, password, secret }) =>
  Boolean(email && password && secret && secret.length >= 32);

export function requireInventoryAdmin(req, res, next) {
  const config = getAuthConfig();
  if (!configured(config)) {
    return res.status(503).json({ error: 'Inventory sign-in is not configured' });
  }

  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';
  const claims = getTokenClaims(token, config.secret);

  if (!claims) return res.status(401).json({ error: 'Inventory sign-in required.' });
  if (claims.role && claims.role !== 'admin') {
    return res.status(403).json({ error: 'Inventory administrator access required.' });
  }

  return next();
}

export async function requireInventoryAuth(req, res, next) {
  const config = getAuthConfig();
  if (!configured(config)) {
    return res.status(503).json({ error: 'Inventory sign-in is not configured' });
  }

  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';
  const claims = getTokenClaims(token, config.secret);

  if (!claims) return res.status(401).json({ error: 'Inventory sign-in required.' });
  if (claims.role === 'employee') {
    try {
      const employee = await InventoryEmployee.findById(claims.employeeId);
      if (!employee?.isActive) {
        return res.status(401).json({ error: 'Inventory sign-in required.' });
      }
    } catch {
      return res.status(500).json({ error: 'Unable to verify Inventory session.' });
    }
  } else if (claims.role && claims.role !== 'admin') {
    return res.status(401).json({ error: 'Inventory sign-in required.' });
  }

  return next();
}

export function requireInventoryProductReadAuth(req, res, next) {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';
  const [payload, signature, extra] = token.split('.');
  let claims = null;

  if (payload && signature && !extra) {
    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      claims = null;
    }
  }

  if (claims?.service === 'sales-quotation-products') {
    const secret = process.env.INVENTORY_PRODUCTS_SERVICE_SECRET;
    if (!secret || secret.length < 32) {
      console.error('[Inventory] Product service authentication is not configured: INVENTORY_PRODUCTS_SERVICE_SECRET is missing or too short.');
      return res.status(503).json({ error: 'Inventory product service authentication is not configured.' });
    }

    const expected = Buffer.from(createSignature(payload, secret));
    const received = Buffer.from(signature || '');
    const validSignature = expected.length === received.length && timingSafeEqual(expected, received);
    const validScope = req.method === 'GET' && req.path === '/'
      && claims.audience === 'inventory-api'
      && claims.scope === 'products:read'
      && Number.isFinite(claims.exp)
      && claims.exp > Date.now();

    if (!validSignature || !validScope) {
      console.warn('[Inventory] Rejected invalid or out-of-scope product service request.');
      return res.status(401).json({ error: 'Inventory product service authentication required.' });
    }

    req.inventoryService = claims.service;
    return next();
  }

  return requireInventoryAuth(req, res, next);
}

router.post('/login', async (req, res) => {
  const config = getAuthConfig();
  if (!configured(config)) {
    return res.status(503).json({ error: 'Inventory sign-in is not configured' });
  }

  const email =
    typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const validEmail = safeEqual(email, config.email);
  const validPassword = safeEqual(password, config.password);

  if (validEmail && validPassword) {
    return res.json({
      token: createToken(config.secret, { role: 'admin', email: config.email }),
    });
  }

  try {
    const employee = await InventoryEmployee.findOne({ email }).select('+passwordHash');
    const validEmployee = employee?.isActive
      ? await verifyInventoryPassword(password, employee.passwordHash)
      : false;

    if (!employee || !validEmployee) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    return res.json({
      token: createToken(config.secret, { role: 'employee', employeeId: employee.id }),
    });
  } catch {
    return res.status(500).json({ error: 'Unable to sign in. Please try again.' });
  }
});

router.get('/session', (req, res) => {
  const config = getAuthConfig();
  if (!configured(config)) {
    return res.status(503).json({ error: 'Inventory sign-in is not configured' });
  }

  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';

  const claims = getTokenClaims(token, config.secret);
  if (!claims) {
    return res.status(401).json({ authenticated: false });
  }

  if (claims.role === 'employee') {
    return InventoryEmployee.findById(claims.employeeId)
      .then((employee) => {
        if (!employee?.isActive) {
          return res.status(401).json({ authenticated: false });
        }
        return res.json({
          authenticated: true,
          user: {
            id: employee.id,
            name: employee.employeeName,
            email: employee.email,
            role: 'employee',
          },
        });
      })
      .catch(() => res.status(500).json({ error: 'Unable to verify Inventory session.' }));
  }

  return res.json({
    authenticated: true,
    user: {
      id: 'admin',
      email: config.email,
      role: 'admin',
    },
  });
});

export default router;
