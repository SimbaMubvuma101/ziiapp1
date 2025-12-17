
import pkg from 'pg';
const { Pool } = pkg;

console.log('Initializing database connection...');
console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
console.log('Environment NODE_ENV:', process.env.NODE_ENV);
console.log('Replit deployment:', !!process.env.REPL_DEPLOYMENT);

// For production deployments, helium database hostname won't work
// Fall back to localhost which works with PostgreSQL module
let dbUrl = process.env.DATABASE_URL;
if (dbUrl && dbUrl.includes('helium') && process.env.REPL_DEPLOYMENT === '1') {
  console.log('Detected production deployment with helium URL, using localhost instead');
  dbUrl = 'postgresql://postgres:password@localhost/postgres?sslmode=disable';
}

// Database configuration with connection pooling and error handling
const poolConfig = {
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === 'production' && !dbUrl.includes('localhost') ? {
    rejectUnauthorized: false
  } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

export const pool = new Pool(poolConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// Test connection on startup
async function testConnection(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      console.log('Database connection successful:', result.rows[0]);
      return true;
    } catch (err) {
      console.error(`Database connection attempt ${i + 1} failed:`, err.message);
      if (i < retries - 1) {
        console.log(`Retrying in ${(i + 1) * 2} seconds...`);
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 2000));
      }
    }
  }
  console.error('All database connection attempts failed');
  return false;
}

testConnection();

// Initialize database schema
export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Drop all tables if they exist (clean slate)
    await client.query(`
      DROP TABLE IF EXISTS transactions CASCADE;
      DROP TABLE IF EXISTS entries CASCADE;
      DROP TABLE IF EXISTS vouchers CASCADE;
      DROP TABLE IF EXISTS creator_invites CASCADE;
      DROP TABLE IF EXISTS affiliates CASCADE;
      DROP TABLE IF EXISTS platform_settings CASCADE;
      DROP TABLE IF EXISTS predictions CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // Create users table
    await client.query(`
      CREATE TABLE users (
        uid VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone_number VARCHAR(50) DEFAULT '',
        password_hash VARCHAR(255) NOT NULL,
        balance DECIMAL(10, 2) DEFAULT 0,
        winnings_balance DECIMAL(10, 2) DEFAULT 0,
        level INTEGER DEFAULT 1,
        xp INTEGER DEFAULT 0,
        photo_file_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        is_admin BOOLEAN DEFAULT false,
        country VARCHAR(2) DEFAULT 'ZW',
        affiliate_id VARCHAR(255),
        referred_by VARCHAR(255),
        is_creator BOOLEAN DEFAULT false,
        creator_name VARCHAR(255),
        creator_country VARCHAR(2),
        total_events_created INTEGER DEFAULT 0,
        total_commission_earned DECIMAL(10, 2) DEFAULT 0,
        email_verified BOOLEAN DEFAULT true,
        verification_token VARCHAR(255)
      )
    `);

    // Create predictions table
    await client.query(`
      CREATE TABLE predictions (
        id VARCHAR(255) PRIMARY KEY,
        question TEXT NOT NULL,
        category VARCHAR(100),
        country VARCHAR(2),
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'open',
        pool_size DECIMAL(10, 2) DEFAULT 0,
        closes_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        liquidity_pool JSONB,
        mode VARCHAR(50) DEFAULT 'normal',
        multiplier DECIMAL(5, 2) DEFAULT 1,
        resolution_source TEXT,
        created_by_creator VARCHAR(255),
        creator_name VARCHAR(255),
        creator_share DECIMAL(10, 2) DEFAULT 0,
        winning_option_id VARCHAR(255),
        options JSONB
      )
    `);

    // Create entries table
    await client.query(`
      CREATE TABLE entries (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(uid),
        username VARCHAR(255) NOT NULL,
        prediction_id VARCHAR(255) NOT NULL REFERENCES predictions(id),
        prediction_question TEXT NOT NULL,
        selected_option_id VARCHAR(255) NOT NULL,
        selected_option_label VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        potential_payout DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        celebrated BOOLEAN DEFAULT false
      )
    `);

    // Create transactions table
    await client.query(`
      CREATE TABLE transactions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(uid),
        type VARCHAR(50) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        payment_method VARCHAR(50)
      )
    `);

    // Create vouchers table
    await client.query(`
      CREATE TABLE vouchers (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(255) REFERENCES users(uid),
        redeemed_by VARCHAR(255) REFERENCES users(uid),
        redeemed_at TIMESTAMP
      )
    `);

    // Create affiliates table
    await client.query(`
      CREATE TABLE affiliates (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        total_volume DECIMAL(10, 2) DEFAULT 0,
        commission_owed DECIMAL(10, 2) DEFAULT 0,
        active_users_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create creator_invites table
    await client.query(`
      CREATE TABLE creator_invites (
        id SERIAL PRIMARY KEY,
        code VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        country VARCHAR(10) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        created_by VARCHAR(255) REFERENCES users(uid),
        claimed_by VARCHAR(255) REFERENCES users(uid),
        claimed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create platform_settings table
    await client.query(`
      CREATE TABLE platform_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        maintenance_mode BOOLEAN DEFAULT false,
        welcome_bonus DECIMAL(10, 2) DEFAULT 100,
        referral_bonus DECIMAL(10, 2) DEFAULT 10,
        min_cashout DECIMAL(10, 2) DEFAULT 5,
        banner_message TEXT DEFAULT 'Welcome to Zii!',
        banner_active BOOLEAN DEFAULT false,
        CHECK (id = 1)
      )
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX idx_predictions_status ON predictions(status);
      CREATE INDEX idx_predictions_country ON predictions(country);
      CREATE INDEX idx_predictions_closes_at ON predictions(closes_at);
      CREATE INDEX idx_predictions_creator ON predictions(created_by_creator);
      CREATE INDEX idx_entries_user_id ON entries(user_id);
      CREATE INDEX idx_entries_prediction_id ON entries(prediction_id);
      CREATE INDEX idx_entries_status ON entries(status);
      CREATE INDEX idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX idx_transactions_created_at ON transactions(created_at);
    `);

    // Insert default platform settings
    await client.query(`
      INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('Database schema initialized');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Database initialization error:', err);
    throw err;
  } finally {
    client.release();
  }
}
