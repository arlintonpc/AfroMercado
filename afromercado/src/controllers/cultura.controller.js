const CulturaService = require("../services/cultura.service");

const CulturaController = {
  // ── Público ──
  async listarAgenda(req, res, next) {
    try {
      const { departamento, municipio, categoria, search, patrimonio, fechaDesde, fechaHasta } = req.query;
      res.json({
        ok: true,
        data: await CulturaService.listarAgenda({ departamento, municipio, categoria, search, patrimonio, fechaDesde, fechaHasta }),
      });
    } catch (e) { next(e); }
  },

  async obtener(req, res, next) {
    try {
      res.json({ ok: true, data: await CulturaService.obtenerEvento(Number(req.params.id)) });
    } catch (e) { next(e); }
  },

  // ── Cliente ──
  async reservar(req, res, next) {
    try {
      const reserva = await CulturaService.crearReserva(req.usuario.id, req.body);
      res.status(201).json({ ok: true, data: reserva });
    } catch (e) { next(e); }
  },

  async misReservas(req, res, next) {
    try {
      res.json({ ok: true, data: await CulturaService.misReservas(req.usuario.id) });
    } catch (e) { next(e); }
  },

  async cancelarReserva(req, res, next) {
    try {
      res.json({ ok: true, data: await CulturaService.cancelarReserva(req.usuario.id, Number(req.params.id)) });
    } catch (e) { next(e); }
  },

  // ── Organizador (comercio) ──
  async cambiarEstadoReserva(req, res, next) {
    try {
      const data = await CulturaService.cambiarEstadoReserva(
        req.usuario.comercio.id,
        Number(req.params.id),
        req.body.estado
      );
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async misEventos(req, res, next) {
    try {
      res.json({ ok: true, data: await CulturaService.misEventos(req.usuario.comercio.id) });
    } catch (e) { next(e); }
  },

  async crearEvento(req, res, next) {
    try {
      const evento = await CulturaService.crearEvento(req.usuario.comercio.id, req.body);
      res.status(201).json({ ok: true, data: evento });
    } catch (e) { next(e); }
  },

  async actualizarEvento(req, res, next) {
    try {
      res.json({ ok: true, data: await CulturaService.actualizarEvento(req.usuario.comercio.id, Number(req.params.id), req.body) });
    } catch (e) { next(e); }
  },

  async crearEntrada(req, res, next) {
    try {
      const entrada = await CulturaService.crearEntrada(req.usuario.comercio.id, Number(req.params.id), req.body);
      res.status(201).json({ ok: true, data: entrada });
    } catch (e) { next(e); }
  },

  async actualizarEntrada(req, res, next) {
    try {
      res.json({ ok: true, data: await CulturaService.actualizarEntrada(req.usuario.comercio.id, Number(req.params.id), req.body) });
    } catch (e) { next(e); }
  },

  async eliminarEntrada(req, res, next) {
    try {
      res.json({ ok: true, data: await CulturaService.eliminarEntrada(req.usuario.comercio.id, Number(req.params.id)) });
    } catch (e) { next(e); }
  },

  async reservasOrganizador(req, res, next) {
    try {
      const { estado } = req.query;
      res.json({ ok: true, data: await CulturaService.reservasOrganizador(req.usuario.comercio.id, estado) });
    } catch (e) { next(e); }
  },

  // ── Admin ──
  async adminListar(req, res, next) {
    try {
      res.json({ ok: true, data: await CulturaService.adminListar() });
    } catch (e) { next(e); }
  },

  async adminCrearEvento(req, res, next) {
    try {
      const evento = await CulturaService.adminCrearEvento(req.body);
      res.status(201).json({ ok: true, data: evento });
    } catch (e) { next(e); }
  },

  async adminCambiarEstado(req, res, next) {
    try {
      res.json({ ok: true, data: await CulturaService.adminCambiarEstado(Number(req.params.id), req.body.estado) });
    } catch (e) { next(e); }
  },

  // ── Comparte tu Chocó (publicaciones comunitarias) ──
  async crearPublicacion(req, res, next) {
    try {
      res.status(201).json({ ok: true, data: await CulturaService.crearPublicacion(req.usuario.id, req.body) });
    } catch (e) { next(e); }
  },

  async listarPublicaciones(req, res, next) {
    try {
      const { departamento, page } = req.query;
      res.json({ ok: true, data: await CulturaService.listarPublicaciones({ departamento, page, usuarioId: req.usuario?.id }) });
    } catch (e) { next(e); }
  },

  async denunciarPublicacion(req, res, next) {
    try {
      res.status(201).json({ ok: true, data: await CulturaService.denunciarPublicacion(req.usuario.id, Number(req.params.id), req.body) });
    } catch (e) { next(e); }
  },

  async listarDenunciasPublicacionPendientes(req, res, next) {
    try {
      res.json({ ok: true, data: await CulturaService.listarDenunciasPublicacionPendientes() });
    } catch (e) { next(e); }
  },

  async resolverDenunciaPublicacion(req, res, next) {
    try {
      res.json({ ok: true, data: await CulturaService.resolverDenunciaPublicacion(req.usuario.id, Number(req.params.id), req.body) });
    } catch (e) { next(e); }
  },

  // ── Likes de publicaciones culturales ──
  async toggleLikePublicacion(req, res, next) {
    try {
      const data = await CulturaService.toggleLikePublicacion(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  // ── Favoritos Cultura ──
  async toggleFavorito(req, res, next) {
    try {
      const data = await CulturaService.toggleFavoritoCultura(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async misFavoritos(req, res, next) {
    try {
      const data = await CulturaService.misFavoritosCultura(req.usuario.id);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async esFavorito(req, res, next) {
    try {
      const data = await CulturaService.esFavoritoCultura(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },
};

module.exports = CulturaController;
