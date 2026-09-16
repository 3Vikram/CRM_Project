const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const customerRoutes = require('./routes/customerRoutes');
const contactRoutes = require('./routes/contactRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const mailCampaignRoutes = require('./routes/mailCampaignRoutes');
const leadRoutes = require('./routes/leadRoutes');
const activityRoutes = require('./routes/activityRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const locationRoutes = require('./routes/locationRoutes');
const companyProfileRoutes = require('./routes/companyProfileRoutes');
const opfRoutes = require('./routes/opfRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const Activity = require('./models/Activity');
const { processScheduledCampaigns } = require('./controllers/mailCampaignController');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/customers', customerRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/mail-campaigns', mailCampaignRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/company-profiles', companyProfileRoutes);
app.use('/api/opf', opfRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/locations', locationRoutes);

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
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm_db';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    return Activity.collection.dropIndex('activityId_1').catch((error) => {
      if (error?.codeName !== 'IndexNotFound' && error?.code !== 27) throw error;
    }).then(() => Activity.syncIndexes()).then(() => {
      console.log('MongoDB connected');
    });
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      const serverUrl = `http://127.0.0.1:${PORT}`;
      const publicApiUrl = process.env.TRACKING_BASE_URL || process.env.PUBLIC_API_URL || process.env.APP_URL || process.env.BACKEND_URL || process.env.BASE_URL || serverUrl;
      void processScheduledCampaigns(publicApiUrl);
      setInterval(() => void processScheduledCampaigns(publicApiUrl), 60 * 1000);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
