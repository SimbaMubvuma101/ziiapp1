
import pkg from 'pg';
const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database schema
export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        uid VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone_number VARCHAR(50),
        password_hash VARCHAR(255) NOT NULL,
        balance DECIMAL(10, 2) DEFAULT 0,
        winnings_balance DECIMAL(10, 2) DEFAULT 0,
        level INTEGER DEFAULT 1,
        xp INTEGER DEFAULT 0,
        photo_file_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_admin BOOLEAN DEFAULT false,
        country VARCHAR(2) DEFAULT 'ZW',
        affiliate_id VARCHAR(255),
        referred_by VARCHAR(255),
        is_creator BOOLEAN DEFAULT false,
        creator_name VARCHAR(255),
        creator_country VARCHAR(2),
        total_events_created INTEGER DEFAULT 0,
        total_commission_earned DECIMAL(10, 2) DEFAULT 0,
        email_verified BOOLEAN DEFAULT false,
        verification_token VARCHAR(255)
      );

      CREATE TABLE IF NOT EXISTS predictions (
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
      );

      CREATE TABLE IF NOT EXISTS entries (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(uid),
        prediction_id VARCHAR(255) REFERENCES predictions(id),
        selected_option_id VARCHAR(255),
        amount DECIMAL(10, 2) NOT NULL,
        potential_payout DECIMAL(10, 2),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        celebrated BOOLEAN DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(uid),
        type VARCHAR(50) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        payment_method VARCHAR(50),
        stripe_session_id VARCHAR(255)
      );

      CREATE TABLE IF NOT EXISTS vouchers (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(255) REFERENCES users(uid),
        redeemed_by VARCHAR(255) REFERENCES users(uid),
        redeemed_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS affiliates (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        total_volume DECIMAL(10, 2) DEFAULT 0,
        commission_owed DECIMAL(10, 2) DEFAULT 0,
        active_users_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS platform_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        maintenance_mode BOOLEAN DEFAULT false,
        welcome_bonus DECIMAL(10, 2) DEFAULT 100,
        referral_bonus DECIMAL(10, 2) DEFAULT 10,
        min_cashout DECIMAL(10, 2) DEFAULT 5,
        banner_message TEXT DEFAULT 'Welcome to Zii!',
        banner_active BOOLEAN DEFAULT false,
        CHECK (id = 1)
      );

      CREATE TABLE IF NOT EXISTS creator_invites (
        id VARCHAR(255) PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        creator_name VARCHAR(255) NOT NULL,
        country VARCHAR(2),
        status VARCHAR(50) DEFAULT 'active',
        claimed_by VARCHAR(255) REFERENCES users(uid),
        claimed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_predictions_status ON predictions(status);
      CREATE INDEX IF NOT EXISTS idx_predictions_creator ON predictions(created_by_creator);
      CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_entries_prediction ON entries(prediction_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);

      INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Database schema initialized');
  } finally {
    client.release();
  }
}
