// src/controllers/accountController.js
const db = require('../models/database');
const nibss = require('../services/nibssService');

async function createAccount(req, res) {
  try {
    const customerId = req.customer.id;
    const customer = await db.findCustomerById(customerId);
    if (!customer) return res.status(404).json({ error: 'Not Found', message: 'Customer not found' });
    if (!customer.kycVerified) return res.status(403).json({ error: 'Forbidden', message: 'KYC verification required.' });

    if (customer.hasAccount) {
      const existingAccount = await db.findAccountByCustomerId(customer._id || customerId);
      return res.status(409).json({ error: 'Conflict', message: 'You already have a bank account.', account: { accountNumber: existingAccount?.accountNumber, bankName: existingAccount?.bankName } });
    }

    const kycID = customer.bvn || customer.nin;
    const kycType = customer.kycType;
    const dob = customer.dob || req.body.dob;

    if (!dob) return res.status(400).json({ error: 'Bad Request', message: 'Please provide dob in request body.' });

    const nibssAccount = await nibss.createAccount(kycType, kycID, dob);

    const account = await db.createAccount({
      customerId: customer._id || customerId,
      accountNumber: nibssAccount.accountNumber,
      bankCode: nibssAccount.bankCode,
      bankName: nibssAccount.bankName,
      balance: nibssAccount.balance || 15000
    });

    return res.status(201).json({
      message: 'Bank account created successfully!',
      account: { accountNumber: account.accountNumber, bankCode: account.bankCode, bankName: account.bankName, balance: account.balance, currency: 'NGN', owner: `${customer.firstName} ${customer.lastName}` }
    });
  } catch (error) {
    console.error('Account creation error:', error);
    if (error.message?.includes('already linked')) {
      return res.status(409).json({ error: 'Conflict', message: 'This BVN/NIN is already linked to an account on NIBSS.' });
    }
    return res.status(error.statusCode || 500).json({ error: 'Account Creation Failed', message: error.message });
  }
}

async function getBalance(req, res) {
  try {
    const account = await db.findAccountByCustomerId(req.customer.id);
    if (!account) return res.status(404).json({ error: 'Not Found', message: 'No account found. Please create one first.' });

    const nibssBalance = await nibss.getAccountBalance(account.accountNumber);
    return res.status(200).json({ accountNumber: account.accountNumber, bankName: account.bankName, balance: nibssBalance.balance, currency: 'NGN' });
  } catch (error) {
    console.error('Balance error:', error);
    return res.status(error.statusCode || 500).json({ error: 'Balance Check Failed', message: error.message });
  }
}

async function nameEnquiry(req, res) {
  try {
    const { accountNumber } = req.params;
    if (!accountNumber || accountNumber.length !== 10) {
      return res.status(400).json({ error: 'Bad Request', message: 'Valid 10-digit account number is required' });
    }
    const result = await nibss.nameEnquiry(accountNumber);
    return res.status(200).json({ accountNumber: result.accountNumber, accountName: result.accountName, bankName: result.bankName });
  } catch (error) {
    console.error('Name enquiry error:', error);
    return res.status(error.statusCode || 500).json({ error: 'Name Enquiry Failed', message: error.message });
  }
}

async function getAccountDetails(req, res) {
  try {
    const account = await db.findAccountByCustomerId(req.customer.id);
    if (!account) return res.status(404).json({ error: 'Not Found', message: 'No account found.' });
    return res.status(200).json({ accountNumber: account.accountNumber, bankCode: account.bankCode, bankName: account.bankName, currency: 'NGN', createdAt: account.createdAt });
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}

async function linkExistingAccount(req, res) {
  try {
    const customerId = req.customer.id;
    const { accountNumber, balance } = req.body;
    if (!accountNumber) return res.status(400).json({ error: 'Bad Request', message: 'accountNumber is required' });

    const customer = await db.findCustomerById(customerId);
    if (!customer) return res.status(404).json({ error: 'Not Found', message: 'Customer not found' });

    if (customer.hasAccount) {
      const existing = await db.findAccountByCustomerId(customer._id || customerId);
      return res.status(409).json({ error: 'Failed', message: 'Customer already has an account', account: existing });
    }

    const nibssCreds = nibss.getCredentials();
    const account = await db.createAccount({
      customerId: customer._id || customerId,
      accountNumber,
      bankCode: nibssCreds.bankCode || '298',
      bankName: nibssCreds.bankName || 'MON Bank Alpha',
      balance: balance || 15000
    });

    return res.status(201).json({
      message: 'Account linked successfully!',
      account: { accountNumber: account.accountNumber, bankCode: account.bankCode, bankName: account.bankName, balance: account.balance, currency: 'NGN', owner: `${customer.firstName} ${customer.lastName}` }
    });
  } catch (error) {
    console.error('Link account error:', error);
    return res.status(500).json({ error: 'Failed', message: error.message });
  }
}

module.exports = { createAccount, getBalance, nameEnquiry, getAccountDetails, linkExistingAccount };
