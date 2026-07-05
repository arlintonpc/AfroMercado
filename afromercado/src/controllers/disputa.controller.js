const DisputaService = require("../services/disputa.service");

const DisputaController = {
  async crear(req, res, next) {
    try {
      const disputa = await DisputaService.crear(req.usuario.id, req.body);
      res.status(201).json({ ok: true, data: disputa });
    } catch (e) { next(e); }
  },

  async misDisputas(req, res, next) {
    try {
      const data = await DisputaService.listarPorComprador(req.usuario.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async obtenerDetalle(req, res, next) {
    try {
      const data = await DisputaService.obtenerDetalle(Number(req.params.id), req.usuario);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async responder(req, res, next) {
    try {
      const data = await DisputaService.responderComercio(req.usuario.id, Number(req.params.id), req.body);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async disputasComercio(req, res, next) {
    try {
      const data = await DisputaService.listarPorComercio(req.usuario.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async listarAdmin(req, res, next) {
    try {
      const data = await DisputaService.listarAdmin(req.query);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async resolverAdmin(req, res, next) {
    try {
      const data = await DisputaService.resolver(req.usuario.id, Number(req.params.id), req.body);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async marcarTransferidoAdmin(req, res, next) {
    try {
      const data = await DisputaService.marcarTransferido(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },
};

module.exports = DisputaController;
