// Validação e sanitização de entrada usando express-validator.
// Cada rota expõe um array de middlewares de validação, consumido
// pelo middleware `validate` (src/middleware/validate.js).

const { body } = require('express-validator');

const registerValidator = [
  body('nome')
    .trim()
    .notEmpty()
    .withMessage('Informe seu nome.')
    .isLength({ min: 2, max: 150 })
    .withMessage('O nome deve ter entre 2 e 150 caracteres.'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Informe seu e-mail.')
    .isEmail()
    .withMessage('Informe um e-mail válido.')
    .isLength({ max: 190 })
    .withMessage('E-mail muito longo.')
    .normalizeEmail({ gmail_remove_dots: false }),
  body('password')
    .notEmpty()
    .withMessage('Informe uma senha.')
    .isLength({ min: 8 })
    .withMessage('A senha deve ter pelo menos 8 caracteres.')
    .matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/)
    .withMessage('A senha deve conter letras e números.'),
];

const loginValidator = [
  body('email').trim().notEmpty().withMessage('Informe seu e-mail.').isEmail().withMessage('E-mail inválido.').normalizeEmail({ gmail_remove_dots: false }),
  body('password').notEmpty().withMessage('Informe sua senha.'),
  body('remember').optional().isBoolean().withMessage('Valor inválido para "lembrar de mim".').toBoolean(),
];

const forgotPasswordValidator = [
  body('email').trim().notEmpty().withMessage('Informe seu e-mail.').isEmail().withMessage('E-mail inválido.').normalizeEmail({ gmail_remove_dots: false }),
];

const resetPasswordValidator = [
  body('token').trim().notEmpty().withMessage('Token ausente.'),
  body('password')
    .notEmpty()
    .withMessage('Informe a nova senha.')
    .isLength({ min: 8 })
    .withMessage('A senha deve ter pelo menos 8 caracteres.')
    .matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/)
    .withMessage('A senha deve conter letras e números.'),
];

module.exports = {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
};
