// src/index.js
// Money Flow Bank — Main Application Entry Point

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const routes = require('./routes');
const nibss = require('./services/nibssService');
const db = require('./models/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too Many Requests', message: 'Too many requests. Try again in 15 minutes.' }
});
app.use('/api/', limiter);

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    bank: 'Money Flow Bank',
    status: 'online',
    version: '1.0.0',
    database: 'MongoDB Atlas',
    endpoints: {
      register: 'POST /api/customers/register',
      login: 'POST /api/customers/login',
      profile: 'GET /api/customers/profile',
      createAccount: 'POST /api/accounts/create',
      linkAccount: 'POST /api/accounts/link',
      balance: 'GET /api/accounts/balance',
      nameEnquiry: 'GET /api/accounts/name-enquiry/:accountNumber',
      transfer: 'POST /api/transactions/transfer',
      history: 'GET /api/transactions/history',
      txStatus: 'GET /api/transactions/status/:transactionId',
      adminLogin: 'POST /api/admin/nibss/login',
      insertBVN: 'POST /api/admin/kyc/bvn',
      insertNIN: 'POST /api/admin/kyc/nin',
      status: 'GET /api/admin/status'
    }
  });
});

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: `Route ${req.method} ${req.path} does not exist` });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: 'Something went wrong.' });
});

async function startServer() {
  // Connect to MongoDB Atlas first
  await connectDB();

  // Load NIBSS credentials and auto-login
  const savedCreds = db.getNibssCredentials();
  if (process.env.NIBSS_API_KEY) {
    nibss.setCredentials({
      apiKey: process.env.NIBSS_API_KEY,
      apiSecret: process.env.NIBSS_API_SECRET,
      bankCode: process.env.NIBSS_BANK_CODE,
      bankName: process.env.NIBSS_BANK_NAME,
    });
    try {
      await nibss.login();
      console.log('✅ NIBSS auto-login successful');
    } catch (e) {
      console.log('⚠️  NIBSS auto-login failed:', e.message);
    }
  }

  app.listen(PORT, () => {
    console.log('\n ================================');
    console.log('   MONEY FLOW BANK');
    console.log('   Digital Banking System v1.0.0');
    console.log('   Database: MongoDB Atlas');
    console.log('================================');
    console.log(`\n✅ Server running on http://localhost:${PORT}`);
    console.log(`\nAdmin: Happiness Ogbonnaya`);
    console.log(`Email: ${process.env.ADMIN_EMAIL}\n`);
  });
}

startServer();

module.exports = app;
