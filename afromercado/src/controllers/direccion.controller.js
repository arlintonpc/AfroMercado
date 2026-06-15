const DireccionService = require("../services/direccion.service");

const DireccionController = {
  async listar(req, res, next) {
    try {
      const dirs = await DireccionService.listar(req.usuario.id);
      res.json({ ok: true, direcciones: dirs });
    } catch (err) {
      next(err);
    }
  },

  async crear(req, res, next) {
    try {
      const dir = await DireccionService.crear(req.usuario.id, req.body);
      res.status(201).json({ ok: true, direccion: dir });
    } catch (err) {
      next(err);
    }
  },

  async actualizar(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const dir = await DireccionService.actualizar(id, req.usuario.id, req.body);
      res.json({ ok: true, direccion: dir });
    } catch (err) {
      next(err);
    }
  },

  async eliminar(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      await DireccionService.eliminar(id, req.usuario.id);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },

  async marcarPrincipal(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const dir = await DireccionService.marcarPrincipal(id, req.usuario.id);
      res.json({ ok: true, direccion: dir });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = DireccionController;
