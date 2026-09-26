const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

// Critério mínimo de segurança da senha:
// - pelo menos 8 caracteres
// - pelo menos 1 letra
// - pelo menos 1 número
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

function isStrongPassword(password) {
  return typeof password === 'string' && PASSWORD_REGEX.test(password);
}

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

module.exports = { hashPassword, comparePassword, isStrongPassword };
