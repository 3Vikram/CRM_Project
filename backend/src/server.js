import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import inventoryRoutes from './routes/inventory.js';
import assetRoutes from './routes/asset.js';
import productRoutes from './routes/products.js';
import deliveryChallanRoutes from './routes/deliveryChallans.js';
import dailyEmailRoutes from './routes/dailyEmail.js';
import { DailyEmailSettings } from './models/DailyEmailSettings.js';
import { EmailHistory } from './models/EmailHistory.js';
import { initializeEmailService } from './services/emailService.js';
import { startEmailScheduler } from './services/emailScheduler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/3vikram-crm';

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('✓ Connected to MongoDB');
  })
  .catch((err) => {
    console.error('✗ MongoDB connection error:', err);
    process.exit(1);
  });

// Initialize email service
const emailServiceReady = initializeEmailService();

// Start email scheduler if email service is configured
if (emailServiceReady) {
  startEmailScheduler().catch((err) => {
    console.error('✗ Error starting email scheduler:', err.message);
  });
}

// Routes
app.use('/api/inventory', inventoryRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/products', productRoutes);
app.use('/api/delivery-challans', deliveryChallanRoutes);
app.use('/api/daily-email', dailyEmailRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
});
