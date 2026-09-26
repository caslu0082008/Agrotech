const { pool } = require('../config/db');
const fields = 'id, nome, email, role, status, created_at, updated_at';
async function list({ search, limit, offset }) {
  const pattern = '%' + search + '%';
  const [rows] = await pool.query('SELECT ' + fields + ' FROM users WHERE nome LIKE ? OR email LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?', [pattern, pattern, limit, offset]);
  const [[count]] = await pool.query('SELECT COUNT(*) AS total FROM users WHERE nome LIKE ? OR email LIKE ?', [pattern, pattern]);
  return { users: rows, total: count.total };
}
async function find(id) { const [rows] = await pool.query('SELECT ' + fields + ' FROM users WHERE id = ?', [id]); return rows[0] || null; }
async function setStatus(id, status) {
  const [result] = await pool.query("UPDATE users SET status = ?, session_version = session_version + 1 WHERE id = ? AND role = 'user'", [status, id]);
  return result.affectedRows > 0;
}
module.exports = { list, find, setStatus };