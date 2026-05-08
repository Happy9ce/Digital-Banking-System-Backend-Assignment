// src/models/Customer.js
// Mongoose schema for bank customers

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const customerSchema = new mongoose.Schema({
  firstName:   { type: String, required: true, trim: true },
  lastName:    { type: String, required: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true, select: false },
  phone:       { type: String, required: true },
  bvn:         { type: String, default: null, sparse: true },
  nin:         { type: String, default: null, sparse: true },
  kycType:     { type: String, enum: ['bvn', 'nin'], required: true },
  kycVerified: { type: Boolean, default: false },
  dob:         { type: String, required: true },
  hasAccount:  { type: Boolean, default: false }
}, { timestamps: true });

// Hash password before saving
customerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare passwords
customerSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
customerSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('Customer', customerSchema);
