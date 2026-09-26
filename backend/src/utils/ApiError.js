// Erro de aplicação com status HTTP anexado.
// Lançar um ApiError em qualquer camada (controller/service/repository)
// e deixar o middleware de erro centralizado decidir como responder.

class ApiError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isApiError = true;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Não autenticado.') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Acesso negado.') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Recurso não encontrado.') {
    return new ApiError(404, message);
  }

  static conflict(message) {
    return new ApiError(409, message);
  }

  static unprocessable(message, details) {
    return new ApiError(422, message, details);
  }

  static tooManyRequests(message = 'Muitas tentativas. Tente novamente mais tarde.') {
    return new ApiError(429, message);
  }

  static internal(message = 'Erro interno do servidor.') {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;
