const express = require('express');
const Stripe = require('stripe');
const loadConfig = require('../handlers/config');
const settings = loadConfig('./config.toml');
const log = require('../handlers/log');

const HeliactylModule = {
  name: "billing",
  api_level: 3,
  target_platform: "9.0.0", // Namek
};

// Initialize Stripe with your secret key
const stripe = new Stripe(settings.api.client.stripe.secret_key);

// Constants for conversion rates and bundles
const COIN_PURCHASE_OPTIONS = [
  { amount: 1000, price_usd: 1.79 },
  { amount: 2500, price_usd: 3.99 },
  { amount: 5000, price_usd: 5.99 },
  { amount: 10000, price_usd: 9.99 },
  { amount: 25000, price_usd: 19.99 }
];

const BUNDLES = {
  starter: {
    name: "Explorer",
    price_usd: 7.99,
    resources: {
      ram: 16384, // 16 GB
      disk: 102400, // 100 GB
      cpu: 300, // 300%
      servers: 2,
      coins: 1000
    }
  },
  network: {
    name: "Network",
    price_usd: 37.99,
    resources: {
      ram: 65536, // 64 GB
      disk: 409600, // 400 GB
      cpu: 1200, // 1200%
      servers: 8,
      coins: 3500
    }
  },
  enterprise: {
    name: "Unlimited",
    price_usd: 99.99,
    resources: {
      ram: 163840, // 160 GB
      disk: 1024000, // 1000 GB
      cpu: 2400, // 2400%
      servers: 20,
      coins: 10000
    }
  }
};

class BillingManager {
  constructor(db) {
    this.db = db;
  }

  async isSessionProcessed(sessionId) {
    return await this.db.get(`processed-session-${sessionId}`);
  }

  async markSessionProcessed(sessionId) {
    await this.db.set(`processed-session-${sessionId}`, true);
  }

  async getCreditBalance(userId) {
    return parseFloat(await this.db.get(`credit-${userId}`)) || 0;
  }

  async addCreditBalance(userId, amount) {
    const currentBalance = await this.getCreditBalance(userId);
    await this.db.set(`credit-${userId}`, (currentBalance + amount).toFixed(2));
    return currentBalance + amount;
  }

  async getCoinBalance(userId) {
    return parseInt(await this.db.get(`coins-${userId}`)) || 0;
  }

  async addCoins(userId, amount) {
    const currentCoins = await this.getCoinBalance(userId);
    await this.db.set(`coins-${userId}`, currentCoins + amount);
    return currentCoins + amount;
  }

  async getTransactionHistory(userId) {
    return await this.db.get(`transactions-${userId}`) || [];
  }

  async logTransaction(userId, type, details, amount) {
    const transaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      details,
      amount,
      timestamp: new Date().toISOString()
    };

    const history = await this.getTransactionHistory(userId);
    history.push(transaction);
    await this.db.set(`transactions-${userId}`, history);
    return transaction;
  }

  async addResources(userId, resources) {
    const extra = await this.db.get(`extra-${userId}`) || {
      ram: 0,
      disk: 0,
      cpu: 0,
      servers: 0
    };

    // Add resources
    extra.ram += resources.ram || 0;
    extra.disk += resources.disk || 0;
    extra.cpu += resources.cpu || 0;
    extra.servers += resources.servers || 0;

    await this.db.set(`extra-${userId}`, extra);
    return extra;
  }

  async applyBundle(userId, bundleId) {
    const bundle = BUNDLES[bundleId];
    if (!bundle) throw new Error('Invalid bundle ID');

    // Add resources from bundle
    await this.addResources(userId, bundle.resources);
    
    // Add bonus coins if included
    if (bundle.resources.coins) {
      await this.addCoins(userId, bundle.resources.coins);
    }

    // Log the bundle purchase
    await this.logTransaction(userId, 'bundle_purchase', {
      bundle: bundleId,
      name: bundle.name,
      resources: bundle.resources
    }, bundle.price_usd);

    return true;
  }
  
    // Add new method for checkout sessions
    async createCheckoutSession(userId, amount_usd) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Credit Balance',
                description: `Add $${amount_usd} credit to your account`,
              },
              unit_amount: Math.round(amount_usd * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${settings.website.domain}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${settings.website.domain}/billing`,
        metadata: {
          userId: userId,
          type: 'credit_purchase',
          amount_usd: amount_usd
        },
      });
  
      return session;
    }
  }
  
  module.exports.HeliactylModule = HeliactylModule;
  module.exports.load = async function(app, db) {
    const router = express.Router();
    const billingManager = new BillingManager(db);
  
    // Middleware to check authentication
    router.use((req, res, next) => {
      if (!req.session.userinfo) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      next();
    });
  
    // Get user's balances and purchase options
    router.get('/billing/info', async (req, res) => {
      try {
        const userId = req.session.userinfo.id;
        const creditBalance = await billingManager.getCreditBalance(userId);
        const coinBalance = await billingManager.getCoinBalance(userId);
  
        res.json({
          balances: {
            credit_usd: creditBalance,
            coins: coinBalance
          },
          coin_packages: COIN_PURCHASE_OPTIONS,
          bundles: BUNDLES
        });
      } catch (error) {
        console.error('Error fetching billing info:', error);
        res.status(500).json({ error: 'Failed to fetch billing information' });
      }
    });
  
    // Create checkout session for adding credit
    router.post('/billing/checkout', async (req, res) => {
      try {
        const { amount_usd } = req.body;
        if (!amount_usd || amount_usd < 1) {
          return res.status(400).json({ error: 'Invalid amount' });
        }
  
        const session = await billingManager.createCheckoutSession(
          req.session.userinfo.id,
          amount_usd
        );
  
        res.json({
          sessionId: session.id
        });
      } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
      }
    });
  
    router.get('/billing/verify-checkout', async (req, res) => {
        try {
          const { session_id } = req.query;
          
          // Check if session was already processed
          const isProcessed = await billingManager.isSessionProcessed(session_id);
          if (isProcessed) {
            return res.status(400).json({ error: 'This payment has already been processed' });
          }
      
          const session = await stripe.checkout.sessions.retrieve(session_id);
          
          // Verify payment status and user
          if (session.payment_status !== 'paid') {
            return res.status(400).json({ error: 'Payment not completed' });
          }
      
          if (session.metadata.userId !== req.session.userinfo.id) {
            return res.status(403).json({ error: 'Unauthorized payment session' });
          }
      
          // Mark session as processed before applying credit
          await billingManager.markSessionProcessed(session_id);
      
          const amountUsd = parseFloat(session.metadata.amount_usd);
          
          // Add credit to user's balance
          await billingManager.addCreditBalance(req.session.userinfo.id, amountUsd);
          
          // Log the credit purchase
          await billingManager.logTransaction(
            req.session.userinfo.id,
            'credit_purchase',
            {
              checkout_session: session_id,
              amount_usd: amountUsd
            },
            amountUsd
          );
      
          // Log the successful payment
          log('payment_success',
            `User ${req.session.userinfo.id} added $${amountUsd} credit balance via Stripe Checkout`
          );
      
          res.json({ success: true });
        } catch (error) {
          console.error('Error verifying checkout:', error);
          res.status(500).json({ error: 'Failed to verify checkout' });
        }
      });
  
    // Purchase coins with credit balance
    router.post('/billing/purchase-coins', async (req, res) => {
      try {
        const { package_id } = req.body;
        const userId = req.session.userinfo.id;
  
        const package = COIN_PURCHASE_OPTIONS.find(p => p.amount === parseInt(package_id));
        if (!package) {
          return res.status(400).json({ error: 'Invalid package selected' });
        }
  
        const creditBalance = await billingManager.getCreditBalance(userId);
        if (creditBalance < package.price_usd) {
          return res.status(402).json({ error: 'Insufficient credit balance' });
        }
  
        // Deduct credit and add coins
        await billingManager.addCreditBalance(userId, -package.price_usd);
        await billingManager.addCoins(userId, package.amount);
  
        // Log transaction
        const transaction = await billingManager.logTransaction(
          userId,
          'coin_purchase',
          {
            package_amount: package.amount,
            price_usd: package.price_usd
          },
          package.amount
        );
  
        res.json({
          success: true,
          transaction,
          new_credit_balance: await billingManager.getCreditBalance(userId),
          new_coin_balance: await billingManager.getCoinBalance(userId)
        });
      } catch (error) {
        console.error('Error purchasing coins:', error);
        res.status(500).json({ error: 'Failed to purchase coins' });
      }
    });
  
    // Purchase bundle with credit balance
    router.post('/billing/purchase-bundle', async (req, res) => {
      try {
        const { bundle_id } = req.body;
        const userId = req.session.userinfo.id;
  
        const bundle = BUNDLES[bundle_id];
        if (!bundle) {
          return res.status(400).json({ error: 'Invalid bundle selected' });
        }
  
        const creditBalance = await billingManager.getCreditBalance(userId);
        if (creditBalance < bundle.price_usd) {
          return res.status(402).json({ error: 'Insufficient credit balance' });
        }
  
        // Deduct credit and apply bundle
        await billingManager.addCreditBalance(userId, -bundle.price_usd);
        await billingManager.applyBundle(userId, bundle_id);
  
        res.json({
          success: true,
          new_credit_balance: await billingManager.getCreditBalance(userId),
          new_resources: await billingManager.db.get(`extra-${userId}`),
          new_coin_balance: await billingManager.getCoinBalance(userId)
        });
      } catch (error) {
        console.error('Error purchasing bundle:', error);
        res.status(500).json({ error: 'Failed to purchase bundle' });
      }
    });
  
    // Get transaction history
    router.get('/billing/transactions', async (req, res) => {
      try {
        const userId = req.session.userinfo.id;
        const transactions = await billingManager.getTransactionHistory(userId);
        
        res.json({
          transactions: transactions.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
          )
        });
      } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transaction history' });
      }
    });
  
    // Mount the router
    app.use('/api/v5', router);
  };