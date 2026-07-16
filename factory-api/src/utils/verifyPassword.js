const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const ApiError = require('./ApiError');

const verifyUserPassword = async (userId, password) => {
  const trimmed = String(password || '').trim();
  if (!trimmed) {
    throw new ApiError(400, 'Password is required');
  }

  const result = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
  if (!result.rows.length) {
    throw new ApiError(403, 'Invalid password');
  }

  const match = await bcrypt.compare(trimmed, result.rows[0].password);
  if (!match) {
    throw new ApiError(403, 'Invalid password');
  }
};

module.exports = { verifyUserPassword };
