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

// Serializa redefinições da mesma conta e consome o token na mesma transação.
async function consumeAndReset({ tokenId, userId, passwordHash }) {
 const connection=await pool.getConnection();
 try {
  await connection.beginTransaction();
  const [users]=await connection.query('SELECT id FROM users WHERE id=? FOR UPDATE',[userId]);
  if(!users.length){await connection.rollback();return false;}
  const [tokens]=await connection.query('SELECT id FROM password_reset_tokens WHERE id=? AND user_id=? AND used_at IS NULL AND expires_at > NOW() FOR UPDATE',[tokenId,userId]);
  if(!tokens.length){await connection.rollback();return false;}
  await connection.query('UPDATE users SET password_hash=?, session_version=session_version+1, failed_login_count=0, locked_until=NULL WHERE id=?',[passwordHash,userId]);
  await connection.query('UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=? AND used_at IS NULL',[userId]);
  await connection.commit();return true;
 } catch(err){await connection.rollback();throw err;} finally{connection.release();}
}
module.exports = { consumeAndReset, createToken, findValidByHash, markUsed, invalidateAllForUser };
