const FidelizacionService = require("../services/fidelizacion.service");

const FidelizacionController = {
  async miPerfil(req, res, next) {
    try {
      const data = await FidelizacionService.miPerfil(req.usuario.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async misMovimientos(req, res, next) {
    try {
      const data = await FidelizacionService.misMovimientos(req.usuario.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async canjear(req, res, next) {
    try {
      const data = await FidelizacionService.canjearPuntos(req.usuario.id, req.body.puntos);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },
};

module.exports = FidelizacionController;
