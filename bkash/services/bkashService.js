// server/services/bkashService.js

const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

class BkashService {
  constructor() {
    this.baseURL = 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout';
    this.appKey = process.env.BKASH_APP_KEY;
    this.appSecret = process.env.BKASH_APP_SECRET;
    this.username = process.env.BKASH_USERNAME;
    this.password = process.env.BKASH_PASSWORD;
    this.tokenCache = {
      id_token: null,
      refresh_token: null,
      expires_at: null
    };
  }

  async getAuthToken() {
    // Check if we have a valid token in cache
    if (
      this.tokenCache.id_token &&
      this.tokenCache.expires_at &&
      this.tokenCache.expires_at > Date.now()
    ) {
      return this.tokenCache.id_token;
    }

    try {
      const response = await axios({
        method: 'POST',
        url: `${this.baseURL}/token/grant`,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'username': this.username,
          'password': this.password
        },
        data: {
          app_key: this.appKey,
          app_secret: this.appSecret
        }
      });

      if (response.data.statusCode === '0000') {
        // Cache the token (1 hour expiry, using 50 minutes to be safe)
        this.tokenCache = {
          id_token: response.data.id_token,
          refresh_token: response.data.refresh_token,
          expires_at: Date.now() + 50 * 60 * 1000 // 50 minutes
        };
        return this.tokenCache.id_token;
      } else {
        throw new Error(`Failed to get auth token: ${response.data.statusMessage}`);
      }
    } catch (error) {
      console.error('bKash auth token error:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with bKash');
    }
  }

  async refreshToken() {
    if (!this.tokenCache.refresh_token) {
      return this.getAuthToken();
    }

    try {
      const response = await axios({
        method: 'POST',
        url: `${this.baseURL}/token/refresh`,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'username': this.username,
          'password': this.password
        },
        data: {
          app_key: this.appKey,
          app_secret: this.appSecret,
          refresh_token: this.tokenCache.refresh_token
        }
      });

      if (response.data.statusCode === '0000') {
        // Update the token cache
        this.tokenCache = {
          id_token: response.data.id_token,
          refresh_token: response.data.refresh_token,
          expires_at: Date.now() + 50 * 60 * 1000 // 50 minutes
        };
        return this.tokenCache.id_token;
      } else {
        // If refresh failed, get a new token
        return this.getAuthToken();
      }
    } catch (error) {
      console.error('bKash token refresh error:', error.response?.data || error.message);
      return this.getAuthToken();
    }
  }

  async createPayment(paymentData) {
    try {
      const token = await this.getAuthToken();
      
      // Generate a unique invoice number if not provided
      const merchantInvoiceNumber = paymentData.merchantInvoiceNumber || 
                                    `INV-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      
      const response = await axios({
        method: 'POST',
        url: `${this.baseURL}/create`,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': token,
          'X-APP-Key': this.appKey
        },
        data: {
          mode: '0011', // Tokenized checkout
          payerReference: paymentData.payerReference || merchantInvoiceNumber,
          callbackURL: paymentData.callbackURL || 'http://localhost:3000/bkash/callback',
          amount: paymentData.amount,
          currency: paymentData.currency || 'BDT',
          intent: paymentData.intent || 'sale',
          merchantInvoiceNumber: merchantInvoiceNumber
        }
      });

      return response.data;
    } catch (error) {
      console.error('bKash create payment error:', error.response?.data || error.message);
      
      // Handle token expiry error
      if (error.response?.data?.statusCode === '2001') {
        await this.refreshToken();
        return this.createPayment(paymentData);
      }
      
      throw new Error(error.response?.data?.statusMessage || 'Failed to create payment');
    }
  }

  async executePayment(paymentID) {
    try {
      const token = await this.getAuthToken();
      
      const response = await axios({
        method: 'POST',
        url: `${this.baseURL}/execute`,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': token,
          'X-APP-Key': this.appKey
        },
        data: {
          paymentID: paymentID
        }
      });

      return response.data;
    } catch (error) {
      console.error('bKash execute payment error:', error.response?.data || error.message);
      
      // Handle token expiry error
      if (error.response?.data?.statusCode === '2001') {
        await this.refreshToken();
        return this.executePayment(paymentID);
      }
      
      throw new Error(error.response?.data?.statusMessage || 'Failed to execute payment');
    }
  }

  async queryPayment(paymentID) {
    try {
      const token = await this.getAuthToken();
      
      const response = await axios({
        method: 'POST',
        url: `${this.baseURL}/payment/status`,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': token,
          'X-APP-Key': this.appKey
        },
        data: {
          paymentID: paymentID
        }
      });

      return response.data;
    } catch (error) {
      console.error('bKash payment status error:', error.response?.data || error.message);
      
      // Handle token expiry error
      if (error.response?.data?.statusCode === '2001') {
        await this.refreshToken();
        return this.queryPayment(paymentID);
      }
      
      throw new Error(error.response?.data?.statusMessage || 'Failed to get payment status');
    }
  }

  async searchTransaction(trxID) {
    try {
      const token = await this.getAuthToken();
      
      const response = await axios({
        method: 'POST',
        url: `${this.baseURL}/general/searchTransaction`,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': token,
          'X-APP-Key': this.appKey
        },
        data: {
          trxID: trxID
        }
      });

      return response.data;
    } catch (error) {
      console.error('bKash search transaction error:', error.response?.data || error.message);
      
      // Handle token expiry error
      if (error.response?.data?.statusCode === '2001') {
        await this.refreshToken();
        return this.searchTransaction(trxID);
      }
      
      throw new Error(error.response?.data?.statusMessage || 'Failed to search transaction');
    }
  }

  async refundPayment(refundData) {
    try {
      const token = await this.getAuthToken();
      
      const response = await axios({
        method: 'POST',
        url: `${this.baseURL}/payment/refund`,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': token,
          'X-APP-Key': this.appKey
        },
        data: {
          paymentID: refundData.paymentID,
          amount: refundData.amount,
          trxID: refundData.trxID,
          sku: refundData.sku || 'N/A',
          reason: refundData.reason || 'Customer requested refund'
        }
      });

      return response.data;
    } catch (error) {
      console.error('bKash refund error:', error.response?.data || error.message);
      
      // Handle token expiry error
      if (error.response?.data?.statusCode === '2001') {
        await this.refreshToken();
        return this.refundPayment(refundData);
      }
      
      throw new Error(error.response?.data?.statusMessage || 'Failed to refund payment');
    }
  }
}

module.exports = new BkashService();