// src/controllers/adminController.js
// Admin operations: NIBSS setup, BVN/NIN seeding
// These are bank-internal operations typically done by admin staff

const nibss = require('../services/nibssService');
const db = require('../models/database');

// ─── POST /api/admin/nibss/onboard ────────────────────────────────────────────
// Registers Money Flow Bank on the NIBSS platform
// Called ONCE to get API credentials
async function onboardBank(req, res) {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'name and email are required'
      });
    }

    const result = await nibss.onboardFintech(name, email);

    // Save credentials to our local store
    db.saveNibssCredentials({
      apiKey: result.apiKey,
      apiSecret: result.apiSecret,
      bankCode: result.bankCode,
      bankName: result.bankName
    });

    return res.status(201).json({
      message: 'Money Flow Bank successfully registered on NIBSS!',
      credentials: {
        bankCode: result.bankCode,
        bankName: result.bankName,
        apiKey: result.apiKey,
        apiSecret: result.apiSecret,
        note: 'Save these credentials securely. Use /api/admin/nibss/login to get JWT token.'
      }
    });

  } catch (error) {
    console.error('Bank onboarding error:', error);
    return res.status(error.statusCode || 500).json({
      error: 'Onboarding Failed',
      message: error.message
    });
  }
}

// ─── POST /api/admin/nibss/login ──────────────────────────────────────────────
// Get/refresh NIBSS JWT token
async function nibssLogin(req, res) {
  try {
    const { apiKey, apiSecret } = req.body;
    const result = await nibss.login(apiKey, apiSecret);

    // Update NIBSS service with new credentials
    nibss.setCredentials({ jwtToken: result.token });

    return res.status(200).json({
      message: 'NIBSS authentication successful',
      bankInfo: result.fintech,
      tokenNote: 'Token valid for 1 hour. Auto-refresh is enabled.'
    });

  } catch (error) {
    console.error('NIBSS login error:', error);
    return res.status(error.statusCode || 500).json({
      error: 'NIBSS Login Failed',
      message: error.message
    });
  }
}

// ─── POST /api/admin/kyc/bvn ─────────────────────────────────────────────────
// Register a BVN record in NIBSS identity store
// (In real world: done by NIBSS/CBN. Here: admin can seed test data)
async function insertBVN(req, res) {
  try {
    const { bvn, firstName, lastName, dob, phone } = req.body;

    if (!bvn || !firstName || !lastName || !dob || !phone) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'bvn, firstName, lastName, dob, and phone are all required'
      });
    }

    const result = await nibss.createBVN(bvn, firstName, lastName, dob, phone);

    return res.status(201).json({
      message: 'BVN record created in NIBSS identity store',
      data: result
    });

  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'This BVN is already registered in NIBSS'
      });
    }
    console.error('Insert BVN error:', error);
    return res.status(error.statusCode || 500).json({
      error: 'BVN Creation Failed',
      message: error.message
    });
  }
}

// ─── POST /api/admin/kyc/nin ──────────────────────────────────────────────────
// Register a NIN record in NIBSS identity store
async function insertNIN(req, res) {
  try {
    const { nin, firstName, lastName, dob } = req.body;

    if (!nin || !firstName || !lastName || !dob) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'nin, firstName, lastName, and dob are all required'
      });
    }

    const result = await nibss.createNIN(nin, firstName, lastName, dob);

    return res.status(201).json({
      message: 'NIN record created in NIBSS identity store',
      data: result
    });

  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'This NIN is already registered in NIBSS'
      });
    }
    console.error('Insert NIN error:', error);
    return res.status(error.statusCode || 500).json({
      error: 'NIN Creation Failed',
      message: error.message
    });
  }
}

// ─── GET /api/admin/status ────────────────────────────────────────────────────
// System status and stats
function getStatus(req, res) {
  const stats = db.getStats();
  const nibssInfo = nibss.getCredentials();

  return res.status(200).json({
    bank: 'Money Flow Bank',
    status: 'operational',
    nibss: nibssInfo,
    stats
  });
}

module.exports = { onboardBank, nibssLogin, insertBVN, insertNIN, getStatus };
