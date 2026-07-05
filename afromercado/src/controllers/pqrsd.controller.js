const PqrsdService = require("../services/pqrsd.service");

const PqrsdController = {
  async crear(req, res, next) {
    try {
      const datos = { ...req.body };
      if (req.usuario && !datos.nombreContacto) {
        // Si el usuario está autenticado y no mandó nombre/email explícitos,
        // se completan desde su cuenta para no exigirle escribirlos de nuevo.
        datos.nombreContacto = req.usuario.nombre;
        datos.emailContacto = req.usuario.email;
      }
      const data = await PqrsdService.crear(req.usuario ?? null, datos);
      res.status(201).json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async misTickets(req, res, next) {
    try {
      const data = await PqrsdService.listarPorUsuario(req.usuario.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async obtenerDetalle(req, res, next) {
    try {
      const data = await PqrsdService.obtenerDetalle(Number(req.params.id), req.usuario);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async listarAdmin(req, res, next) {
    try {
      const data = await PqrsdService.listarAdmin(req.query);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async responderAdmin(req, res, next) {
    try {
      const data = await PqrsdService.responder(req.usuario.id, Number(req.params.id), req.body.respuesta);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async cerrarAdmin(req, res, next) {
    try {
      const data = await PqrsdService.cerrar(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },
};

module.exports = PqrsdController;
