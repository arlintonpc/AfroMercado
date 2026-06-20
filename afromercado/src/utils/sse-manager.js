// SSE Manager — mantiene conexiones activas por usuario.
// Soporta múltiples pestañas (un usuario puede tener N conexiones abiertas).

const conexiones = new Map(); // usuarioId (number) → Set<Response>

const HEARTBEAT_MS = 25_000;       // ping cada 25 s para evitar timeouts de proxy
const MAX_CONEXIONES_POR_USUARIO = 5; // previene memory leak si pestañas no cierran limpio

function agregar(usuarioId, res) {
  if (!conexiones.has(usuarioId)) conexiones.set(usuarioId, new Set());
  const set = conexiones.get(usuarioId);
  // Si se supera el límite, cerrar la conexión más antigua
  if (set.size >= MAX_CONEXIONES_POR_USUARIO) {
    const [primera] = set;
    try { primera.end(); } catch { /* ya cerrada */ }
    set.delete(primera);
  }
  set.add(res);
}

function quitar(usuarioId, res) {
  const set = conexiones.get(usuarioId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) conexiones.delete(usuarioId);
}

function enviar(usuarioId, tipo, datos) {
  const set = conexiones.get(usuarioId);
  if (!set || set.size === 0) return;
  const payload = `event: ${tipo}\ndata: ${JSON.stringify(datos)}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch { quitar(usuarioId, res); }
  }
}

function iniciarStream(usuarioId, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Nginx / Render
  res.flushHeaders();

  agregar(usuarioId, res);

  // Heartbeat
  const timer = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { /* conexión cerrada */ }
  }, HEARTBEAT_MS);

  res.on("close", () => {
    clearInterval(timer);
    quitar(usuarioId, res);
  });
}

module.exports = { iniciarStream, enviar };
