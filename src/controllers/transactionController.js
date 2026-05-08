// src/controllers/transactionController.js
const db = require('../models/database');
const nibss = require('../services/nibssService');

async function initiateTransfer(req, res) {
  try {
    const customerId = req.customer.id;
    const { toAccountNumber, amount, description } = req.body;

    if (!toAccountNumber || !amount) return res.status(400).json({ error: 'Bad Request', message: 'toAccountNumber and amount are required' });

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) return res.status(400).json({ error: 'Bad Request', message: 'Amount must be a positive number' });

    const senderAccount = await db.findAccountByCustomerId(customerId);
    if (!senderAccount) return res.status(404).json({ error: 'Not Found', message: 'You do not have a bank account.' });

    if (senderAccount.accountNumber === toAccountNumber) return res.status(400).json({ error: 'Bad Request', message: 'Cannot transfer to the same account' });

    let recipientInfo;
    try {
      recipientInfo = await nibss.nameEnquiry(toAccountNumber);
    } catch (e) {
      return res.status(404).json({ error: 'Recipient Not Found', message: 'Recipient account not found.' });
    }

    let transferResult;
    try {
      transferResult = await nibss.transfer(senderAccount.accountNumber, toAccountNumber, transferAmount);
    } catch (transferError) {
      if (transferError.statusCode === 400 || transferError.message?.toLowerCase().includes('insufficient')) {
        return res.status(400).json({ error: 'Transfer Failed', message: 'Insufficient funds.' });
      }
      throw transferError;
    }

    const customer = await db.findCustomerById(customerId);

    await db.recordTransaction({
      customerId: customer._id || customerId,
      transactionId: transferResult.transactionId,
      type: 'DEBIT',
      from: senderAccount.accountNumber,
      to: toAccountNumber,
      amount: transferAmount,
      status: transferResult.status,
      description: description || `Transfer to ${recipientInfo.accountName}`
    });

    const recipientLocalAccount = await db.findAccountByNumber(toAccountNumber);
    if (recipientLocalAccount) {
      await db.recordTransaction({
        customerId: recipientLocalAccount.customerId,
        transactionId: transferResult.transactionId,
        type: 'CREDIT',
        from: senderAccount.accountNumber,
        to: toAccountNumber,
        amount: transferAmount,
        status: transferResult.status,
        description: description || `Transfer from ${customer.firstName} ${customer.lastName}`
      });
    }

    return res.status(200).json({
      message: 'Transfer successful!',
      transactionId: transferResult.transactionId,
      amount: transferAmount,
      currency: 'NGN',
      from: senderAccount.accountNumber,
      to: toAccountNumber,
      recipientName: recipientInfo.accountName,
      recipientBank: recipientInfo.bankName,
      status: transferResult.status,
      timestamp: new Date().toISOString(),
      transferType: recipientLocalAccount ? 'INTRA_BANK' : 'INTER_BANK'
    });
  } catch (error) {
    console.error('Transfer error:', error);
    return res.status(error.statusCode || 500).json({ error: 'Transfer Failed', message: error.message });
  }
}

async function getTransactionHistory(req, res) {
  try {
    const customerId = req.customer.id;
    const transactions = await db.getTransactionsByCustomerId(customerId);
    return res.status(200).json({
      customerId,
      totalTransactions: transactions.length,
      transactions: transactions.map(t => ({
        transactionId: t.transactionId,
        type: t.type,
        amount: t.amount,
        currency: 'NGN',
        from: t.from,
        to: t.to,
        status: t.status,
        description: t.description,
        timestamp: t.createdAt || t.timestamp
      }))
    });
  } catch (error) {
    console.error('Transaction history error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Could not retrieve transaction history.' });
  }
}

async function getTransactionStatus(req, res) {
  try {
    const customerId = req.customer.id;
    const { transactionId } = req.params;

    const localTx = await db.findTransactionByNibssId(transactionId);
    if (localTx && String(localTx.customerId) !== String(customerId)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this transaction.' });
    }

    const nibssStatus = await nibss.getTransactionStatus(transactionId);
    return res.status(200).json({
      transactionId: nibssStatus.transactionId,
      status: nibssStatus.status,
      amount: nibssStatus.amount,
      currency: 'NGN',
      from: nibssStatus.from,
      to: nibssStatus.to,
      timestamp: nibssStatus.timestamp
    });
  } catch (error) {
    console.error('Transaction status error:', error);
    return res.status(error.statusCode || 500).json({ error: 'Transaction Status Failed', message: error.message });
  }
}

module.exports = { initiateTransfer, getTransactionHistory, getTransactionStatus };
