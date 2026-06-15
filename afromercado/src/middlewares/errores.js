// Middleware global de manejo de errores
// Captura cualquier error y responde de forma consistente.
const config = require("../config");

function manejadorErrores(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  // En desarrollo mostramos el detalle; en producción, mensaje genérico para errores 500
  const esError500 = statusCode === 500;
  const mensaje = esError500 && config.entorno === "production"
    ? "Ocurrió un error en el servidor"
    : err.message;

  if (config.entorno === "development") {
    console.error(`[ERROR ${statusCode}]`, err.message);
    if (esError500) console.error(err.stack);
  }

  res.status(statusCode).json({
    ok: false,
    error: mensaje,
  });
}

// Para rutas que no existen
function rutaNoEncontrada(req, res) {
  res.status(404).json({ ok: false, error: "Ruta no encontrada" });
}

module.exports = { manejadorErrores, rutaNoEncontrada };
