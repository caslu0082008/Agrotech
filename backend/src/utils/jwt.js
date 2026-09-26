const jwt = require('jsonwebtoken');
const env = require('../config/env');

// O payload do token NUNCA deve conter senha, hash de senha ou
// qualquer outro dado sensível — apenas o identificador do usuário.
function signAuthToken(user, { remember }) {
  const expiresIn = remember ? env.jwt.expiresInRemember : env.jwt.expiresIn;
  const token = jwt.sign({ sub: user.id, version: user.session_version || 0 }, env.jwt.secret, { expiresIn, algorithm: 'HS256' });
  return { token, expiresIn };
}

function verifyAuthToken(token) {
  return jwt.verify(token, env.jwt.secret, { algorithms: ['HS256'] });
}

// Converte strings tipo "1d" / "30d" / "15m" em milissegundos,
// para uso no maxAge do cookie.
function expiresInToMs(expiresIn) {
  const match = /^(\d+)([smhd])$/.exec(String(expiresIn).trim());
  if (!match) return 24 * 60 * 60 * 1000; // fallback: 1 dia
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const unitMs = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return value * unitMs[unit];
}

module.exports = { signAuthToken, verifyAuthToken, expiresInToMs };
