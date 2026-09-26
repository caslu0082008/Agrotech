// Evita repetir try/catch em cada controller assíncrono.
// Qualquer rejeição da Promise é encaminhada para o middleware
// de erro central via next(err).

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
