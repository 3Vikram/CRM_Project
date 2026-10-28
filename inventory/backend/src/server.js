import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(serverDirectory, '../.env') });

const MONGO_URI = process.env.MONGO_URI?.trim();
if (!MONGO_URI) {
  console.error('[Inventory] Missing required MONGO_URI in inventory/backend/.env');
  process.exit(1);
}

const [
  { default: inventoryRoutes },
  { default: inventoryAuthRoutes, requireInventoryAuth, requireInventoryProductReadAuth },
  { default: inventoryEmployeeRoutes },
  { default: assetRoutes },
  { default: productRoutes },
  { default: deliveryChallanRoutes },
  { default: returnedChallanRoutes },
  { default: dailyEmailRoutes },
  { default: accessoriesRoutes },
  { initializeEmailService },
  { startEmailScheduler, stopEmailScheduler },
] = await Promise.all([
  import('./routes/inventory.js'),
  import('./routes/inventoryAuth.js'),
  import('./routes/inventoryEmployees.js'),
  import('./routes/asset.js'),
  import('./routes/products.js'),
  import('./routes/deliveryChallans.js'),
  import('./routes/returnedChallans.js'),
  import('./routes/dailyEmail.js'),
  import('./routes/accessories.js'),
  import('./services/emailService.js'),
  import('./services/emailScheduler.js'),
]);

const app = express();
const PORT = process.env.PORT || 5000;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 30_000;

app.use(cors());
app.use(express.json());
app.use('/uploads/documents', express.static(path.resolve(serverDirectory, '../uploads/documents')));
app.use('/uploads/products', express.static(path.resolve(serverDirectory, '../uploads/products')));

app.use('/api/inventory/auth', inventoryAuthRoutes);
app.use('/api/inventory', requireInventoryAuth);
app.use('/api/inventory/employees', inventoryEmployeeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/assets', requireInventoryAuth);
app.use('/api/products', requireInventoryProductReadAuth);
app.use('/api/delivery-challans', requireInventoryAuth);
app.use('/api/returned-challans', requireInventoryAuth);
app.use('/api/daily-email', requireInventoryAuth);
app.use('/api/accessories', requireInventoryAuth);
app.use('/api/assets', assetRoutes);
app.use('/api/products', productRoutes);
app.use('/api/delivery-challans', deliveryChallanRoutes);
app.use('/api/returned-challans', returnedChallanRoutes);
app.use('/api/daily-email', dailyEmailRoutes);
app.use('/api/accessories', accessoriesRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

let isShuttingDown = false;
let httpServer = null;
let retryTimer = null;
let resolveRetry = null;

const sanitizeMongoError = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi, '[MongoDB URI]')
    .replace(/(password|passwd|pwd)\s*[:=]\s*[^,\s;]+/gi, '$1=[REDACTED]');
};

mongoose.connection.on('disconnected', () => {
  if (!isShuttingDown) console.warn('[Inventory] MongoDB disconnected; waiting for driver reconnection.');
});
mongoose.connection.on('reconnected', () => {
  if (!isShuttingDown) console.info('[Inventory] MongoDB reconnected.');
});
mongoose.connection.on('error', (error) => {
  if (!isShuttingDown) console.error('[Inventory] MongoDB connection event:', sanitizeMongoError(error));
});

const waitForRetry = (delay) => new Promise((resolve) => {
  retryTimer = setTimeout(() => {
    retryTimer = null;
    resolveRetry = null;
    resolve();
  }, delay);
  resolveRetry = () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    resolveRetry = null;
    resolve();
  };
});

const cancelRetry = () => {
  const resolve = resolveRetry;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  resolveRetry = null;
  resolve?.();
};

const retryUntilReady = async (label, operation) => {
  let attempt = 0;
  while (!isShuttingDown) {
    attempt += 1;
    console.info(`[Inventory] ${label} attempt ${attempt}.`);
    try {
      return await operation();
    } catch (error) {
      const delay = Math.min(RETRY_BASE_DELAY_MS * (2 ** Math.min(attempt - 1, 5)), RETRY_MAX_DELAY_MS);
      console.error(`[Inventory] ${label} failed: ${sanitizeMongoError(error)}. Retrying in ${delay}ms.`);
      await waitForRetry(delay);
    }
  }
  return null;
};

const shutdown = async (reason, exitCode = 0) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  process.exitCode = exitCode;
  console.info(`[Inventory] Shutting down (${reason}).`);
  cancelRetry();
  stopEmailScheduler();

  try {
    if (httpServer?.listening) {
      await new Promise((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
    }
  } catch (error) {
    console.error('[Inventory] HTTP server shutdown error:', error.message);
    process.exitCode = 1;
  }
  try {
    await mongoose.disconnect();
  } catch (error) {
    console.error('[Inventory] MongoDB shutdown error:', sanitizeMongoError(error));
    process.exitCode = 1;
  }
  console.info('[Inventory] Shutdown complete.');
};

process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });

const start = async () => {
  await retryUntilReady('MongoDB startup connection', () => mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  }));
  if (isShuttingDown) return;
  console.info('[Inventory] MongoDB connection established.');

  const emailServiceReady = initializeEmailService();
  if (emailServiceReady) {
    await retryUntilReady('Daily email scheduler initialization', startEmailScheduler);
    if (isShuttingDown) return;
  }

  httpServer = app.listen(PORT, () => {
    console.log(`✓ Server running on http://0.0.0.0:${PORT}`);
  });
  httpServer.on('error', (error) => {
    console.error('[Inventory] HTTP server error:', error.message);
    void shutdown('HTTP server error', 1);
  });
};

void start().catch((error) => {
  console.error('[Inventory] Startup failed:', sanitizeMongoError(error));
  void shutdown('startup failure', 1);
});
