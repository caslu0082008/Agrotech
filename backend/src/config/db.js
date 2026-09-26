
const mysql = require('mysql2/promise');
const env = require('./env');

// Certificado CA fornecido pelo Aiven.
// Em produção, exigimos SSL com validação do certificado.
const ssl = process.env.NODE_ENV === 'production'
  ? {
      ca: Buffer.from(
        process.env.DB_SSL_CA_BASE64 || '',
        'base64'
      ).toString('utf8'),
      rejectUnauthorized: true,
    }
  : undefined;

if (process.env.NODE_ENV === 'production' && !process.env.DB_SSL_CA_BASE64) {
  throw new Error('Configure DB_SSL_CA_BASE64 com o certificado CA do Aiven.');
}

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
  ssl,
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
