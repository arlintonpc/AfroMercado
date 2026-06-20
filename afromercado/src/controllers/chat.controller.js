const prisma = require("../config/prisma");
const { enviar } = require("../utils/sse-manager");
const { ErrorValidacion, ErrorNoEncontrado, ErrorProhibido } = require("../utils/errores");

const ChatController = {
  async listarConversaciones(req, res, next) {
    try {
      const usuarioId = req.usuario.id;
      const rol = req.usuario.rol;

      let conversaciones;

      if (rol === "COMERCIANTE") {
        const comercio = await prisma.comercio.findUnique({
          where: { usuarioId },
          select: { id: true },
        });
        if (!comercio) {
          return res.json({ ok: true, data: [] });
        }
        conversaciones = await prisma.conversacion.findMany({
          where: { comercioId: comercio.id },
          include: {
            comprador: { select: { nombre: true } },
            comercio: { select: { nombre: true } },
            mensajes: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { contenido: true, createdAt: true, autorId: true },
            },
            _count: {
              select: {
                mensajes: {
                  where: { leido: false, autorId: { not: usuarioId } },
                },
              },
            },
          },
          orderBy: { ultimoMensAt: "desc" },
        });
      } else {
        conversaciones = await prisma.conversacion.findMany({
          where: { compradorId: usuarioId },
          include: {
            comprador: { select: { nombre: true } },
            comercio: { select: { nombre: true } },
            mensajes: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { contenido: true, createdAt: true, autorId: true },
            },
            _count: {
              select: {
                mensajes: {
                  where: { leido: false, autorId: { not: usuarioId } },
                },
              },
            },
          },
          orderBy: { ultimoMensAt: "desc" },
        });
      }

      res.json({ ok: true, data: conversaciones });
    } catch (err) {
      next(err);
    }
  },

  async obtenerMensajes(req, res, next) {
    try {
      const conversacionId = Number(req.params.id);
      const usuarioId = req.usuario.id;

      const conversacion = await prisma.conversacion.findUnique({
        where: { id: conversacionId },
        include: { comercio: { select: { usuarioId: true } } },
      });
      if (!conversacion) return next(new ErrorNoEncontrado("Conversación no encontrada"));

      const esComprador = conversacion.compradorId === usuarioId;
      const esComerciante = conversacion.comercio.usuarioId === usuarioId;
      if (!esComprador && !esComerciante) return next(new ErrorProhibido());

      await prisma.mensaje.updateMany({
        where: {
          conversacionId,
          autorId: { not: usuarioId },
          leido: false,
        },
        data: { leido: true },
      });

      const mensajes = await prisma.mensaje.findMany({
        where: { conversacionId },
        orderBy: { createdAt: "asc" },
        take: 50,
        include: { autor: { select: { nombre: true } } },
      });

      res.json({ ok: true, data: mensajes });
    } catch (err) {
      next(err);
    }
  },

  async iniciarConversacion(req, res, next) {
    try {
      const usuarioId = req.usuario.id;
      const { comercioId } = req.body;

      if (!comercioId) return next(new ErrorValidacion("comercioId es requerido"));

      const comercio = await prisma.comercio.findUnique({ where: { id: Number(comercioId) } });
      if (!comercio) return next(new ErrorNoEncontrado("Comercio no encontrado"));

      const conversacion = await prisma.conversacion.upsert({
        where: { compradorId_comercioId: { compradorId: usuarioId, comercioId: Number(comercioId) } },
        create: { compradorId: usuarioId, comercioId: Number(comercioId) },
        update: {},
        include: {
          comprador: { select: { nombre: true } },
          comercio: { select: { nombre: true } },
          mensajes: { orderBy: { createdAt: "desc" }, take: 1 },
          _count: { select: { mensajes: { where: { leido: false, autorId: { not: usuarioId } } } } },
        },
      });

      res.json({ ok: true, data: conversacion });
    } catch (err) {
      next(err);
    }
  },

  async enviarMensaje(req, res, next) {
    try {
      const conversacionId = Number(req.params.id);
      const usuarioId = req.usuario.id;
      const { contenido } = req.body;

      if (!contenido || !contenido.trim()) return next(new ErrorValidacion("El mensaje no puede estar vacío"));

      const conversacion = await prisma.conversacion.findUnique({
        where: { id: conversacionId },
        include: { comercio: { select: { usuarioId: true } } },
      });
      if (!conversacion) return next(new ErrorNoEncontrado("Conversación no encontrada"));

      const esComprador = conversacion.compradorId === usuarioId;
      const esComerciante = conversacion.comercio.usuarioId === usuarioId;
      if (!esComprador && !esComerciante) return next(new ErrorProhibido());

      const mensaje = await prisma.mensaje.create({
        data: {
          conversacionId,
          autorId: usuarioId,
          contenido: contenido.trim(),
        },
        include: { autor: { select: { nombre: true } } },
      });

      await prisma.conversacion.update({
        where: { id: conversacionId },
        data: { ultimoMensAt: new Date() },
      });

      const destinatarioId = esComprador
        ? conversacion.comercio.usuarioId
        : conversacion.compradorId;

      enviar(destinatarioId, "MENSAJE_NUEVO", { conversacionId, mensaje });

      res.json({ ok: true, data: mensaje });
    } catch (err) {
      next(err);
    }
  },

  async noLeidos(req, res, next) {
    try {
      const usuarioId = req.usuario.id;
      const rol = req.usuario.rol;

      let conversacionesIds;

      if (rol === "COMERCIANTE") {
        const comercio = await prisma.comercio.findUnique({
          where: { usuarioId },
          select: { id: true },
        });
        if (!comercio) return res.json({ ok: true, data: 0 });
        const convs = await prisma.conversacion.findMany({
          where: { comercioId: comercio.id },
          select: { id: true },
        });
        conversacionesIds = convs.map((c) => c.id);
      } else {
        const convs = await prisma.conversacion.findMany({
          where: { compradorId: usuarioId },
          select: { id: true },
        });
        conversacionesIds = convs.map((c) => c.id);
      }

      const count = await prisma.mensaje.count({
        where: {
          conversacionId: { in: conversacionesIds },
          autorId: { not: usuarioId },
          leido: false,
        },
      });

      res.json({ ok: true, data: count });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = ChatController;
