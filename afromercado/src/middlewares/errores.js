// Middleware global de manejo de errores
// Captura cualquier error y responde de forma consistente.
const config = require("../config");

function manejadorErrores(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  // Los errores 500 se registran en servidor, pero no se exponen al usuario.
  const esError500 = statusCode === 500;
  const mensaje = esError500
    ? "Ocurrió un error en el servidor"
    : err.message;

  console.error(`[ERROR ${statusCode}]`, err.message);
  if (esError500) console.error(err.stack);

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
