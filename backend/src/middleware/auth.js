const ApiError = require('../utils/ApiError');
const { verifyAuthToken } = require('../utils/jwt');
const env = require('../config/env');
const userRepository = require('../repositories/userRepository');
const asyncHandler = require('../utils/asyncHandler');

// Extrai o token do cookie httpOnly (fonte principal) ou, como fallback,
// do cabeçalho Authorization: Bearer <token> (útil para testes/ferramentas).
function extractToken(req) {
  const fromCookie = req.cookies?.[env.cookie.name];
  if (fromCookie) return fromCookie;

  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);

  return null;
}

// Middleware obrigatório: bloqueia o acesso se não houver usuário autenticado.
const requireAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Você precisa estar autenticado.');

  let payload;
  try {
    payload = verifyAuthToken(token);
  } catch (err) {
    throw ApiError.unauthorized('Sessão inválida ou expirada.');
  }

  const user = await userRepository.findById(payload.sub);
  if (!user || user.status === 'suspended' || (payload.version || 0) !== (user.session_version || 0)) throw ApiError.unauthorized('Sessão inválida ou expirada.');

  req.user = user;
  next();
});

// Middleware opcional: anexa req.user se houver token válido, mas não bloqueia.
const attachUserIfPresent = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyAuthToken(token);
    const user = await userRepository.findById(payload.sub);
    if (user && user.status !== 'suspended' && (payload.version || 0) === (user.session_version || 0)) req.user = user;
  } catch (err) {
    // token inválido/expirado: apenas segue sem usuário autenticado
  }
  next();
});

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return next(ApiError.forbidden('Acesso exclusivo de administradores.'));
  next();
}

module.exports = { requireAdmin, requireAuth, attachUserIfPresent, extractToken };
