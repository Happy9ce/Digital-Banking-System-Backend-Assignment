// src/models/Transaction.js
// Mongoose schema for transaction records

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  customerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  transactionId: { type: String },   // NIBSS transaction reference
  type:          { type: String, enum: ['DEBIT', 'CREDIT'], required: true },
  from:          { type: String, required: true },
  to:            { type: String, required: true },
  amount:        { type: Number, required: true },
  status:        { type: String, default: 'SUCCESS' },
  description:   { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
