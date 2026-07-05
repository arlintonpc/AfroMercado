const ConfigFiscalService = require("../services/config-fiscal.service");

const ConfigFiscalController = {
  async obtener(req, res, next) {
    try {
      const data = await ConfigFiscalService.obtenerPorComercio(Number(req.params.comercioId));
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async activar(req, res, next) {
    try {
      const data = await ConfigFiscalService.activar(req.usuario.id, Number(req.params.comercioId), req.body);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async desactivar(req, res, next) {
    try {
      const data = await ConfigFiscalService.desactivar(req.usuario.id, Number(req.params.comercioId));
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },
};

module.exports = ConfigFiscalController;
