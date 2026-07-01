const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const ApiError = require('../utils/ApiError');

// SECURITY: bcrypt cost factor 12 (OWASP recommendation)
const BCRYPT_ROUNDS = 12;

const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: Number.parseInt(process.env.COOKIE_MAX_AGE_MS || '604800000', 10),
};

// SECURITY: Hash refresh tokens before storing in DB.
// If the database is compromised, raw tokens cannot be extracted.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateAccessToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
}

// SECURITY: Use a separate secret for refresh tokens (JWT_REFRESH_SECRET).
// If one secret leaks, the other token type remains uncompromised.
async function generateRefreshToken(user) {
  const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  const token = jwt.sign(
    { id: user.id, type: 'refresh', jti: crypto.randomBytes(16).toString('hex') },
    refreshSecret,
    { expiresIn: '30d' }
  );
  // Store hashed token, not the raw JWT
  const tokenHash = hashToken(token);
  await pool.query('INSERT INTO refresh_tokens (token, user_id) VALUES ($1, $2)', [tokenHash, user.id]);
  return token;
}

async function revokeRefreshToken(token) {
  const tokenHash = hashToken(token);
  await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [tokenHash]);
}

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       201:
 *         description: User registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       409:
 *         description: Email already registered
 *       400:
 *         description: Validation failed
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, invite } = req.body;
    const role = 'staff';
    // Public register is locked behind an invite code.
    if (!process.env.REGISTER_INVITE_CODE || invite !== process.env.REGISTER_INVITE_CODE) {
      throw new ApiError(403, req.t('errors.invite_required', 'Registration requires a valid invite code'));
    }
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) throw new ApiError(409, req.t('errors.email_registered', 'Email already registered'));
    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role',
      [name, email, hashed, role]
    );
    const user = result.rows[0];
    const token = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user);
    res.status(201).json({ user, token, refreshToken });
  } catch (err) { next(err); }
};

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login and receive a JWT token
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *       400:
 *         description: Validation failed
 */
// SECURITY: Account lockout constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Check if users table has lockout columns (backward compatible)
let hasLockoutColumnsCache = null;
const hasLockoutColumns = async () => {
  if (hasLockoutColumnsCache !== null) return hasLockoutColumnsCache;
  const result = await pool.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'failed_login_attempts'
    ) AS exists`
  );
  hasLockoutColumnsCache = Boolean(result.rows[0]?.exists);
  return hasLockoutColumnsCache;
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    const supportsLockout = await hasLockoutColumns();

    // SECURITY: Check if account is locked
    if (user && supportsLockout && user.locked_until) {
      const lockExpiry = new Date(user.locked_until);
      if (lockExpiry > new Date()) {
        const minutesLeft = Math.ceil((lockExpiry - new Date()) / 60000);
        throw new ApiError(423, req.t('errors.account_locked', `Account is temporarily locked. Try again in ${minutesLeft} minutes.`));
      }
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      // SECURITY: Increment failed attempts on bad credentials
      if (user && supportsLockout) {
        const newAttempts = (user.failed_login_attempts || 0) + 1;
        if (newAttempts >= MAX_FAILED_ATTEMPTS) {
          const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
          await pool.query(
            'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
            [newAttempts, lockUntil, user.id]
          );
        } else {
          await pool.query(
            'UPDATE users SET failed_login_attempts = $1 WHERE id = $2',
            [newAttempts, user.id]
          );
        }
      }
      throw new ApiError(401, req.t('errors.invalid_credentials', 'Invalid credentials'));
    }

    // SECURITY: Reset failed attempts on successful login
    if (supportsLockout && (user.failed_login_attempts > 0 || user.locked_until)) {
      await pool.query(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
        [user.id]
      );
    }

    const token = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user);
    res.cookie('token', token, authCookieOptions);
    res.json({ token, refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
};

// POST /auth/refresh
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new ApiError(400, req.t('errors.missing_refresh_token', 'Missing refresh token'));
    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    const payload = jwt.verify(refreshToken, refreshSecret);
    if (payload.type !== 'refresh') {
      throw new ApiError(401, req.t('errors.invalid_refresh_token', 'Invalid refresh token'));
    }
    // Look up by hash
    const tokenHash = hashToken(refreshToken);
    const dbToken = await pool.query('SELECT * FROM refresh_tokens WHERE token = $1', [tokenHash]);
    if (!dbToken.rows.length) {
      throw new ApiError(401, req.t('errors.invalid_refresh_token', 'Invalid refresh token'));
    }
    // Rotate: revoke old, issue new
    await revokeRefreshToken(refreshToken);
    const userResult = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [payload.id]);
    if (!userResult.rows.length) throw new ApiError(401, req.t('errors.user_not_found', 'User not found'));
    const user = userResult.rows[0];
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = await generateRefreshToken(user);
    res.json({ token: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return next(new ApiError(401, req.t('errors.invalid_refresh_token', 'Invalid refresh token')));
    }
    next(err);
  }
};

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Logout user (clear cookie)
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
const logout = async (req, res, next) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    // Optionally revoke refresh token on logout
    const { refreshToken } = req.body || {};
    if (refreshToken) await revokeRefreshToken(refreshToken);
    res.json({ message: req.t('auth.logged_out', 'Logged out') });
  } catch (err) { next(err); }
};

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get current user info
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user info
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
const me = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

/**
 * @openapi
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         email:
 *           type: string
 *         role:
 *           type: string
 */

module.exports = { register, login, refresh, me, logout };
