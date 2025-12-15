
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT) || 8080;

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

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
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle successful payment
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, coins } = session.metadata;

    try {
      const db = admin.firestore();
      const userRef = db.collection('users').doc(userId);

      // Update user balance
      await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error('User not found');
        }

        const currentBalance = userDoc.data().balance || 0;
        const newBalance = currentBalance + parseInt(coins);

        transaction.update(userRef, {
          balance: newBalance,
        });

        // Create transaction record
        const txRef = db.collection('transactions').doc();
        transaction.set(txRef, {
          userId,
          type: 'deposit',
          amount: parseInt(coins),
          description: 'Card Payment (Stripe)',
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          payment_method: 'stripe',
          stripe_session_id: session.id,
        });
      });

      console.log(`Successfully credited ${coins} coins to user ${userId}`);
    } catch (error) {
      console.error('Failed to update user balance:', error);
    }
  }

  res.json({ received: true });
});

// Regular JSON parsing for all other routes
app.use(express.json());

// Create Stripe checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { userId, coins, amount } = req.body;

    if (!userId || !coins || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Construct base URL for redirects
    const baseUrl = process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : 'http://localhost:5000';

    // Create checkout session
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
            unit_amount: Math.round(amount * 100), // Convert to cents
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

// Serve static files from the dist directory (Vite build output)
app.use(express.static(path.join(__dirname, 'dist')));

// Handle SPA routing: return index.html for any unknown route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Zii App Server running on port ${PORT}`);
});
