// src/services/nibssService.js
// Handles all calls to the NibssByPhoenix external API

const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.NIBSS_BASE_URL || 'https://nibssbyphoenix.onrender.com';

// Store credentials in memory (in production, use a database or secrets manager)
let credentials = {
  apiKey: process.env.NIBSS_API_KEY || '',
  apiSecret: process.env.NIBSS_API_SECRET || '',
  bankCode: process.env.NIBSS_BANK_CODE || '',
  bankName: process.env.NIBSS_BANK_NAME || '',
  jwtToken: process.env.NIBSS_JWT_TOKEN || '',
  tokenExpiry: null
};

// ─── Helper: get auth headers ─────────────────────────────────────────────────
function getAuthHeaders() {
  if (!credentials.jwtToken) {
    throw new Error('NIBSS JWT token not available. Please login first.');
  }
  return {
    'Authorization': `Bearer ${credentials.jwtToken}`,
    'Content-Type': 'application/json'
  };
}

// ─── 1. Fintech Onboarding ────────────────────────────────────────────────────
// Registers Money Flow Bank on the NIBSS platform
async function onboardFintech(name, email) {
  try {
    const response = await axios.post(`${BASE_URL}/api/fintech/onboard`, {
      name,
      email
    });
    
    // Save credentials returned by NIBSS
    const { apiKey, apiSecret, bankCode, bankName } = response.data;
    credentials.apiKey = apiKey;
    credentials.apiSecret = apiSecret;
    credentials.bankCode = bankCode;
    credentials.bankName = bankName;

    console.log(`✅ Fintech onboarded successfully!`);
    console.log(`   Bank Code: ${bankCode}`);
    console.log(`   Bank Name: ${bankName}`);
    console.log(`   API Key: ${apiKey}`);
    console.log(`   API Secret: ${apiSecret}`);

    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Fintech onboarding');
  }
}

// ─── 2. Login / Get JWT Token ─────────────────────────────────────────────────
// Authenticates with NIBSS and gets a fresh JWT token (valid 1 hour)
async function login(apiKey, apiSecret) {
  try {
    const key = apiKey || credentials.apiKey;
    const secret = apiSecret || credentials.apiSecret;

    const response = await axios.post(`${BASE_URL}/api/auth/token`, {
      apiKey: key,
      apiSecret: secret
    });

    credentials.jwtToken = response.data.token;
    credentials.tokenExpiry = Date.now() + (3600 * 1000); // 1 hour
    
    // Also update bank info from response
    if (response.data.fintech) {
      credentials.bankCode = response.data.fintech.bankCode;
      credentials.bankName = response.data.fintech.bankName;
    }

    console.log(`✅ NIBSS login successful. Token valid for 1 hour.`);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'NIBSS login');
  }
}

// ─── Auto-refresh token if expired ────────────────────────────────────────────
async function ensureValidToken() {
  const bufferTime = 5 * 60 * 1000; // 5 minutes before expiry
  if (!credentials.jwtToken || !credentials.tokenExpiry || 
      Date.now() > (credentials.tokenExpiry - bufferTime)) {
    if (credentials.apiKey && credentials.apiSecret) {
      await login();
    } else {
      throw new Error('No NIBSS credentials available. Run setup first.');
    }
  }
}

// ─── 3. Create Account ────────────────────────────────────────────────────────
// Creates a bank account on NIBSS for a customer
async function createAccount(kycType, kycID, dob) {
  await ensureValidToken();
  try {
    const response = await axios.post(`${BASE_URL}/api/account/create`, {
      kycType,
      kycID,
      dob
    }, { headers: getAuthHeaders() });

    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Account creation');
  }
}

// ─── 4. Name Enquiry ──────────────────────────────────────────────────────────
// Look up account holder name before a transfer
async function nameEnquiry(accountNumber) {
  await ensureValidToken();
  try {
    const response = await axios.get(
      `${BASE_URL}/api/account/name-enquiry/${accountNumber}`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Name enquiry');
  }
}

// ─── 5. Get All Accounts ──────────────────────────────────────────────────────
async function getAllAccounts() {
  await ensureValidToken();
  try {
    const response = await axios.get(`${BASE_URL}/api/accounts`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Get all accounts');
  }
}

// ─── 6. Account Balance ───────────────────────────────────────────────────────
async function getAccountBalance(accountNumber) {
  await ensureValidToken();
  try {
    const response = await axios.get(
      `${BASE_URL}/api/account/balance/${accountNumber}`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Account balance');
  }
}

// ─── 7. Fund Transfer ─────────────────────────────────────────────────────────
// Initiates a transfer (intra or inter-bank)
async function transfer(from, to, amount) {
  await ensureValidToken();
  try {
    const response = await axios.post(`${BASE_URL}/api/transfer`, {
      from,
      to,
      amount: String(amount)
    }, { headers: getAuthHeaders() });

    const data = response.data;
    // Normalize response — NIBSS may return 'reference' instead of 'transactionId'
    return {
      transactionId: data.transactionId || data.reference || data._id,
      status: data.status || 'SUCCESS',
      amount: data.amount,
      from: data.from || data.senderAccount,
      to: data.to || data.receiverAccount,
    };
  } catch (error) {
    throw handleApiError(error, 'Fund transfer');
  }
}

// ─── 8. Transaction Status Query (TSQ) ───────────────────────────────────────
async function getTransactionStatus(transactionId) {
  await ensureValidToken();
  try {
    const response = await axios.get(
      `${BASE_URL}/api/transaction/${transactionId}`,
      { headers: getAuthHeaders() }
    );
    const data = response.data;
    // Normalize response format
    return {
      transactionId: data.transactionId || data.reference || transactionId,
      status: data.status || 'SUCCESS',
      amount: data.amount,
      from: data.from || data.senderAccount,
      to: data.to || data.receiverAccount,
      timestamp: data.timestamp || data.createdAt
    };
  } catch (error) {
    throw handleApiError(error, 'Transaction status');
  }
}

// ─── 9. Create BVN ───────────────────────────────────────────────────────────
async function createBVN(bvn, firstName, lastName, dob, phone) {
  try {
    const response = await axios.post(`${BASE_URL}/api/insertBvn`, {
      bvn, firstName, lastName, dob, phone
    });
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Create BVN');
  }
}

// ─── 10. Create NIN ──────────────────────────────────────────────────────────
async function createNIN(nin, firstName, lastName, dob) {
  try {
    const response = await axios.post(`${BASE_URL}/api/insertNin`, {
      nin, firstName, lastName, dob
    });
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Create NIN');
  }
}

// ─── 11. Validate BVN ────────────────────────────────────────────────────────
async function validateBVN(bvn) {
  try {
    const response = await axios.post(`${BASE_URL}/api/validateBvn`, { bvn });
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Validate BVN');
  }
}

// ─── 12. Validate NIN ────────────────────────────────────────────────────────
async function validateNIN(nin) {
  try {
    const response = await axios.post(`${BASE_URL}/api/validateNin`, { nin });
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Validate NIN');
  }
}

// ─── Utility: Get credentials info ───────────────────────────────────────────
function getCredentials() {
  return {
    bankCode: credentials.bankCode,
    bankName: credentials.bankName,
    hasToken: !!credentials.jwtToken,
    tokenExpiry: credentials.tokenExpiry ? new Date(credentials.tokenExpiry).toISOString() : null
  };
}

// ─── Set credentials manually (for after setup) ──────────────────────────────
function setCredentials(creds) {
  if (creds.apiKey) credentials.apiKey = creds.apiKey;
  if (creds.apiSecret) credentials.apiSecret = creds.apiSecret;
  if (creds.bankCode) credentials.bankCode = creds.bankCode;
  if (creds.bankName) credentials.bankName = creds.bankName;
  if (creds.jwtToken) {
    credentials.jwtToken = creds.jwtToken;
    credentials.tokenExpiry = Date.now() + (3600 * 1000);
  }
}

// ─── Error Handler ────────────────────────────────────────────────────────────
function handleApiError(error, operation) {
  if (error.response) {
    const msg = error.response.data?.message || error.response.statusText;
    const err = new Error(`${operation} failed: ${msg}`);
    err.statusCode = error.response.status;
    err.data = error.response.data;
    return err;
  }
  const err = new Error(`${operation} failed: ${error.message}`);
  err.statusCode = 500;
  return err;
}

module.exports = {
  onboardFintech,
  login,
  ensureValidToken,
  createAccount,
  nameEnquiry,
  getAllAccounts,
  getAccountBalance,
  transfer,
  getTransactionStatus,
  createBVN,
  createNIN,
  validateBVN,
  validateNIN,
  getCredentials,
  setCredentials
};
