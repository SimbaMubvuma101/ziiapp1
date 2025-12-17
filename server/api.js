import express from 'express';
import crypto from 'crypto';
import { pool } from './db.js';
import { 
  hashPassword, 
  comparePassword, 
  generateToken, 
  generateVerificationToken,
  authenticateMiddleware,
  adminMiddleware 
} from './auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// ============ HEALTH CHECK ============
router.get('/health', async (req, res) => {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      deployment: process.env.REPL_DEPLOYMENT ? 'production' : 'development'
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected',
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

// ============ HQ BYPASS TOKEN ============
router.post('/auth/hq-token', async (req, res) => {
  try {
    // Generate a temporary admin token for HQ access
    // This bypasses normal authentication but still provides admin privileges
    const token = generateToken({ 
      uid: 'hq-bypass', 
      email: 'admin@zii.app', 
      isAdmin: true,
      is_admin: true 
    });
    
    res.json({ token });
  } catch (err) {
    console.error('HQ token error:', err);
    res.status(500).json({ error: 'Failed to generate HQ token' });
  }
});

// ============ AUTH ROUTES ============

router.post('/auth/register', async (req, res) => {
  try {
    console.log('Registration attempt:', { email: req.body.email, hasPassword: !!req.body.password });
    const { name, email, password, phone, referralCode, affiliateId, country } = req.body;

    console.log('Registration attempt:', { name, email, phone, country, hasPassword: !!password });

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Check if user exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const uid = uuidv4();
    const passwordHash = await hashPassword(password);
    const verificationToken = generateVerificationToken();

    await pool.query('BEGIN');

    // Get platform settings for welcome bonus
    const settingsResult = await pool.query('SELECT welcome_bonus FROM platform_settings WHERE id = 1');
    const welcomeBonus = settingsResult.rows[0]?.welcome_bonus || 100;

    // Create user with country
    await pool.query(
      `INSERT INTO users (uid, name, email, phone_number, password_hash, balance, verification_token, affiliate_id, referred_by, country)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [uid, name, email, phone || '', passwordHash, welcomeBonus, verificationToken, affiliateId || null, referralCode || null, country || 'ZW']
    );

    // Create welcome transaction
    await pool.query(
      `INSERT INTO transactions (user_id, type, amount, description)
       VALUES ($1, 'deposit', $2, 'Welcome Bonus')`,
      [uid, welcomeBonus]
    );

    await pool.query('COMMIT');

    const token = generateToken({ uid, email, is_admin: email === 'admin@zii.app' });

    console.log('Registration successful:', uid);

    res.status(200).json({ token, user: { uid, name, email, balance: welcomeBonus, country: country || 'ZW' } });
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('Registration error:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      code: err.code
    });
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    console.log('Login attempt:', { email: req.body.email, hasPassword: !!req.body.password });
    const { email, password } = req.body;

    console.log('Login attempt:', { email, hasPassword: !!password });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await comparePassword(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({ ...user, is_admin: user.email === 'admin@zii.app' });
    const { password_hash, verification_token, ...userData } = user;

    res.json({ token, user: userData });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/auth/me', authenticateMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE uid = $1',
      [req.user.uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password_hash, verification_token, ...userData } = result.rows[0];
    res.json(userData);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ============ PREDICTIONS ROUTES ============

router.get('/predictions', async (req, res) => {
  try {
    const { status = 'open', category, country, creatorId, eventId } = req.query;

    let query = 'SELECT * FROM predictions WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (eventId) {
      query += ` AND id = $${paramIndex++}`;
      params.push(eventId);
    } else {
      if (status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(status);
      }
      if (category) {
        query += ` AND category = $${paramIndex++}`;
        params.push(category);
      }
      if (country) {
        query += ` AND country = $${paramIndex++}`;
        params.push(country);
      }
      if (creatorId) {
        query += ` AND created_by_creator = $${paramIndex++}`;
        params.push(creatorId);
      }
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch predictions error:', err);
    res.status(500).json({ error: 'Failed to fetch predictions' });
  }
});

router.post('/predictions', authenticateMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { question, category, country, type, closes_at, resolution_source, options, liquidity_pool } = req.body;

    await client.query('BEGIN');

    const predictionId = uuidv4();

    // Get creator info
    const userResult = await client.query('SELECT creator_name FROM users WHERE uid = $1', [req.user.uid]);
    const creatorName = userResult.rows[0]?.creator_name;

    await client.query(
      `INSERT INTO predictions (id, question, category, country, type, status, closes_at, resolution_source, 
       created_by_creator, creator_name, options, liquidity_pool)
       VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, $8, $9, $10, $11)`,
      [predictionId, question, category, country, type, closes_at, resolution_source, 
       req.user.uid, creatorName, JSON.stringify(options), JSON.stringify(liquidity_pool)]
    );

    // Update creator stats
    await client.query(
      'UPDATE users SET total_events_created = total_events_created + 1 WHERE uid = $1',
      [req.user.uid]
    );

    await client.query('COMMIT');

    res.json({ id: predictionId, message: 'Prediction created' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create prediction error:', err);
    res.status(500).json({ error: 'Failed to create prediction' });
  } finally {
    client.release();
  }
});

router.post('/predictions/:id/resolve', authenticateMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { winning_option_id } = req.body;

    await client.query('BEGIN');

    // Get prediction details
    const predResult = await client.query('SELECT * FROM predictions WHERE id = $1', [id]);
    if (predResult.rows.length === 0) {
      throw new Error('Prediction not found');
    }

    const prediction = predResult.rows[0];

    // Get all entries
    const entriesResult = await client.query('SELECT * FROM entries WHERE prediction_id = $1', [id]);
    const entries = entriesResult.rows;

    const totalPool = entries.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const platformCommission = totalPool * 0.05;
    const creatorCommission = platformCommission * 0.5;
    const distributablePool = totalPool - platformCommission;

    const winners = entries.filter(e => e.selected_option_id === winning_option_id);
    const losers = entries.filter(e => e.selected_option_id !== winning_option_id);
    const winningVolume = winners.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const payoutRatio = winningVolume > 0 ? (distributablePool / winningVolume) : 0;

    // Update prediction
    await client.query(
      `UPDATE predictions SET status = 'resolved', winning_option_id = $1, creator_share = $2 WHERE id = $3`,
      [winning_option_id, creatorCommission, id]
    );

    // Credit creator
    if (prediction.created_by_creator) {
      await client.query(
        `UPDATE users SET winnings_balance = winnings_balance + $1, 
         total_commission_earned = total_commission_earned + $1 WHERE uid = $2`,
        [creatorCommission, prediction.created_by_creator]
      );

      await client.query(
        `INSERT INTO transactions (user_id, type, amount, description)
         VALUES ($1, 'winnings', $2, $3)`,
        [prediction.created_by_creator, creatorCommission, `Creator Commission: ${prediction.question.substring(0, 20)}...`]
      );
    }

    // Process winners
    for (const entry of winners) {
      const actualPayout = parseFloat(entry.amount) * payoutRatio;

      await client.query(
        'UPDATE entries SET status = $1, potential_payout = $2 WHERE id = $3',
        ['won', actualPayout, entry.id]
      );

      await client.query(
        'UPDATE users SET winnings_balance = winnings_balance + $1 WHERE uid = $2',
        [actualPayout, entry.user_id]
      );

      await client.query(
        `INSERT INTO transactions (user_id, type, amount, description)
         VALUES ($1, 'winnings', $2, $3)`,
        [entry.user_id, actualPayout, `Won: ${prediction.question.substring(0, 15)}...`]
      );
    }

    // Process losers
    for (const entry of losers) {
      await client.query(
        'UPDATE entries SET status = $1, potential_payout = 0 WHERE id = $2',
        ['lost', entry.id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Prediction resolved', commission: creatorCommission });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Resolve prediction error:', err);
    res.status(500).json({ error: 'Failed to resolve prediction' });
  } finally {
    client.release();
  }
});

router.delete('/predictions/:id', authenticateMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Check if prediction exists
    const predResult = await client.query('SELECT * FROM predictions WHERE id = $1', [id]);
    if (predResult.rows.length === 0) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    // Delete associated entries first
    await client.query('DELETE FROM entries WHERE prediction_id = $1', [id]);

    // Delete the prediction
    await client.query('DELETE FROM predictions WHERE id = $1', [id]);

    await client.query('COMMIT');
    res.json({ message: 'Prediction deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete prediction error:', err);
    res.status(500).json({ error: 'Failed to delete prediction' });
  } finally {
    client.release();
  }
});

// ============ ENTRIES ROUTES ============

router.get('/entries', authenticateMiddleware, async (req, res) => {
  try {
    const { status } = req.query;

    let query = 'SELECT e.*, p.question, p.status as prediction_status, p.options FROM entries e JOIN predictions p ON e.prediction_id = p.id WHERE e.user_id = $1';
    const params = [req.user.uid];

    if (status) {
      query += ' AND e.status = $2';
      params.push(status);
    }

    query += ' ORDER BY e.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch entries error:', err);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

router.post('/entries', authenticateMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { prediction_id, selected_option_id, amount } = req.body;

    await client.query('BEGIN');

    // Check user balance
    const userResult = await client.query('SELECT balance FROM users WHERE uid = $1', [req.user.uid]);
    if (userResult.rows[0].balance < amount) {
      throw new Error('Insufficient balance');
    }

    // Deduct balance
    await client.query(
      'UPDATE users SET balance = balance - $1 WHERE uid = $2',
      [amount, req.user.uid]
    );

    // Create entry
    const entryId = uuidv4();
    await client.query(
      `INSERT INTO entries (id, user_id, prediction_id, selected_option_id, amount, status)
       VALUES ($1, $2, $3, $4, $5, 'active')`,
      [entryId, req.user.uid, prediction_id, selected_option_id, amount]
    );

    // Update prediction pool
    await client.query(
      'UPDATE predictions SET pool_size = pool_size + $1 WHERE id = $2',
      [amount, prediction_id]
    );

    // Create transaction
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, description)
       VALUES ($1, 'bet', $2, 'Placed entry')`,
      [req.user.uid, -amount]
    );

    await client.query('COMMIT');
    res.json({ id: entryId, message: 'Entry placed' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Place entry error:', err);
    res.status(500).json({ error: err.message || 'Failed to place entry' });
  } finally {
    client.release();
  }
});

// ============ WALLET ROUTES ============

router.get('/wallet/balance', authenticateMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT balance, winnings_balance FROM users WHERE uid = $1',
      [req.user.uid]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get balance error:', err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

router.get('/transactions', authenticateMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.uid]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

router.post('/wallet/redeem', authenticateMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { code } = req.body;

    await client.query('BEGIN');

    const voucherResult = await client.query(
      'SELECT * FROM vouchers WHERE code = $1 AND status = $2',
      [code, 'active']
    );

    if (voucherResult.rows.length === 0) {
      throw new Error('Invalid or already redeemed voucher');
    }

    const voucher = voucherResult.rows[0];

    await client.query(
      'UPDATE vouchers SET status = $1, redeemed_by = $2, redeemed_at = CURRENT_TIMESTAMP WHERE id = $3',
      ['redeemed', req.user.uid, voucher.id]
    );

    await client.query(
      'UPDATE users SET balance = balance + $1 WHERE uid = $2',
      [voucher.amount, req.user.uid]
    );

    await client.query(
      `INSERT INTO transactions (user_id, type, amount, description)
       VALUES ($1, 'deposit', $2, 'Voucher redeemed')`,
      [req.user.uid, voucher.amount]
    );

    await client.query('COMMIT');
    res.json({ message: 'Voucher redeemed', amount: voucher.amount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Redeem voucher error:', err);
    res.status(400).json({ error: err.message || 'Failed to redeem voucher' });
  } finally {
    client.release();
  }
});

// ============ ADMIN ROUTES ============

router.get('/admin/stats', authenticateMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
    const predCount = await pool.query('SELECT COUNT(*) as count FROM predictions');
    res.json({ 
      users: parseInt(userCount.rows[0].count), 
      predictions: parseInt(predCount.rows[0].count) 
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/admin/analytics', authenticateMiddleware, adminMiddleware, async (req, res) => {
  try {
    // Get transaction totals
    const entryVolume = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'entry'
    `);
    const cashoutVolume = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'cashout'
    `);
    const txCount = await pool.query('SELECT COUNT(*) as count FROM transactions');

    // Get fee calculations (5% entry, 10% cashout)
    const entryFees = parseFloat(entryVolume.rows[0].total) * 0.05;
    const cashoutFees = parseFloat(cashoutVolume.rows[0].total) * 0.10;

    // Time-based volume calculations
    const volumeToday = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
      WHERE created_at >= CURRENT_DATE
    `);
    const volumeWeek = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
      WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)
    `);
    const volumeMonth = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `);

    // Revenue calculations
    const revenueToday = parseFloat(volumeToday.rows[0].total) * 0.05;
    const revenueWeek = parseFloat(volumeWeek.rows[0].total) * 0.05;
    const revenueMonth = parseFloat(volumeMonth.rows[0].total) * 0.05;

    const totalVolume = parseFloat(entryVolume.rows[0].total) + parseFloat(cashoutVolume.rows[0].total);
    const totalRevenue = entryFees + cashoutFees;

    res.json({
      totalRevenue,
      entryFees,
      cashoutFees,
      revenueToday,
      revenueWeek,
      revenueMonth,
      avgMonthlyRevenue: revenueMonth,
      totalVolume,
      entryVolume: parseFloat(entryVolume.rows[0].total),
      cashoutVolume: parseFloat(cashoutVolume.rows[0].total),
      volumeToday: parseFloat(volumeToday.rows[0].total),
      volumeWeek: parseFloat(volumeWeek.rows[0].total),
      volumeMonth: parseFloat(volumeMonth.rows[0].total),
      txCount: parseInt(txCount.rows[0].count) || 1
    });
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM platform_settings WHERE id = 1');
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/settings', authenticateMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { maintenance_mode, welcome_bonus, referral_bonus, min_cashout, banner_message, banner_active } = req.body;

    await pool.query(
      `UPDATE platform_settings SET 
       maintenance_mode = $1, welcome_bonus = $2, referral_bonus = $3,
       min_cashout = $4, banner_message = $5, banner_active = $6
       WHERE id = 1`,
      [maintenance_mode, welcome_bonus, referral_bonus, min_cashout, banner_message, banner_active]
    );

    res.json({ message: 'Settings updated' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ============ CREATOR INVITES ============

router.get('/admin/creator-invites', authenticateMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM creator_invites ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get creator invites error:', err);
    res.status(500).json({ error: 'Failed to fetch creator invites' });
  }
});

router.post('/admin/creator-invites', authenticateMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, country } = req.body;
    const code = `CREATOR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const result = await pool.query(
      `INSERT INTO creator_invites (code, name, country, status, created_by)
       VALUES ($1, $2, $3, 'active', $4) RETURNING *`,
      [code, name, country, req.user.uid]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Create creator invite error:', err);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

router.post('/admin/creator-invites/:id/revoke', authenticateMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query(
      'UPDATE creator_invites SET status = $1 WHERE id = $2',
      ['revoked', req.params.id]
    );
    res.json({ message: 'Invite revoked' });
  } catch (err) {
    console.error('Revoke invite error:', err);
    res.status(500).json({ error: 'Failed to revoke invite' });
  }
});

router.get('/creator-invites/validate/:code', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM creator_invites WHERE code = $1 AND status = $2',
      [req.params.code, 'active']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Validate invite error:', err);
    res.status(500).json({ error: 'Failed to validate invite' });
  }
});

router.post('/creator-invites/claim', async (req, res) => {
  const client = await pool.connect();
  try {
    const { code, email, password } = req.body;

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    await client.query('BEGIN');

    const inviteResult = await client.query(
      'SELECT * FROM creator_invites WHERE code = $1 AND status = $2',
      [code, 'active']
    );

    if (inviteResult.rows.length === 0) {
      throw new Error('Invalid or expired invite');
    }

    const invite = inviteResult.rows[0];

    // Check if user already exists
    const existingUser = await client.query(
      'SELECT uid FROM users WHERE email = $1',
      [email]
    );

    let userId;

    if (existingUser.rows.length > 0) {
      // User exists, just upgrade them to creator
      userId = existingUser.rows[0].uid;

      await client.query(
        `UPDATE users SET 
         is_creator = true, 
         creator_name = $1, 
         creator_country = $2,
         total_events_created = COALESCE(total_events_created, 0),
         total_commission_earned = COALESCE(total_commission_earned, 0)
         WHERE uid = $3`,
        [invite.name, invite.country, userId]
      );
    } else {
      // Create new user account
      userId = uuidv4();
      const hashedPassword = await hashPassword(password);

      await client.query(
        `INSERT INTO users (
          uid, email, password_hash, name, phone_number, country,
          is_creator, creator_name, creator_country,
          balance, winnings_balance, level, xp,
          email_verified, is_admin, total_events_created, total_commission_earned
        ) VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, 0, 0, 1, 0, true, false, 0, 0)`,
        [userId, email, hashedPassword, invite.name, '', invite.country, invite.name, invite.country]
      );
    }

    // Mark invite as claimed
    await client.query(
      'UPDATE creator_invites SET status = $1, claimed_by = $2, claimed_at = CURRENT_TIMESTAMP WHERE id = $3',
      ['claimed', userId, invite.id]
    );

    await client.query('COMMIT');

    // Generate auth token
    const token = generateToken({ uid: userId, email, isAdmin: false });

    res.json({ 
      message: 'Creator invite claimed',
      token,
      user: {
        uid: userId,
        email,
        name: invite.name,
        isCreator: true,
        creator_name: invite.name,
        creator_country: invite.country
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Claim invite error:', err);
    res.status(400).json({ error: err.message || 'Failed to claim invite' });
  } finally {
    client.release();
  }
});

// ============ PROFILE UPDATE ============

router.put('/auth/profile', authenticateMiddleware, async (req, res) => {
  try {
    const { name, phone, country } = req.body;
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (phone) {
      updates.push(`phone_number = $${paramIndex++}`);
      params.push(phone);
    }
    if (country) {
      updates.push(`country = $${paramIndex++}`);
      params.push(country);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    params.push(req.user.uid);
    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE uid = $${paramIndex}`,
      params
    );

    res.json({ message: 'Profile updated' });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ============ DELETE ACCOUNT ============

router.delete('/auth/delete-account', authenticateMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete user's entries
    await client.query('DELETE FROM entries WHERE user_id = $1', [req.user.uid]);

    // Delete user's transactions
    await client.query('DELETE FROM transactions WHERE user_id = $1', [req.user.uid]);

    // Delete user
    await client.query('DELETE FROM users WHERE uid = $1', [req.user.uid]);

    await client.query('COMMIT');
    res.json({ message: 'Account deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  } finally {
    client.release();
  }
});

// ============ AFFILIATE VALIDATION ============

router.get('/affiliates/validate', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const result = await pool.query(
      'SELECT * FROM affiliates WHERE code = $1',
      [code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Affiliate not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Validate affiliate error:', err);
    res.status(500).json({ error: 'Failed to validate affiliate' });
  }
});

// ============ CASHOUT ============

router.post('/wallet/cashout', authenticateMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { amount, phone, method } = req.body;

    await client.query('BEGIN');

    const userResult = await client.query('SELECT winnings_balance FROM users WHERE uid = $1', [req.user.uid]);
    const currentBalance = userResult.rows[0].winnings_balance;

    if (currentBalance < amount) {
      throw new Error('Insufficient balance');
    }

    const fee = amount * 0.10;
    const netAmount = amount - fee;

    await client.query(
      'UPDATE users SET winnings_balance = winnings_balance - $1 WHERE uid = $2',
      [amount, req.user.uid]
    );

    await client.query(
      `INSERT INTO transactions (user_id, type, amount, description, payment_method)
       VALUES ($1, 'cashout', $2, $3, $4)`,
      [req.user.uid, -amount, `Cashout to ${phone}`, method]
    );

    await client.query('COMMIT');
    res.json({ message: 'Cashout request submitted', net_amount: netAmount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Cashout error:', err);
    res.status(400).json({ error: err.message || 'Failed to process cashout' });
  } finally {
    client.release();
  }
});

export default router;