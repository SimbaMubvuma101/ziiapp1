import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import { pool, initDatabase } from './server/db.js';
import apiRouter from './server/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Use Replit's PORT in deployment, 5000 in dev
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;

// CORS configuration - allow all origins
app.use(cors({
  origin: true, // Reflects the request origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// Initialize database
initDatabase()
  .then(() => {
    console.log('Database initialized successfully');
  })
  .catch((err) => {
    console.error('Database initialization failed:', err);
  });

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

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

// Parse JSON bodies - MUST come before routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging middleware for all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Mount API routes FIRST - before static files
app.use('/api', apiRouter);

// Add error handling middleware for API routes
app.use('/api', (err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ 
    error: err.message || 'Internal server error',
    path: req.path 
  });
});

// Serve static files from the dist directory - AFTER API routes
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  console.log('Serving static files from:', distPath);
  app.use(express.static(distPath));

  // Handle SPA routing - must come LAST
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.warn('Warning: dist directory not found. Static files will not be served.');
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Zii App Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Deployment: ${process.env.REPL_DEPLOYMENT === '1' ? 'Production' : 'Development'}`);
  console.log(`REPL_SLUG: ${process.env.REPL_SLUG || 'not set'}`);
  console.log(`REPL_OWNER: ${process.env.REPL_OWNER || 'not set'}`);
  
  if (process.env.DATABASE_URL) {
    console.log(`Database connected: ${process.env.DATABASE_URL.substring(0, 30)}...`);
  } else {
    console.warn('WARNING: DATABASE_URL not set!');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    pool.end();
  });
});