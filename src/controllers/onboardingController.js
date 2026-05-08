// src/controllers/onboardingController.js
const db = require('../models/database');
const nibss = require('../services/nibssService');
const { generateToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

async function registerCustomer(req, res) {
  try {
    const { firstName, lastName, email, password, phone, kycType, kycID, dob } = req.body;

    if (!firstName || !lastName || !email || !password || !phone || !kycType || !kycID || !dob) {
      return res.status(400).json({ error: 'Bad Request', message: 'All fields are required: firstName, lastName, email, password, phone, kycType, kycID, dob' });
    }

    if (!['bvn', 'nin'].includes(kycType.toLowerCase())) {
      return res.status(400).json({ error: 'Bad Request', message: 'kycType must be either "bvn" or "nin"' });
    }

    const kycTypeLower = kycType.toLowerCase();
    let nibssVerification;

    try {
      if (kycTypeLower === 'bvn') {
        nibssVerification = await nibss.validateBVN(kycID);
      } else {
        nibssVerification = await nibss.validateNIN(kycID);
      }
    } catch (nibssError) {
      return res.status(400).json({ error: 'KYC Verification Failed', message: `Could not verify your ${kycType.toUpperCase()}.`, details: nibssError.message });
    }

    const isValid = nibssVerification && (nibssVerification.valid === true || nibssVerification.success === true);
    if (!isValid) {
      return res.status(400).json({ error: 'KYC Verification Failed', message: `Your ${kycType.toUpperCase()} could not be verified.` });
    }

    if (nibssVerification.data) {
      nibssVerification = { ...nibssVerification, ...nibssVerification.data, valid: true };
    }

    const customerData = { firstName, lastName, email, password, phone, kycType: kycTypeLower, kycVerified: true, dob };
    if (kycTypeLower === 'bvn') { customerData.bvn = kycID; } else { customerData.nin = kycID; }

    const customer = await db.createCustomer(customerData);
    const token = generateToken(customer);

    return res.status(201).json({
      message: 'Customer onboarded successfully! KYC verified.',
      customer: { id: customer._id || customer.id, firstName: customer.firstName, lastName: customer.lastName, email: customer.email, kycVerified: true, kycType: customer.kycType },
      nibssVerification: { verified: true, name: `${nibssVerification.firstName} ${nibssVerification.lastName}` },
      token,
      nextStep: 'POST /api/accounts/create to open your bank account'
    });
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('already linked')) {
      return res.status(409).json({ error: 'Conflict', message: error.message });
    }
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Registration failed.' });
  }
}

async function loginCustomer(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Bad Request', message: 'Email and password are required' });
    }

    const customer = await db.findCustomerByEmail(email);
    if (!customer) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
    }

    let validPassword = false;
    if (customer.comparePassword) {
      validPassword = await customer.comparePassword(password);
    } else {
      validPassword = await bcrypt.compare(password, customer.password);
    }

    if (!validPassword) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
    }

    const token = generateToken(customer);
    return res.status(200).json({
      message: 'Login successful',
      customer: { id: customer._id || customer.id, firstName: customer.firstName, lastName: customer.lastName, email: customer.email, kycVerified: customer.kycVerified, hasAccount: customer.hasAccount },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Login failed. Please try again.' });
  }
}

async function getProfile(req, res) {
  try {
    const customer = await db.findCustomerById(req.customer.id);
    if (!customer) {
      return res.status(404).json({ error: 'Not Found', message: 'Customer not found' });
    }
    const account = await db.findAccountByCustomerId(customer._id || customer.id);
    return res.status(200).json({
      customer: db.sanitizeCustomer(customer),
      account: account ? { accountNumber: account.accountNumber, bankCode: account.bankCode, bankName: account.bankName } : null
    });
  } catch (error) {
    console.error('Profile error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Could not fetch profile.' });
  }
}

module.exports = { registerCustomer, loginCustomer, getProfile };
