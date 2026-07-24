// ============================================================
//  Gate de módulo — bloquea un vertical completo cuando el Admin
//  lo apaga desde el panel de Feature Flags (tabla Config).
//  Complementa el ocultamiento de nav en el frontend (Header.tsx):
//  esto protege el acceso directo a la API aunque el enlace esté oculto.
// ============================================================
const Reglas = require("../config/reglas");

function verificarModuloActivo(claveFlag) {
  return async function (req, res, next) {
    try {
      const activo = await Reglas.bool(claveFlag);
      if (!activo) {
        return res.status(503).json({
          error: "Este módulo está temporalmente desactivado por el administrador.",
          modulo: claveFlag,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { verificarModuloActivo };
