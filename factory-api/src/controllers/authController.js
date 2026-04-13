const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');
const ApiError = require('../utils/ApiError');

const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: Number.parseInt(process.env.COOKIE_MAX_AGE_MS || '604800000', 10),
};

// In-memory refresh token store (replace with DB in production)
const refreshTokens = new Map();

function generateAccessToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
}

function generateRefreshToken(user) {
  const token = jwt.sign({ id: user.id, type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: '30d' });
  refreshTokens.set(token, user.id);
  return token;
}

function revokeRefreshToken(token) {
  refreshTokens.delete(token);
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
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role',
      [name, email, hashed, role]
    );
    const user = result.rows[0];
    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
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
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new ApiError(401, req.t('errors.invalid_credentials', 'Invalid credentials'));
    }
    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    res.cookie('token', token, authCookieOptions);
    res.json({ token, refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
};

// POST /auth/refresh
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new ApiError(400, req.t('errors.missing_refresh_token', 'Missing refresh token'));
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (payload.type !== 'refresh' || !refreshTokens.has(refreshToken)) {
      throw new ApiError(401, req.t('errors.invalid_refresh_token', 'Invalid refresh token'));
    }
    // Optionally rotate refresh token
    refreshTokens.delete(refreshToken);
    const userResult = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [payload.id]);
    if (!userResult.rows.length) throw new ApiError(401, req.t('errors.user_not_found', 'User not found'));
    const user = userResult.rows[0];
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
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
    if (refreshToken) revokeRefreshToken(refreshToken);
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
