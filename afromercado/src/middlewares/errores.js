// Middleware global de manejo de errores
// Captura cualquier error y responde de forma consistente.
const config = require("../config");

let Sentry;
try { Sentry = require("@sentry/node"); } catch { /* opcional */ }

function manejadorErrores(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const esError500 = statusCode === 500;
  const mensaje = esError500
    ? "Ocurrió un error en el servidor"
    : err.message;

  console.error(`[ERROR ${statusCode}]`, err.message);
  if (esError500) console.error(err.stack);

  // Reportar errores inesperados a Sentry (excluye errores de negocio esperados)
  if (esError500 && Sentry && process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      scope.setTag("statusCode", statusCode);
      scope.setExtra("url", req.url);
      scope.setExtra("method", req.method);
      Sentry.captureException(err);
    });
  }

  res.status(statusCode).json({ ok: false, error: mensaje });
}

// Para rutas que no existen
function rutaNoEncontrada(req, res) {
  res.status(404).json({ ok: false, error: "Ruta no encontrada" });
}

module.exports = { manejadorErrores, rutaNoEncontrada };
