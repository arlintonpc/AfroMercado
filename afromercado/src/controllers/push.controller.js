const prisma = require("../config/prisma");
const { pushActivo } = require("../utils/push");

const PushController = {
  // GET /push/clave-publica — VAPID public key para el frontend
  clavePublica(req, res) {
    const clave = process.env.VAPID_PUBLIC_KEY || null;
    res.json({ ok: true, clave, activo: pushActivo() });
  },

  // POST /push/suscribir
  async suscribir(req, res, next) {
    try {
      const { endpoint, keys } = req.body;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ ok: false, error: "Suscripción inválida" });
      }
      await prisma.pushSubscripcion.upsert({
        where: { endpoint },
        update: { usuarioId: req.usuario.id, p256dh: keys.p256dh, auth: keys.auth },
        create: { usuarioId: req.usuario.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      });
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  // DELETE /push/suscribir
  async desuscribir(req, res, next) {
    try {
      const { endpoint } = req.body;
      if (endpoint) {
        await prisma.pushSubscripcion.deleteMany({
          where: { endpoint, usuarioId: req.usuario.id },
        });
      }
      res.json({ ok: true });
    } catch (e) { next(e); }
  },
};

module.exports = PushController;
