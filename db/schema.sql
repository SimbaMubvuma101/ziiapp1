
-- Users table
CREATE TABLE IF NOT EXISTS users (
    uid VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    balance DECIMAL(10, 2) DEFAULT 0,
    winnings_balance DECIMAL(10, 2) DEFAULT 0,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    photo_file_name VARCHAR(255),
    country VARCHAR(2) DEFAULT 'ZW',
    is_admin BOOLEAN DEFAULT FALSE,
    is_creator BOOLEAN DEFAULT FALSE,
    creator_name VARCHAR(255),
    creator_country VARCHAR(2),
    total_events_created INTEGER DEFAULT 0,
    total_commission_earned DECIMAL(10, 2) DEFAULT 0,
    affiliate_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Predictions table
CREATE TABLE IF NOT EXISTS predictions (
    id VARCHAR(255) PRIMARY KEY,
    question TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    country VARCHAR(2) DEFAULT 'ZW',
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    pool_size INTEGER DEFAULT 0,
    closes_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    mode VARCHAR(50) DEFAULT 'normal',
    multiplier DECIMAL(5, 2) DEFAULT 1,
    resolution_source TEXT,
    created_by_creator VARCHAR(255),
    creator_name VARCHAR(255),
    creator_share DECIMAL(10, 2) DEFAULT 0,
    winning_option_id VARCHAR(255),
    options JSONB NOT NULL,
    liquidity_pool JSONB
);

-- Entries table
CREATE TABLE IF NOT EXISTS entries (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(uid),
    username VARCHAR(255) NOT NULL,
    prediction_id VARCHAR(255) NOT NULL REFERENCES predictions(id),
    prediction_question TEXT NOT NULL,
    selected_option_id VARCHAR(255) NOT NULL,
    selected_option_label VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    potential_payout DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    celebrated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(uid),
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- Affiliates table
CREATE TABLE IF NOT EXISTS affiliates (
    id VARCHAR(255) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    total_volume DECIMAL(10, 2) DEFAULT 0,
    commission_owed DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Creator invites table
CREATE TABLE IF NOT EXISTS creator_invites (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    creator_name VARCHAR(255) NOT NULL,
    country VARCHAR(2) NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Platform settings table
CREATE TABLE IF NOT EXISTS platform_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    maintenance_mode BOOLEAN DEFAULT FALSE,
    welcome_bonus DECIMAL(10, 2) DEFAULT 100,
    referral_bonus DECIMAL(10, 2) DEFAULT 10,
    min_cashout DECIMAL(10, 2) DEFAULT 5,
    banner_message TEXT,
    banner_active BOOLEAN DEFAULT FALSE,
    CHECK (id = 1)
);

-- Insert default platform settings
INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Indexes for better performance
CREATE INDEX idx_predictions_status ON predictions(status);
CREATE INDEX idx_predictions_country ON predictions(country);
CREATE INDEX idx_predictions_closes_at ON predictions(closes_at);
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_entries_prediction_id ON entries(prediction_id);
CREATE INDEX idx_entries_status ON entries(status);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
