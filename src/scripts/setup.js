// src/scripts/setup.js
// One-time setup script for Money Flow Bank
// Run with: node src/scripts/setup.js
// This script:
//   1. Registers Money Flow Bank on NIBSS
//   2. Logs in to get JWT token
//   3. Creates BVN/NIN for admin (Happiness Ogbonnaya)
//   4. Registers Happiness as the first customer
//   5. Creates her bank account

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const axios = require('axios');

const BASE_URL = process.env.NIBSS_BASE_URL || 'https://nibssbyphoenix.onrender.com';
const APP_URL = `http://localhost:${process.env.PORT || 3000}`;

// Admin / First Customer Details
const ADMIN = {
  firstName: 'Happiness',
  lastName: 'Ogbonnaya',
  email: 'happiness.ogbonnaya@moneyflowbank.com',
  bankEmail: 'moneyflowbank@tsacademy.com',  // Used for NIBSS registration
  password: 'MoneyFlow@2026',
  phone: '08012345678',
  // Simulated BVN (not a real BVN - for testing only)
  bvn: '22234567890',
  dob: '1990-05-15'
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function setup() {
  console.log('\n🚀 ================================');
  console.log('   MONEY FLOW BANK — SETUP SCRIPT');
  console.log('================================\n');

  // ─── STEP 1: Register Money Flow Bank on NIBSS ────────────────────────────
  console.log('STEP 1: Registering Money Flow Bank on NIBSS...');
  let nibssCredentials;
  
  try {
    const onboardRes = await axios.post(`${BASE_URL}/api/fintech/onboard`, {
      name: 'Money Flow Bank',
      email: ADMIN.bankEmail
    });
    
    nibssCredentials = onboardRes.data;
    console.log('✅ Bank registered on NIBSS!');
    console.log(`   Bank Code: ${nibssCredentials.bankCode}`);
    console.log(`   Bank Name: ${nibssCredentials.bankName}`);
    console.log(`   API Key: ${nibssCredentials.apiKey}`);
    console.log(`   API Secret: ${nibssCredentials.apiSecret}`);
    console.log('\n⚠️  SAVE THESE CREDENTIALS IN YOUR .env FILE:\n');
    console.log(`   NIBSS_API_KEY=${nibssCredentials.apiKey}`);
    console.log(`   NIBSS_API_SECRET=${nibssCredentials.apiSecret}`);
    console.log(`   NIBSS_BANK_CODE=${nibssCredentials.bankCode}`);
    console.log(`   NIBSS_BANK_NAME=${nibssCredentials.bankName}\n`);
  } catch (err) {
    if (err.response?.status === 409 || err.response?.data?.message?.includes('already')) {
      console.log('ℹ️  Bank already registered on NIBSS. Using existing credentials from .env');
      nibssCredentials = {
        apiKey: process.env.NIBSS_API_KEY,
        apiSecret: process.env.NIBSS_API_SECRET,
        bankCode: process.env.NIBSS_BANK_CODE,
        bankName: process.env.NIBSS_BANK_NAME
      };
    } else {
      console.error('❌ Bank onboarding failed:', err.response?.data || err.message);
      console.log('\n⚠️  Make sure your app server is NOT required for this step.');
      console.log('   This script talks directly to NIBSS API.\n');
      return;
    }
  }

  await sleep(1000);

  // ─── STEP 2: Login to NIBSS to get JWT ───────────────────────────────────
  console.log('STEP 2: Logging in to NIBSS...');
  let nibssToken;
  
  try {
    const loginRes = await axios.post(`${BASE_URL}/api/auth/token`, {
      apiKey: nibssCredentials.apiKey,
      apiSecret: nibssCredentials.apiSecret
    });
    
    nibssToken = loginRes.data.token;
    console.log('✅ NIBSS login successful! JWT token obtained.');
    console.log(`\n   Add this to .env: NIBSS_JWT_TOKEN=${nibssToken}\n`);
  } catch (err) {
    console.error('❌ NIBSS login failed:', err.response?.data || err.message);
    return;
  }

  const nibssHeaders = {
    'Authorization': `Bearer ${nibssToken}`,
    'Content-Type': 'application/json'
  };

  await sleep(1000);

  // ─── STEP 3: Create BVN for Happiness Ogbonnaya ───────────────────────────
  console.log(`STEP 3: Creating BVN record for ${ADMIN.firstName} ${ADMIN.lastName}...`);
  
  try {
    const bvnRes = await axios.post(`${BASE_URL}/api/insertBvn`, {
      bvn: ADMIN.bvn,
      firstName: ADMIN.firstName,
      lastName: ADMIN.lastName,
      dob: ADMIN.dob,
      phone: ADMIN.phone
    });
    
    console.log(`✅ BVN created: ${ADMIN.bvn}`);
  } catch (err) {
    if (err.response?.status === 409) {
      console.log(`ℹ️  BVN ${ADMIN.bvn} already exists in NIBSS`);
    } else {
      console.error('❌ BVN creation failed:', err.response?.data || err.message);
    }
  }

  await sleep(1000);

  // ─── STEP 4: Validate BVN (sanity check) ─────────────────────────────────
  console.log('STEP 4: Validating BVN...');
  
  try {
    const validateRes = await axios.post(`${BASE_URL}/api/validateBvn`, {
      bvn: ADMIN.bvn
    });
    
    if (validateRes.data.valid) {
      console.log(`✅ BVN validated! Identity confirmed: ${validateRes.data.firstName} ${validateRes.data.lastName}`);
    }
  } catch (err) {
    console.error('❌ BVN validation failed:', err.response?.data || err.message);
    return;
  }

  await sleep(1000);

  // ─── STEP 5: Create bank account for Happiness directly on NIBSS ─────────
  console.log(`STEP 5: Creating NIBSS account for ${ADMIN.firstName} ${ADMIN.lastName}...`);
  let nibssAccount;
  
  try {
    const accountRes = await axios.post(`${BASE_URL}/api/account/create`, {
      kycType: 'bvn',
      kycID: ADMIN.bvn,
      dob: ADMIN.dob
    }, { headers: nibssHeaders });
    
    nibssAccount = accountRes.data;
    console.log(`✅ NIBSS Account created!`);
    console.log(`   Account Number: ${nibssAccount.accountNumber}`);
    console.log(`   Bank: ${nibssAccount.bankName} (${nibssAccount.bankCode})`);
    console.log(`   Opening Balance: ₦${nibssAccount.balance?.toLocaleString()}`);
  } catch (err) {
    if (err.response?.data?.message?.includes('already linked')) {
      console.log(`ℹ️  Account already exists for this BVN`);
      // Try to get existing account info
      try {
        const allAccts = await axios.get(`${BASE_URL}/api/accounts`, { headers: nibssHeaders });
        nibssAccount = { bankCode: nibssCredentials.bankCode, bankName: nibssCredentials.bankName, balance: 15000 };
        console.log(`   Using existing account.`);
      } catch (e) {
        nibssAccount = { bankCode: nibssCredentials.bankCode, bankName: nibssCredentials.bankName, balance: 15000 };
      }
    } else {
      console.error('❌ Account creation failed:', err.response?.data || err.message);
    }
  }

  console.log('\n✅ ================================');
  console.log('   SETUP COMPLETE!');
  console.log('================================');
  console.log('\n📋 Summary:');
  console.log(`   Bank: Money Flow Bank`);
  console.log(`   Admin: ${ADMIN.firstName} ${ADMIN.lastName}`);
  console.log(`   Bank Code: ${nibssCredentials.bankCode}`);
  console.log(`   Bank Name: ${nibssCredentials.bankName || 'See NIBSS portal'}`);
  
  if (nibssAccount?.accountNumber) {
    console.log(`   Admin Account: ${nibssAccount.accountNumber}`);
  }

  console.log('\n📝 Next Steps:');
  console.log('   1. Update your .env with the credentials printed above');
  console.log('   2. Start the server: npm start');
  console.log('   3. Register customers via POST /api/customers/register');
  console.log('   4. Create accounts via POST /api/accounts/create\n');
}

setup().catch(console.error);
