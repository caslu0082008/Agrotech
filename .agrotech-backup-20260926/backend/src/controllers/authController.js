const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const { expiresInToMs } = require('../utils/jwt');
const authService = require('../services/authService');

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.secure ? 'none' : 'lax',
    maxAge: maxAgeMs,
    path: '/',
  };
}

function setAuthCookie(res, token, expiresIn) {
  res.cookie(env.cookie.name, token, cookieOptions(expiresInToMs(expiresIn)));
}

function clearAuthCookie(res) {
  res.clearCookie(env.cookie.name, { ...cookieOptions(0), maxAge: undefined });
}

const register = asyncHandler(async (req, res) => {
  const { nome, email, password } = req.body;
  const user = await authService.register({ nome, email, password });
  res.status(201).json({
    success: true,
    message: 'Conta criada com sucesso. Você já pode entrar.',
    user,
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password, remember } = req.body;
  const { user, token, expiresIn } = await authService.login({ email, password, remember });
  setAuthCookie(res, token, expiresIn);
  res.status(200).json({ success: true, message: 'Login realizado com sucesso.', user });
});

const me = asyncHandler(async (req, res) => {
  // req.user já foi validado pelo middleware requireAuth
  res.status(200).json({ success: true, user: authService.toPublicUser(req.user) });
});

const logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  res.status(200).json({ success: true, message: 'Logout realizado com sucesso.' });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  await authService.forgotPassword(email);
  // Mensagem sempre igual, exista ou não o e-mail.
  res.status(200).json({
    success: true,
    message: 'Se este e-mail estiver cadastrado, você receberá um link de recuperação em instantes.',
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  await authService.resetPassword({ token, password });
  res.status(200).json({ success: true, message: 'Senha redefinida com sucesso. Você já pode entrar.' });
});

module.exports = { register, login, me, logout, forgotPassword, resetPassword, setAuthCookie, clearAuthCookie };
