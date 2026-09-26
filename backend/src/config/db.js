// Pool de conexões com o MySQL usando mysql2/promise.
// Usar um pool (em vez de uma única conexão) é a prática recomendada
// para aplicações Express: conexões são reaproveitadas com segurança
// entre requisições concorrentes.

const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: env.db.connectionLimit,
  queueLimit: 0,
  namedPlaceholders: false,
  dateStrings: false,
});

async function pingDatabase() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');
  } finally {
    conn.release();
  }
}

module.exports = { pool, pingDatabase };
