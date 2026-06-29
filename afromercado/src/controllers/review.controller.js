const ReviewService = require("../services/review.service");
const ReviewRepository = require("../repositories/review.repository");

const ReviewController = {
  async listar(req, res, next) {
    try {
      const data = await ReviewRepository.listarPorProducto(Number(req.params.id));
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async crearReviewHotel(req, res, next) {
    try {
      res.status(201).json({ ok: true, data: await ReviewService.crearReviewHotel(req.usuario.id, req.body) });
    } catch (e) { next(e); }
  },

  async reviewsHotel(req, res, next) {
    try {
      res.json({ ok: true, data: await ReviewService.reviewsHotel(Number(req.params.id)) });
    } catch (e) { next(e); }
  },

  async crearReviewTour(req, res, next) {
    try {
      res.status(201).json({ ok: true, data: await ReviewService.crearReviewTour(req.usuario.id, req.body) });
    } catch (e) { next(e); }
  },

  async reviewsTour(req, res, next) {
    try {
      res.json({ ok: true, data: await ReviewService.reviewsTour(Number(req.params.id)) });
    } catch (e) { next(e); }
  },

  // ── PRODUCTO ────────────────────────────────────────────────
  async crear(req, res, next) {
    try {
      const { productoId, calificacion, comentario } = req.body
      const compradorId = req.usuario.id
      const yaExiste = await ReviewRepository.existeDelComprador(compradorId, Number(productoId))
      if (yaExiste) return res.status(400).json({ ok: false, error: 'Ya dejaste una reseña para este producto' })
      const compro = await ReviewRepository.compradorComproProducto(compradorId, Number(productoId))
      if (!compro) return res.status(403).json({ ok: false, error: 'Solo puedes reseñar productos que hayas comprado' })
      const data = await ReviewRepository.crear({ productoId: Number(productoId), compradorId, calificacion: Number(calificacion), comentario })
      res.status(201).json({ ok: true, data })
    } catch (e) { next(e) }
  },

  async puedeCalificar(req, res, next) {
    try {
      const compradorId = req.usuario.id
      const productoId = Number(req.params.productoId)
      const yaReseño = await ReviewRepository.existeDelComprador(compradorId, productoId)
      if (yaReseño) return res.json({ ok: true, puede: false, razon: 'ya_reseñó' })
      const compro = await ReviewRepository.compradorComproProducto(compradorId, productoId)
      res.json({ ok: true, puede: !!compro, razon: compro ? null : 'no_compró' })
    } catch (e) { next(e) }
  },

  // ── TIENDA ───────────────────────────────────────────────────
  async crearTienda(req, res, next) {
    try {
      const { comercioId, pedidoId, calificacion, comentario } = req.body
      const compradorId = req.usuario.id
      const yaExiste = await ReviewRepository.existeTiendaDelComprador(compradorId, Number(pedidoId))
      if (yaExiste) return res.status(400).json({ ok: false, error: 'Ya dejaste una reseña para este pedido' })
      const data = await ReviewRepository.crearTienda({ comercioId: Number(comercioId), compradorId, pedidoId: Number(pedidoId), calificacion: Number(calificacion), comentario })
      res.status(201).json({ ok: true, data })
    } catch (e) { next(e) }
  },

  async puedeCalificarTienda(req, res, next) {
    try {
      const compradorId = req.usuario.id
      const pedidoId = Number(req.params.pedidoId)
      const yaExiste = await ReviewRepository.existeTiendaDelComprador(compradorId, pedidoId)
      res.json({ ok: true, puede: !yaExiste })
    } catch (e) { next(e) }
  },

  async listarTienda(req, res, next) {
    try {
      const data = await ReviewRepository.listarPorComercio(Number(req.params.comercioId))
      res.json({ ok: true, data })
    } catch (e) { next(e) }
  },
};

module.exports = ReviewController;
