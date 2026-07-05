const BusquedaService = require("../services/busqueda.service");

const BusquedaController = {
  async buscar(req, res, next) {
    try {
      const { q, categoria, precioMin, precioMax, calificacionMin, lat, lng, radioKm, page } = req.query;
      const data = await BusquedaService.buscar({
        q,
        categoria: categoria || undefined,
        precioMin: precioMin || undefined,
        precioMax: precioMax || undefined,
        calificacionMin: calificacionMin || undefined,
        lat: lat || undefined,
        lng: lng || undefined,
        radioKm: radioKm || undefined,
        page: page || 1,
      });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async sugerencias(req, res, next) {
    try {
      const { q } = req.query;
      const data = await BusquedaService.sugerencias({
        q,
        usuarioId: req.usuario?.id,
        sesionId: req.usuario ? undefined : (req.query.sesionId || undefined),
      });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },
};

module.exports = BusquedaController;
