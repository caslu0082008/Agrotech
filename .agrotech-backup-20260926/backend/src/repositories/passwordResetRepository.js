// Camada de acesso a dados para `password_reset_tokens`.
// Apenas o HASH do token é persistido (nunca o token em texto puro).

const { pool } = require('../config/db');

async function createToken({ userId, tokenHash, expiresAt }) {
  await pool.query(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]
  );
}

async function findValidByHash(tokenHash) {
  const [rows] = await pool.query(
    'SELECT id, user_id, expires_at, used_at FROM password_reset_tokens ' +
      'WHERE token_hash = ? LIMIT 1',
    [tokenHash]
  );
  return rows[0] || null;
}

async function markUsed(tokenId) {
  await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [tokenId]);
}

async function invalidateAllForUser(userId) {
  await pool.query(
    'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
    [userId]
  );
}

module.exports = { createToken, findValidByHash, markUsed, invalidateAllForUser };
