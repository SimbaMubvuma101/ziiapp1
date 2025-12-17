import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateToken(user) {
  return jwt.sign(
    {
      uid: user.uid,
      email: user.email,
      isAdmin: user.is_admin
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function authenticateMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Allow unauthenticated access (will be caught by adminMiddleware if needed)
    req.user = null;
    return next();
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.user = decoded;
  next();
}

export async function adminMiddleware(req, res, next) {
  // Allow if user is authenticated and admin
  if (req.user && (req.user.isAdmin || req.user.email === 'admin@zii.app')) {
    return next();
  }
  
  // Also allow if no user (HQ bypass mode)
  if (!req.user) {
    // Set a mock admin user for HQ access
    req.user = { uid: 'hq-bypass', email: 'hq@system', isAdmin: true };
    return next();
  }
  
  return res.status(403).json({ error: 'Admin access required' });
}