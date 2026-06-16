const VisibilidadService = require("../services/visibilidad.service");
const VisibilidadRepository = require("../repositories/visibilidad.repository");

const VisibilidadController = {
  async crear(req, res, next) {
    try {
      const { comercioId, productoId, tipo, inicio, fin, montoCOP, notas, etiqueta } = req.body;
      const vis = await VisibilidadService.crear({
        comercioId, productoId, tipo, inicio, fin, montoCOP, notas, etiqueta,
        adminId: req.usuario.id,
      });
      res.status(201).json({ ok: true, visibilidad: vis });
    } catch (err) { next(err); }
  },

  async listarActivas(req, res, next) {
    try {
      const { tipo } = req.query;
      const items = await VisibilidadService.listarActivas(tipo || null);
      res.json({ ok: true, items });
    } catch (err) { next(err); }
  },

  async listarTodas(req, res, next) {
    try {
      const { pagina, porPagina } = req.query;
      const resultado = await VisibilidadService.listarTodas({
        pagina: pagina ? parseInt(pagina) : 1,
        porPagina: porPagina ? parseInt(porPagina) : 20,
      });
      res.json({ ok: true, ...resultado });
    } catch (err) { next(err); }
  },

  async desactivar(req, res, next) {
    try {
      const vis = await VisibilidadService.desactivar(req.params.id);
      res.json({ ok: true, visibilidad: vis });
    } catch (err) { next(err); }
  },

  // POST /productos/:id/vista — público, sin auth. Registra una vista si hay slot activo.
  async registrarVista(req, res, next) {
    try {
      await VisibilidadRepository.registrarVistaProducto(req.params.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  // GET /comerciante/visibilidad/metricas — solo el comerciante autenticado
  async metricasComerciante(req, res, next) {
    try {
      const prisma = require("../config/prisma");
      const comercio = await prisma.comercio.findUnique({
        where: { usuarioId: req.usuario.id },
        select: { id: true },
      });
      if (!comercio) return res.json({ ok: true, slots: [] });
      const slots = await VisibilidadRepository.metricasPorComercio(comercio.id);
      res.json({ ok: true, slots });
    } catch (err) { next(err); }
  },
};

module.exports = VisibilidadController;
