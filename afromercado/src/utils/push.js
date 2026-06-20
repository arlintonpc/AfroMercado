// Web Push — envío de notificaciones a dispositivos con el browser cerrado.
// Requiere: npm install web-push
// Configurar en .env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// Generar claves una sola vez: npx web-push generate-vapid-keys

let webpush;
try {
  webpush = require("web-push");
} catch {
  // web-push no instalado — el módulo queda inactivo
}

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@afromercado.co";

if (webpush && VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

function pushActivo() {
  return !!(webpush && VAPID_PUBLIC && VAPID_PRIVATE);
}

async function enviarPushAUsuario(prisma, usuarioId, { titulo, cuerpo, url, icono }) {
  if (!pushActivo()) return;
  try {
    const subs = await prisma.pushSubscripcion.findMany({ where: { usuarioId } });
    if (!subs.length) return;

    const payload = JSON.stringify({
      title: titulo,
      body:  cuerpo,
      icon:  icono || "/icon-192.svg",
      badge: "/badge-72.svg",
      url:   url   || "/",
    });

    const resultados = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    );

    // Eliminar suscripciones expiradas (410) o inválidas (404)
    const expirados = subs.filter((_, i) => {
      const r = resultados[i];
      return r.status === "rejected" && [404, 410].includes(r.reason?.statusCode);
    });
    if (expirados.length) {
      await prisma.pushSubscripcion.deleteMany({
        where: { endpoint: { in: expirados.map((s) => s.endpoint) } },
      });
    }
  } catch (e) {
    console.error("[PUSH]", e.message);
  }
}

module.exports = { pushActivo, enviarPushAUsuario };
