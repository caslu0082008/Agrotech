const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

// Roda depois dos validadores de rota; se houver erros de validação,
// retorna 422 com uma lista clara de mensagens para o frontend.
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
  next(ApiError.unprocessable('Dados inválidos.', details));
}

module.exports = validate;
