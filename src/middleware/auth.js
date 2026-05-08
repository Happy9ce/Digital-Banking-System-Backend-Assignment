// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const db = require('../models/database');

const JWT_SECRET = process.env.JWT_SECRET || 'moneyflow_bank_super_secret_key_2026';

function generateToken(customer) {
  return jwt.sign(
    {
      id: customer._id || customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No token provided. Please login first.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.customer = decoded;

    const customer = await db.findCustomerById(decoded.id);
    if (!customer) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Customer account not found.'
      });
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized', message: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token.' });
  }
}

module.exports = { generateToken, authenticate };
