// ============================================================
//  Middlewares de autenticación y autorización
// ============================================================
const { verificarToken } = require("../utils/auth");
const { ErrorNoAutorizado, ErrorProhibido } = require("../utils/errores");

// Verifica que la petición traiga un token válido
function autenticar(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new ErrorNoAutorizado("Falta el token de autenticación"));
  }
  const token = header.split(" ")[1];
  const payload = verificarToken(token); // lanza error si es inválido
  req.usuario = payload; // { id, rol }
  next();
}

// Restringe el acceso a ciertos roles
// Uso: router.post("/productos", autenticar, autorizar("COMERCIANTE"), ...)
function autorizar(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return next(new ErrorProhibido("Tu rol no tiene permiso para esta acción"));
    }
    next();
  };
}

module.exports = { autenticar, autorizar };
