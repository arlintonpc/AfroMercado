// ============================================================
//  Controlador de Comercios
//  Recibe la petición HTTP, llama al servicio y responde.
//  No tiene lógica de negocio.
// ============================================================
const ComercioService = require("../services/comercio.service");

const ComercioController = {
  async registrar(req, res, next) {
    try {
      const comercio = await ComercioService.registrar(req.usuario.id, req.body);
      res.status(201).json({ ok: true, comercio });
    } catch (e) {
      next(e);
    }
  },

  async miComercio(req, res, next) {
    try {
      const comercio = await ComercioService.obtenerMiComercio(req.usuario.id);
      res.json({ ok: true, comercio });
    } catch (e) {
      next(e);
    }
  },

  async obtener(req, res, next) {
    try {
      const comercio = await ComercioService.obtenerPorId(req.params.id);
      res.json({ ok: true, comercio });
    } catch (e) {
      next(e);
    }
  },

  async actualizar(req, res, next) {
    try {
      const comercio = await ComercioService.actualizar(req.usuario.id, req.body);
      res.json({ ok: true, comercio });
    } catch (e) {
      next(e);
    }
  },
};

module.exports = ComercioController;
