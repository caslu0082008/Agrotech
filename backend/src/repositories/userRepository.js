// Camada de acesso a dados para a tabela `users`.
// Todas as queries usam placeholders (?) — nunca concatenação de string —
// para eliminar risco de SQL Injection.

const { pool } = require('../config/db');

const PUBLIC_FIELDS = 'id, nome, email, role, status, session_version, created_at, updated_at';

async function findByEmail(email) {
  const [rows] = await pool.query(
    'SELECT id, nome, email, password_hash, role, status, session_version, failed_login_count, locked_until, created_at, updated_at ' +
      'FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

async function createUser({ nome, email, passwordHash }) {
  const [result] = await pool.query(
    'INSERT INTO users (nome, email, password_hash) VALUES (?, ?, ?)',
    [nome, email, passwordHash]
  );
  return findById(result.insertId);
}

async function updatePasswordHash(userId, passwordHash) {
  await pool.query(
    'UPDATE users SET password_hash = ?, session_version = session_version + 1, failed_login_count = 0, locked_until = NULL WHERE id = ?',
    [passwordHash, userId]
  );
}

async function incrementFailedLogin(userId) {
  await pool.query(
    'UPDATE users SET failed_login_count = failed_login_count + 1 WHERE id = ?',
    [userId]
  );
}

async function lockUser(userId, lockedUntil) {
  await pool.query('UPDATE users SET locked_until = ? WHERE id = ?', [lockedUntil, userId]);
}

async function resetFailedLogin(userId) {
  await pool.query(
    'UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = ?',
    [userId]
  );
}

async function revokeSessions(id) {
  await pool.query('UPDATE users SET session_version = session_version + 1 WHERE id = ?', [id]);
}
module.exports = { revokeSessions,
  findByEmail,
  findById,
  createUser,
  updatePasswordHash,
  incrementFailedLogin,
  lockUser,
  resetFailedLogin,
};
