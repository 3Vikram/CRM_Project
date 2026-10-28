const dns = require("node:dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const MONGO_URI = process.env.MONGO_URI?.trim();
if (!MONGO_URI) {
  console.error('[Sales] Missing required MONGO_URI in sales/backend/.env');
  process.exit(1);
}

const customerRoutes = require('./routes/customerRoutes');
const customerMappingRoutes = require('./routes/customerMappingRoutes');
const contactRoutes = require('./routes/contactRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const mailCampaignRoutes = require('./routes/mailCampaignRoutes');
const leadRoutes = require('./routes/leadRoutes');
const activityRoutes = require('./routes/activityRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const locationRoutes = require('./routes/locationRoutes');
const companyProfileRoutes = require('./routes/companyProfileRoutes');
const opfRoutes = require('./routes/opfRoutes');
const { getInventoryOPFOptions } = require('./controllers/opfController');
const employeeRoutes = require('./routes/employeeRoutes');
const authRoutes = require('./routes/authRoutes');
const reportRoutes = require('./routes/reportRoutes');
const Activity = require('./models/Activity');
const { processScheduledCampaigns } = require('./controllers/mailCampaignController');
const { processScheduledRenewalReminders } = require('./services/renewalReminderService');
const { authMiddleware, inventoryAuthMiddleware, requirePermission, requireAnyPermission, requireFullAccess } = require('./middleware/authMiddleware');
const { getInventorySupplierOptions } = require('./controllers/supplierController');
const { getInventoryCustomerOptions } = require('./controllers/customerController');
const { getInventoryProductOptions } = require('./controllers/inventoryProductController');

const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/customers/inventory-options', inventoryAuthMiddleware, getInventoryCustomerOptions);
app.get(
  '/api/quotations/inventory-products',
  authMiddleware,
  requireAnyPermission([
    { moduleName: 'quotations', action: 'view' },
    { moduleName: 'quotations', action: 'create' },
  ]),
  getInventoryProductOptions
);
app.use('/api/customers', authMiddleware, requirePermission('customers'), customerRoutes);
app.use('/api/customer-mapping', authMiddleware, requireFullAccess, customerMappingRoutes);
app.use('/api/contacts', authMiddleware, requirePermission('contacts'), contactRoutes);
app.get('/api/suppliers/inventory-options', inventoryAuthMiddleware, getInventorySupplierOptions);
console.info('Registered GET /api/suppliers/inventory-options with Inventory authentication.');
app.use('/api/suppliers', authMiddleware, requirePermission('suppliers'), supplierRoutes);
app.use('/api/mail-campaigns', mailCampaignRoutes);
app.use('/api/leads', authMiddleware, leadRoutes);
app.use('/api/activities', authMiddleware, requirePermission('activities'), activityRoutes);
app.use('/api/calendar', authMiddleware, requirePermission('calendar'), calendarRoutes);
app.use('/api/company-profiles', authMiddleware, requirePermission('companyProfiles'), companyProfileRoutes);
app.get('/api/opf/inventory-options', inventoryAuthMiddleware, getInventoryOPFOptions);
app.get('/api/opf/inventory-options/:id', inventoryAuthMiddleware, getInventoryOPFOptions);
app.use('/api/opf', authMiddleware, requirePermission('opf'), opfRoutes);
app.use('/api/employees', authMiddleware, employeeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reports', authMiddleware, requirePermission('reports'), reportRoutes);
app.use('/api/locations', authMiddleware, locationRoutes);

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError || error?.message?.startsWith('Unsupported file type:')) {
    return res.status(400).json({ success: false, message: 'Campaign file upload is invalid or exceeds the allowed size.' });
  }
  console.error('Unhandled API error:', error);
  return res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const PORT = process.env.PORT || 5001;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 30_000;
let isShuttingDown = false;
let httpServer = null;
let campaignProcessingInterval = null;
let retryTimer = null;
let resolveRetry = null;

const sanitizeMongoError = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi, '[MongoDB URI]')
    .replace(/(password|passwd|pwd)\s*[:=]\s*[^,\s;]+/gi, '$1=[REDACTED]');
};

mongoose.connection.on('disconnected', () => {
  if (!isShuttingDown) console.warn('[Sales] MongoDB disconnected; waiting for driver reconnection.');
});
mongoose.connection.on('reconnected', () => {
  if (!isShuttingDown) console.info('[Sales] MongoDB reconnected.');
});
mongoose.connection.on('error', (error) => {
  if (!isShuttingDown) console.error('[Sales] MongoDB connection event:', sanitizeMongoError(error));
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
    console.info(`[Sales] ${label} attempt ${attempt}.`);
    try {
      return await operation();
    } catch (error) {
      const delay = Math.min(RETRY_BASE_DELAY_MS * (2 ** Math.min(attempt - 1, 5)), RETRY_MAX_DELAY_MS);
      console.error(`[Sales] ${label} failed: ${sanitizeMongoError(error)}. Retrying in ${delay}ms.`);
      await waitForRetry(delay);
    }
  }
  return null;
};

const runScheduledCampaigns = (publicApiUrl) => {
  void processScheduledCampaigns(publicApiUrl).catch((error) => {
    console.error('[Sales] Scheduled campaign processing failed:', sanitizeMongoError(error));
  });
};

const runScheduledRenewalReminders = () => {
  void processScheduledRenewalReminders().catch((error) => {
    console.error('[Sales] Scheduled renewal reminder processing failed:', sanitizeMongoError(error));
  });
};

const shutdown = async (reason, exitCode = 0) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  process.exitCode = exitCode;
  console.info(`[Sales] Shutting down (${reason}).`);
  cancelRetry();
  if (campaignProcessingInterval) clearInterval(campaignProcessingInterval);
  try {
    if (httpServer?.listening) {
      await new Promise((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
    }
  } catch (error) {
    console.error('[Sales] HTTP server shutdown error:', error.message);
    process.exitCode = 1;
  }
  try {
    await mongoose.disconnect();
  } catch (error) {
    console.error('[Sales] MongoDB shutdown error:', sanitizeMongoError(error));
    process.exitCode = 1;
  }
  console.info('[Sales] Shutdown complete.');
};

process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });

const initializeDatabase = async () => {
  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  });
  await Activity.collection.dropIndex('activityId_1').catch((error) => {
    if (error?.codeName !== 'IndexNotFound' && error?.code !== 27) throw error;
  });
  await Activity.syncIndexes();
  console.log('MongoDB connected');
};

const start = async () => {
  await retryUntilReady('MongoDB connection and index initialization', initializeDatabase);
  if (isShuttingDown) return;

  httpServer = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    const serverUrl = `http://0.0.0.0:${PORT}`;
    const publicApiUrl = process.env.TRACKING_BASE_URL || process.env.PUBLIC_API_URL || process.env.APP_URL || process.env.BACKEND_URL || process.env.BASE_URL || serverUrl;
    runScheduledCampaigns(publicApiUrl);
    runScheduledRenewalReminders();
    campaignProcessingInterval = setInterval(() => {
      runScheduledCampaigns(publicApiUrl);
      runScheduledRenewalReminders();
    }, 60 * 1000);
  });
  httpServer.on('error', (error) => {
    console.error('[Sales] HTTP server error:', error.message);
    void shutdown('HTTP server error', 1);
  });
};

void start().catch((error) => {
  console.error('[Sales] Startup failed:', sanitizeMongoError(error));
  void shutdown('startup failure', 1);
});
