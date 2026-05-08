// src/models/database.js
// Database operations using Mongoose models (MongoDB Atlas)

const Customer = require('./Customer');
const Account = require('./Account');
const Transaction = require('./Transaction');

// ─── Customer Operations ──────────────────────────────────────────────────────

async function createCustomer({ firstName, lastName, email, password, phone, bvn, nin, kycType, kycVerified, dob }) {
  const existing = await Customer.findOne({ email });
  if (existing) throw new Error('Customer with this email already exists');

  if (bvn) {
    const bvnUsed = await Customer.findOne({ bvn });
    if (bvnUsed) throw new Error('BVN already linked to another customer');
  }

  if (nin) {
    const ninUsed = await Customer.findOne({ nin });
    if (ninUsed) throw new Error('NIN already linked to another customer');
  }

  const customer = new Customer({
    firstName, lastName, email, password,
    phone, bvn: bvn || null, nin: nin || null,
    kycType, kycVerified, dob, hasAccount: false
  });

  await customer.save();
  return customer.toSafeObject();
}

async function findCustomerByEmail(email) {
  return await Customer.findOne({ email }).select('+password');
}

async function findCustomerById(id) {
  try {
    return await Customer.findById(id);
  } catch (e) {
    return null;
  }
}

async function updateCustomer(id, updates) {
  const customer = await Customer.findByIdAndUpdate(id, updates, { new: true });
  if (!customer) throw new Error('Customer not found');
  return customer.toSafeObject();
}

function sanitizeCustomer(customer) {
  if (!customer) return null;
  if (customer.toSafeObject) return customer.toSafeObject();
  const { password, ...safe } = customer._doc || customer;
  return safe;
}

// ─── Account Operations ───────────────────────────────────────────────────────

async function createAccount({ customerId, accountNumber, bankCode, bankName, balance }) {
  const existing = await Account.findOne({ customerId });
  if (existing) throw new Error('Customer already has an account');

  const account = new Account({
    customerId, accountNumber, bankCode, bankName,
    balance: balance || 15000
  });

  await account.save();
  await Customer.findByIdAndUpdate(customerId, { hasAccount: true });
  return account.toObject();
}

async function findAccountByCustomerId(customerId) {
  try {
    return await Account.findOne({ customerId });
  } catch (e) {
    return null;
  }
}

async function findAccountByNumber(accountNumber) {
  return await Account.findOne({ accountNumber });
}

async function getAllAccounts() {
  return await Account.find();
}

// ─── Transaction Operations ───────────────────────────────────────────────────

async function recordTransaction({ customerId, transactionId, type, from, to, amount, status, description }) {
  const transaction = new Transaction({
    customerId, transactionId, type, from, to, amount, status, description
  });
  await transaction.save();
  return transaction.toObject();
}

async function getTransactionsByCustomerId(customerId) {
  return await Transaction.find({ customerId }).sort({ createdAt: -1 });
}

async function findTransactionByNibssId(transactionId) {
  return await Transaction.findOne({ transactionId });
}

// ─── NIBSS Credentials (in memory) ───────────────────────────────────────────
let nibssCredentials = {};

function saveNibssCredentials(creds) {
  nibssCredentials = { ...nibssCredentials, ...creds };
}

function getNibssCredentials() {
  return nibssCredentials;
}

async function getStats() {
  const [totalCustomers, totalAccounts, totalTransactions] = await Promise.all([
    Customer.countDocuments(),
    Account.countDocuments(),
    Transaction.countDocuments()
  ]);
  return { totalCustomers, totalAccounts, totalTransactions };
}

module.exports = {
  createCustomer, findCustomerByEmail, findCustomerById,
  updateCustomer, sanitizeCustomer,
  createAccount, findAccountByCustomerId, findAccountByNumber, getAllAccounts,
  recordTransaction, getTransactionsByCustomerId, findTransactionByNibssId,
  saveNibssCredentials, getNibssCredentials, getStats
};
