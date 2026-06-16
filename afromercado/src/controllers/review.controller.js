const ReviewRepository = require("../repositories/review.repository");
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
};

module.exports = ReviewController;
