const env = require('../config/env');

// Middleware central de erros. Deve ser o ÚLTIMO `app.use()` registrado.
// Nunca vaza stack trace ou detalhes internos em produção.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const isApiError = err && err.isApiError;
  const statusCode = isApiError ? err.statusCode : 500;
  const message = isApiError ? err.message : 'Erro interno do servidor.';

  if (!isApiError) {
    // Erro inesperado: logamos completo no servidor, mas não expomos ao cliente.
    console.error('[errorHandler] Erro não tratado:', err);
  } else if (!env.isTest) {
    console.warn(`[errorHandler] ${statusCode} - ${message}`);
  }

  const body = { success: false, message };
  if (isApiError && err.details) body.errors = err.details;
  if (!env.isProduction && !isApiError) body.stack = err.stack;

  res.status(statusCode).json(body);
}

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: 'Rota não encontrada.' });
}

module.exports = { errorHandler, notFoundHandler };
