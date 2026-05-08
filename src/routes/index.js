// src/routes/index.js
// All API routes for Money Flow Bank

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');

// Controllers
const onboarding = require('../controllers/onboardingController');
const accounts = require('../controllers/accountController');
const transactions = require('../controllers/transactionController');
const admin = require('../controllers/adminController');

// ─── Public Routes (no auth needed) ──────────────────────────────────────────

// Customer auth
router.post('/customers/register', onboarding.registerCustomer);  // Onboard + KYC
router.post('/customers/login', onboarding.loginCustomer);        // Login

// ─── Protected Customer Routes (JWT required) ─────────────────────────────────

// Customer profile
router.get('/customers/profile', authenticate, onboarding.getProfile);

// Account management
router.post('/accounts/create', authenticate, accounts.createAccount);
router.get('/accounts/details', authenticate, accounts.getAccountDetails);
router.post('/accounts/link', authenticate, accounts.linkExistingAccount);
router.get('/accounts/balance', authenticate, accounts.getBalance);
router.get('/accounts/name-enquiry/:accountNumber', authenticate, accounts.nameEnquiry);

// Transactions
router.post('/transactions/transfer', authenticate, transactions.initiateTransfer);
router.get('/transactions/history', authenticate, transactions.getTransactionHistory);
router.get('/transactions/status/:transactionId', authenticate, transactions.getTransactionStatus);

// ─── Admin Routes (bank internal operations) ──────────────────────────────────

// NIBSS setup
router.post('/admin/nibss/onboard', admin.onboardBank);    // Register bank on NIBSS
router.post('/admin/nibss/login', admin.nibssLogin);        // Get NIBSS JWT token

// KYC data seeding (admin only - creates test BVN/NIN records)
router.post('/admin/kyc/bvn', admin.insertBVN);
router.post('/admin/kyc/nin', admin.insertNIN);

// System status
router.get('/admin/status', admin.getStatus);

module.exports = router;
