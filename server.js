
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import { pool, initDatabase } from './server/db.js';
import apiRouter from './server/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT) || (process.env.REPLIT_DEPLOYMENT ? 5000 : 3001);

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// Initialize database
initDatabase().catch(err => console.error('Database initialization failed:', err));

// Webhook route MUST come before express.json() to get raw body
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).send('Webhook secret not configured');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Webhook signature verification failed:', errorMessage);
    return res.status(400).send(`Webhook Error: ${errorMessage}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, coins } = session.metadata;

    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          'UPDATE users SET balance = balance + $1 WHERE uid = $2',
          [coins, userId]
        );

        await client.query(
          `INSERT INTO transactions (user_id, type, amount, description, payment_method, stripe_session_id)
           VALUES ($1, 'deposit', $2, 'Card Payment (Stripe)', 'stripe', $3)`,
          [userId, coins, session.id]
        );

        await client.query('COMMIT');
        console.log(`Successfully credited ${coins} coins to user ${userId}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Failed to update user balance:', error);
    }
  }

  res.json({ received: true });
});

// Regular JSON parsing for all other routes
app.use(express.json());

// Mount API routes
app.use('/api', apiRouter);

// Create Stripe checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { userId, coins, amount } = req.body;

    if (!userId || !coins || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const baseUrl = process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : `http://localhost:${PORT}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${coins} Zii Coins`,
              description: 'In-game currency for Zii predictions',
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/#/wallet?payment=success`,
      cancel_url: `${baseUrl}/#/wallet?payment=cancelled`,
      metadata: {
        userId,
        coins: coins.toString(),
      },
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Stripe session creation error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Serve static files from the dist directory
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  console.log('Serving static files from:', distPath);
  app.use(express.static(distPath));

  // Handle SPA routing - must come after API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.warn('Warning: dist directory not found. Static files will not be served.');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Zii App Server running on port ${PORT}`);
});
