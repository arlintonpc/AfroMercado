const prisma = require("../config/prisma");
const { iniciarStream } = require("../utils/sse-manager");

const NotificacionController = {
  // GET /api/notificaciones/stream  — SSE long-poll
  async stream(req, res) {
    iniciarStream(req.usuario.id, res);
  },

  // GET /api/notificaciones
  async listar(req, res, next) {
    try {
      const usuarioId = req.usuario.id;
      const notifs = await prisma.notificacion.findMany({
        where: { usuarioId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      const noLeidas = notifs.filter((n) => !n.leida).length;
      res.json({ ok: true, data: { notificaciones: notifs, noLeidas } });
    } catch (e) { next(e); }
  },

  // PATCH /api/notificaciones/:id/leer
  async marcarLeida(req, res, next) {
    try {
      const id = Number(req.params.id);
      const usuarioId = req.usuario.id;
      await prisma.notificacion.updateMany({
        where: { id, usuarioId },
        data: { leida: true },
      });
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  // PATCH /api/notificaciones/leer-todas
  async marcarTodasLeidas(req, res, next) {
    try {
      await prisma.notificacion.updateMany({
        where: { usuarioId: req.usuario.id, leida: false },
        data: { leida: true },
      });
      res.json({ ok: true });
    } catch (e) { next(e); }
  },
};

module.exports = NotificacionController;
