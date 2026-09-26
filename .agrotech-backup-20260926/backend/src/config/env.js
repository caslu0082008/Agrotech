// Carrega e valida as variáveis de ambiente usadas pela aplicação.
// Centralizar aqui evita "process.env.X" espalhado pelo código
// e falha rápido (fail-fast) se algo essencial estiver faltando.

require('dotenv').config();

function required(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    // Em produção, segredos ausentes são um erro fatal.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
    }
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: parseInt(process.env.PORT, 10) || 3000,

  frontendOrigins: (process.env.FRONTEND_ORIGIN || 'http://localhost:5500')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'agrotech',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
  },

  jwt: {
    secret: required('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    expiresInRemember: process.env.JWT_EXPIRES_IN_REMEMBER || '30d',
  },

  cookie: {
    name: process.env.COOKIE_NAME || 'agrotech_token',
    secure: process.env.COOKIE_SECURE === 'true',
  },

  resetPassword: {
    expiresMinutes: parseInt(process.env.RESET_TOKEN_EXPIRES_MINUTES, 10) || 30,
    url: process.env.RESET_PASSWORD_URL || 'http://localhost:5500/reset-senha.html',
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'AgroTech <no-reply@agrotech.com>',
  },

  authRateLimit: {
    windowMinutes: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES, 10) || 15,
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 10,
  },
};

module.exports = env;
