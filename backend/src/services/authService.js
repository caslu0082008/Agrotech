const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const { hashPassword, comparePassword } = require('../utils/password');
const { signAuthToken } = require('../utils/jwt');
const env = require('../config/env');
const mailer = require('../utils/mailer');

const userRepository = require('../repositories/userRepository');
const passwordResetRepository = require('../repositories/passwordResetRepository');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutos

function toPublicUser(user) {
  return { id: user.id, nome: user.nome, email: user.email, role: user.role || 'user' };
}

async function register({ nome, email, password }) {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    // Mensagem clara para o frontend, sem detalhes internos.
    throw ApiError.conflict('Já existe uma conta cadastrada com este e-mail.');
  }

  const passwordHash = await hashPassword(password);
  const user = await userRepository.createUser({ nome, email, passwordHash });
  return toPublicUser(user);
}

async function login({ email, password, remember }) {
  const user = await userRepository.findByEmail(email);

  // Mensagem genérica: não revela se o e-mail existe ou não.
  const invalidCredentialsError = () => ApiError.unauthorized('E-mail ou senha inválidos.');

  if (!user || user.status === 'suspended') {
    throw invalidCredentialsError();
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw ApiError.tooManyRequests('Conta temporariamente bloqueada por excesso de tentativas. Tente novamente mais tarde.');
  }

  const passwordMatches = await comparePassword(password, user.password_hash);
  if (!passwordMatches) {
    await userRepository.incrementFailedLogin(user.id);
    const attempts = (user.failed_login_count || 0) + 1;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      await userRepository.lockUser(user.id, new Date(Date.now() + LOCK_DURATION_MS));
    }
    throw invalidCredentialsError();
  }

  await userRepository.resetFailedLogin(user.id);

  const { token, expiresIn } = signAuthToken(user, { remember: Boolean(remember) });
  return { user: toPublicUser(user), token, expiresIn };
}

async function getCurrentUser(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound('Usuário não encontrado.');
  return toPublicUser(user);
}

async function forgotPassword(email) {
  const user = await userRepository.findByEmail(email);

  // Resposta idêntica exista ou não o e-mail, para não vazar quais
  // e-mails possuem conta cadastrada.
  if (!user) return;

  await passwordResetRepository.invalidateAllForUser(user.id);

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + env.resetPassword.expiresMinutes * 60 * 1000);

  await passwordResetRepository.createToken({ userId: user.id, tokenHash, expiresAt });

  const resetUrl = `${env.resetPassword.url}?token=${rawToken}`;
  await mailer.sendPasswordResetEmail(user.email, resetUrl);
}

async function resetPassword({ token, password }) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const record = await passwordResetRepository.findValidByHash(tokenHash);

  if (!record) throw ApiError.badRequest('Link de recuperação inválido ou já utilizado.');
  if (record.used_at) throw ApiError.badRequest('Este link de recuperação já foi utilizado.');
  if (new Date(record.expires_at) < new Date()) {
    throw ApiError.badRequest('Este link de recuperação expirou. Solicite um novo.');
  }

  const passwordHash = await hashPassword(password);
  const consumed = await passwordResetRepository.consumeAndReset({ tokenId: record.id, userId: record.user_id, passwordHash });
  if (!consumed) throw ApiError.badRequest('Link de recuperação inválido, expirado ou já utilizado.');
}

module.exports = {
  revokeSessions: userRepository.revokeSessions,
  register,
  login,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  toPublicUser,
};
