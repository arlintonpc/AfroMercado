const ReviewRepository = require("../repositories/review.repository");
const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorProhibido, ErrorConflicto } = require("../utils/errores");

const ReviewController = {
  // POST /api/reviews
  async crear(req, res, next) {
    try {
      const compradorId = req.usuario.id;
      const { productoId, calificacion, comentario } = req.body;

      if (!productoId) throw new ErrorValidacion("productoId es requerido");
      const cal = parseInt(calificacion, 10);
      if (!cal || cal < 1 || cal > 5) throw new ErrorValidacion("La calificación debe ser entre 1 y 5");

      const yaExiste = await ReviewRepository.existeDelComprador(compradorId, Number(productoId));
      if (yaExiste) throw new ErrorConflicto("Ya calificaste este producto");

      const comproBien = await ReviewRepository.compradorComproProducto(compradorId, Number(productoId));
      if (!comproBien) throw new ErrorProhibido("Solo puedes calificar productos de pedidos confirmados");

      const review = await ReviewRepository.crear({
        productoId: Number(productoId),
        compradorId,
        calificacion: cal,
        comentario: comentario?.trim() || null,
      });
      res.status(201).json({ ok: true, data: review });
    } catch (e) { next(e); }
  },

  // GET /api/productos/:id/reviews
  async listar(req, res, next) {
    try {
      const productoId = Number(req.params.id);
      const [reviews, { promedio, total }] = await Promise.all([
        ReviewRepository.listarPorProducto(productoId),
        ReviewRepository.promedioProducto(productoId),
      ]);
      res.json({ ok: true, data: { reviews, promedio, total } });
    } catch (e) { next(e); }
  },

  // GET /api/reviews/puede-calificar/:productoId
  async puedeCalificar(req, res, next) {
    try {
      const compradorId = req.usuario.id;
      const productoId = Number(req.params.productoId);
      const [comproBien, yaCalifico] = await Promise.all([
        ReviewRepository.compradorComproProducto(compradorId, productoId),
        ReviewRepository.existeDelComprador(compradorId, productoId),
      ]);
      res.json({ ok: true, data: { puede: comproBien && !yaCalifico, yaCalifico: !!yaCalifico } });
    } catch (e) { next(e); }
  },

  // POST /api/reviews/tienda
  async crearTienda(req, res, next) {
    try {
      const compradorId = req.usuario.id;
      const { pedidoId, calificacion, comentario } = req.body;

      if (!pedidoId) throw new ErrorValidacion("pedidoId es requerido");
      const cal = parseInt(calificacion, 10);
      if (!cal || cal < 1 || cal > 5) throw new ErrorValidacion("La calificación debe ser entre 1 y 5");

      const pedido = await prisma.pedido.findFirst({
        where: { id: Number(pedidoId), compradorId },
        include: { subPedidos: { select: { comercioId: true }, take: 1 } },
      });

      if (!pedido) throw new ErrorProhibido("Pedido no encontrado");
      if (pedido.estado !== "ENTREGADO") throw new ErrorProhibido("Solo puedes calificar tiendas de pedidos entregados");
      if (!pedido.subPedidos?.length) throw new ErrorProhibido("El pedido no tiene información de comercio");

      const yaExiste = await ReviewRepository.existeTiendaDelComprador(compradorId, Number(pedidoId));
      if (yaExiste) throw new ErrorConflicto("Ya calificaste esta tienda para este pedido");

      const comercioId = pedido.subPedidos[0].comercioId;

      const review = await ReviewRepository.crearTienda({
        comercioId,
        compradorId,
        pedidoId: Number(pedidoId),
        calificacion: cal,
        comentario: comentario?.trim() || null,
      });

      // Actualizar calificacion desnormalizada del comercio
      setImmediate(async () => {
        try {
          const allReviews = await prisma.review.findMany({
            where: { comercioId },
            select: { calificacion: true },
          });
          const total = allReviews.length;
          const promedio = total > 0
            ? Math.round(allReviews.reduce((acc, r) => acc + r.calificacion, 0) / total * 100) / 100
            : 0;
          await prisma.comercio.update({
            where: { id: comercioId },
            data: { totalReviews: total, calificacion: promedio },
          });
        } catch (e) {
          console.error('[REVIEW] Error actualizando calificacion comercio:', e.message);
        }
      });

      res.status(201).json({ ok: true, data: review });
    } catch (e) { next(e); }
  },

  // GET /api/reviews/puede-calificar-tienda/:pedidoId
  async puedeCalificarTienda(req, res, next) {
    try {
      const compradorId = req.usuario.id;
      const pedidoId = Number(req.params.pedidoId);

      const pedido = await prisma.pedido.findFirst({
        where: { id: pedidoId, compradorId },
        select: { estado: true },
      });

      if (!pedido || pedido.estado !== "ENTREGADO") {
        return res.json({ ok: true, data: { puede: false, yaCalifico: false } });
      }

      const yaCalifico = await ReviewRepository.existeTiendaDelComprador(compradorId, pedidoId);
      res.json({ ok: true, data: { puede: !yaCalifico, yaCalifico: !!yaCalifico } });
    } catch (e) { next(e); }
  },

  // GET /api/reviews/comercio/:comercioId  (público)
  async listarTienda(req, res, next) {
    try {
      const comercioId = Number(req.params.comercioId);
      const reviews = await ReviewRepository.listarPorComercio(comercioId);

      let promedio = null;
      if (reviews.length > 0) {
        const suma = reviews.reduce((acc, r) => acc + r.calificacion, 0);
        promedio = Math.round((suma / reviews.length) * 10) / 10;
      }

      res.json({ ok: true, data: { reviews, promedio, total: reviews.length } });
    } catch (e) { next(e); }
  },
};

module.exports = ReviewController;
