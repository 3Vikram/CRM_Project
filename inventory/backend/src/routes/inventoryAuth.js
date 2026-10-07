import express from 'express';
import { createHmac, timingSafeEqual } from 'crypto';

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

const createToken = (secret) => {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + SESSION_DURATION_MS })
  ).toString('base64url');
  return `${payload}.${createSignature(payload, secret)}`;
};

const isValidToken = (token, secret) => {
  if (typeof token !== 'string') return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;

  const expectedSignature = createSignature(payload, secret);
  if (!safeEqual(signature, expectedSignature)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(data.exp) && data.exp > Date.now();
  } catch {
    return false;
  }
};

const configured = ({ email, password, secret }) =>
  Boolean(email && password && secret && secret.length >= 32);

router.post('/login', (req, res) => {
  const config = getAuthConfig();
  if (!configured(config)) {
    return res.status(503).json({ error: 'Inventory sign-in is not configured' });
  }

  const email =
    typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const validEmail = safeEqual(email, config.email);
  const validPassword = safeEqual(password, config.password);

  if (!validEmail || !validPassword) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  return res.json({ token: createToken(config.secret) });
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

  if (!isValidToken(token, config.secret)) {
    return res.status(401).json({ authenticated: false });
  }

  return res.json({ authenticated: true });
});

export default router;
