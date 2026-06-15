// ============================================================
//  Middlewares de autenticación y autorización
// ============================================================
const { verificarToken } = require("../utils/auth");
const { ErrorNoAutorizado, ErrorProhibido } = require("../utils/errores");
const UsuarioRepository = require("../repositories/usuario.repository");

// Verifica que la petición traiga un token válido
async function autenticar(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return next(new ErrorNoAutorizado("Falta el token de autenticación"));
    }
    const token = header.split(" ")[1];
    const payload = verificarToken(token); // lanza error si es inválido

    // Verificar invalidación de sesión por cambio de contraseña
    const usuario = await UsuarioRepository.buscarPorId(payload.id);
    if (!usuario || !usuario.activo) {
      return next(new ErrorNoAutorizado("Usuario no encontrado o inactivo."));
    }
    if (usuario.passwordCambiadoAt) {
      const cambiadoEn = Math.floor(usuario.passwordCambiadoAt.getTime() / 1000);
      if (payload.iat < cambiadoEn) {
        return next(new ErrorNoAutorizado("Sesión invalidada. Por favor inicia sesión nuevamente."));
      }
    }

    req.usuario = { id: usuario.id, rol: usuario.rol, nombre: usuario.nombre };
    next();
  } catch (err) {
    next(new ErrorNoAutorizado("Token inválido o expirado."));
  }
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
