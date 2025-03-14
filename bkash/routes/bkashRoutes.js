// server/routes/bkashRoutes.js

const express = require('express');
const router = express.Router();
const bkashService = require('../services/bkashService');

// Middleware to validate request
const validateRequest = (req, res, next) => {
  // Add your API key validation or other security checks here
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Create payment
router.post('/create-payment', validateRequest, async (req, res) => {
  try {
    const { amount, intent, currency, merchantInvoiceNumber, callbackURL } = req.body;
    
    // Validate required fields
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }
    
    const result = await bkashService.createPayment({
      amount,
      intent: intent || 'sale',
      currency: currency || 'BDT',
      merchantInvoiceNumber,
      callbackURL
    });
    
    res.json(result);
  } catch (error) {
    console.error('Create payment route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute payment
router.post('/execute-payment', validateRequest, async (req, res) => {
  try {
    const { paymentID } = req.body;
    
    // Validate required fields
    if (!paymentID) {
      return res.status(400).json({ error: 'Payment ID is required' });
    }
    
    const result = await bkashService.executePayment(paymentID);
    res.json(result);
  } catch (error) {
    console.error('Execute payment route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check payment status
router.post('/payment-status', validateRequest, async (req, res) => {
  try {
    const { paymentID } = req.body;
    
    // Validate required fields
    if (!paymentID) {
      return res.status(400).json({ error: 'Payment ID is required' });
    }
    
    const result = await bkashService.queryPayment(paymentID);
    res.json(result);
  } catch (error) {
    console.error('Payment status route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search transaction
router.post('/search-transaction', validateRequest, async (req, res) => {
  try {
    const { trxID } = req.body;
    
    // Validate required fields
    if (!trxID) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }
    
    const result = await bkashService.searchTransaction(trxID);
    res.json(result);
  } catch (error) {
    console.error('Search transaction route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Refund payment
router.post('/refund', validateRequest, async (req, res) => {
  try {
    const { paymentID, amount, trxID, reason, sku } = req.body;
    
    // Validate required fields
    if (!paymentID || !amount || !trxID) {
      return res.status(400).json({ error: 'Payment ID, amount and transaction ID are required' });
    }
    
    const result = await bkashService.refundPayment({
      paymentID,
      amount,
      trxID,
      reason,
      sku
    });
    res.json(result);
  } catch (error) {
    console.error('Refund route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook for bKash callback
router.post('/callback', async (req, res) => {
  try {
    const { paymentID, status } = req.body;
    
    // Log callback data for debugging
    console.log('bKash callback received:', req.body);
    
    // Handle different status responses
    if (status === 'success') {
      // You might want to verify this payment on your server
      const paymentStatus = await bkashService.queryPayment(paymentID);
      // Store payment details in your database
      
      // Redirect user back to app with success parameters
      res.redirect(`your-app-scheme://payment?status=success&paymentID=${paymentID}`);
    } else if (status === 'failure') {
      res.redirect(`your-app-scheme://payment?status=failure&paymentID=${paymentID}`);
    } else {
      res.redirect(`your-app-scheme://payment?status=cancel&paymentID=${paymentID}`);
    }
  } catch (error) {
    console.error('Callback route error:', error);
    res.redirect(`your-app-scheme://payment?status=error&message=${encodeURIComponent(error.message)}`);
  }
});

module.exports = router;