// src/models/Account.js
// Mongoose schema for bank accounts

const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  customerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true },
  accountNumber: { type: String, required: true, unique: true },
  bankCode:      { type: String, required: true },
  bankName:      { type: String, required: true },
  balance:       { type: Number, default: 15000 }
}, { timestamps: true });

module.exports = mongoose.model('Account', accountSchema);
