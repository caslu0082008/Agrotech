const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// Limita tentativas nas rotas sensíveis de autenticação (brute force).
// Usa IP + corpo do e-mail (quando presente) como chave, para não deixar
// que um único IP compartilhado (ex.: NAT/escola/empresa) trave todo mundo
// por causa de um único usuário.
function keyGenerator(req) {
  const email = (req.body && req.body.email) ? String(req.body.email).toLowerCase().trim() : '';
  return `${req.ip}:${email}`;
}

const authLimiter = rateLimit({
  windowMs: env.authRateLimit.windowMinutes * 60 * 1000,
  max: env.authRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
    });
  },
  skip: () => env.isTest,
});

// Limite mais generoso para rotas de leitura como /me.
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
});

module.exports = { authLimiter, readLimiter };
