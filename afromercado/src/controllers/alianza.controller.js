const AlianzaService = require("../services/alianza.service");

const AlianzaController = {
  // ── PÚBLICO ──────────────────────────────────────────────────
  async obtenerPorCodigo(req, res, next) {
    try {
      res.json({ ok: true, data: await AlianzaService.obtenerPorCodigoPublico(req.params.codigo) });
    } catch (e) { next(e); }
  },

  async listarPorRegion(req, res, next) {
    try {
      const { departamento, municipio, fecha } = req.query;
      res.json({ ok: true, data: await AlianzaService.listarPorRegion({ departamento, municipio, fecha }) });
    } catch (e) { next(e); }
  },

  // ── COMERCIO ─────────────────────────────────────────────────
  async crear(req, res, next) {
    try {
      const alianza = await AlianzaService.crearAlianza(req.usuario.comercio.id, req.body);
      res.status(201).json({ ok: true, data: alianza });
    } catch (e) { next(e); }
  },

  async invitarSocio(req, res, next) {
    try {
      const socio = await AlianzaService.invitarSocio(req.usuario.comercio.id, Number(req.params.id), req.body);
      res.status(201).json({ ok: true, data: socio });
    } catch (e) { next(e); }
  },

  async aceptarInvitacion(req, res, next) {
    try {
      const socio = await AlianzaService.aceptarInvitacion(req.usuario.comercio.id, Number(req.params.id));
      res.json({ ok: true, data: socio });
    } catch (e) { next(e); }
  },

  async rechazarOSalir(req, res, next) {
    try {
      const resultado = await AlianzaService.rechazarOSalir(req.usuario.comercio.id, Number(req.params.id));
      res.json({ ok: true, data: resultado });
    } catch (e) { next(e); }
  },

  async misAlianzas(req, res, next) {
    try {
      res.json({ ok: true, data: await AlianzaService.misAlianzas(req.usuario.comercio.id) });
    } catch (e) { next(e); }
  },

  // ── ADMIN ────────────────────────────────────────────────────
  async adminListar(req, res, next) {
    try {
      const { estado } = req.query;
      res.json({ ok: true, data: await AlianzaService.adminListar({ estado }) });
    } catch (e) { next(e); }
  },

  async adminAprobar(req, res, next) {
    try {
      const alianza = await AlianzaService.adminAprobar(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, data: alianza });
    } catch (e) { next(e); }
  },

  async adminRechazar(req, res, next) {
    try {
      const alianza = await AlianzaService.adminRechazar(req.usuario.id, Number(req.params.id), req.body.motivoRechazo);
      res.json({ ok: true, data: alianza });
    } catch (e) { next(e); }
  },

  async adminDespublicar(req, res, next) {
    try {
      const alianza = await AlianzaService.adminDespublicar(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, data: alianza });
    } catch (e) { next(e); }
  },
};

module.exports = AlianzaController;
