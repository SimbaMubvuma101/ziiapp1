
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

const router = express.Router();

// Create Stripe checkout session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { userId, coins, amount } = req.body;

    if (!userId || !coins || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

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
      success_url: `${process.env.BASE_URL || 'http://localhost:5000'}/#/wallet?payment=success`,
      cancel_url: `${process.env.BASE_URL || 'http://localhost:5000'}/#/wallet?payment=cancelled`,
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

// Stripe webhook to handle successful payments
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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

module.exports = router;
