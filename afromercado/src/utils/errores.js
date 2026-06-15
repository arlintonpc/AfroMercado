// Errores personalizados de la aplicación
// Permiten responder con el código HTTP correcto de forma limpia.

class AppError extends Error {
  constructor(mensaje, statusCode = 500) {
    super(mensaje);
    this.statusCode = statusCode;
    this.esOperacional = true; // error esperado, no un bug
    Error.captureStackTrace(this, this.constructor);
  }
}

class ErrorValidacion extends AppError {
  constructor(mensaje) { super(mensaje, 400); }
}
class ErrorNoAutorizado extends AppError {
  constructor(mensaje = "No autorizado") { super(mensaje, 401); }
}
class ErrorProhibido extends AppError {
  constructor(mensaje = "No tienes permiso para esta acción") { super(mensaje, 403); }
}
class ErrorNoEncontrado extends AppError {
  constructor(mensaje = "Recurso no encontrado") { super(mensaje, 404); }
}

module.exports = {
  AppError,
  ErrorValidacion,
  ErrorNoAutorizado,
  ErrorProhibido,
  ErrorNoEncontrado,
};
