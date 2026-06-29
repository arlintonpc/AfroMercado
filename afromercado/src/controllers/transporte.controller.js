const fs = require("fs");
const { subirACloudinary } = require("../utils/cloudinary");
const TransporteService = require("../services/transporte.service");

const TransporteController = {
  async listar(req, res, next) {
    try {
      const { municipio, departamento } = req.query;
      res.json({ ok: true, data: await TransporteService.listar({ municipio, departamento }) });
    } catch (e) { next(e); }
  },

  async obtener(req, res, next) {
    try {
      res.json({ ok: true, data: await TransporteService.obtener(Number(req.params.id)) });
    } catch (e) { next(e); }
  },

  async disponibilidad(req, res, next) {
    try {
      const { rutaId, fecha } = req.query;
      res.json({ ok: true, data: await TransporteService.verificarDisponibilidad(Number(rutaId), fecha) });
    } catch (e) { next(e); }
  },

  async reservar(req, res, next) {
    try {
      const reserva = await TransporteService.crearReserva(req.usuario.id, req.body);
      res.status(201).json({ ok: true, data: reserva });
    } catch (e) { next(e); }
  },

  async misReservas(req, res, next) {
    try {
      res.json({ ok: true, data: await TransporteService.misReservas(req.usuario.id) });
    } catch (e) { next(e); }
  },

  async cancelarReserva(req, res, next) {
    try {
      res.json({ ok: true, data: await TransporteService.cancelarReserva(req.usuario.id, Number(req.params.id)) });
    } catch (e) { next(e); }
  },

  async miConfig(req, res, next) {
    try {
      res.json({ ok: true, data: await TransporteService.miConfig(req.usuario.comercio.id) });
    } catch (e) { next(e); }
  },

  async actualizarConfig(req, res, next) {
    try {
      res.json({ ok: true, data: await TransporteService.actualizarConfig(req.usuario.comercio.id, req.body) });
    } catch (e) { next(e); }
  },

  async agregarRuta(req, res, next) {
    try {
      res.status(201).json({ ok: true, data: await TransporteService.agregarRuta(req.usuario.comercio.id, req.body) });
    } catch (e) { next(e); }
  },

  async actualizarRuta(req, res, next) {
    try {
      res.json({ ok: true, data: await TransporteService.actualizarRuta(req.usuario.comercio.id, Number(req.params.id), req.body) });
    } catch (e) { next(e); }
  },

  async eliminarRuta(req, res, next) {
    try {
      res.json({ ok: true, data: await TransporteService.eliminarRuta(req.usuario.comercio.id, Number(req.params.id)) });
    } catch (e) { next(e); }
  },

  async reservasOperador(req, res, next) {
    try {
      res.json({ ok: true, data: await TransporteService.reservasOperador(req.usuario.comercio.id, req.query.estado) });
    } catch (e) { next(e); }
  },

  async cambiarEstado(req, res, next) {
    try {
      res.json({ ok: true, data: await TransporteService.cambiarEstado(req.usuario.comercio.id, Number(req.params.id), req.body.estado) });
    } catch (e) { next(e); }
  },

  async subirFotos(req, res, next) {
    try {
      const files = req.files ?? [];
      const urls = [];
      for (const f of files) {
        const url = await subirACloudinary(f.path, "afromercado/transportes");
        urls.push(url ?? `/uploads/transportes/${f.filename}`);
        try { if (url) fs.unlinkSync(f.path); } catch {}
      }
      const cfg = await TransporteService.agregarFotos(req.usuario.comercio.id, urls);
      res.json({ ok: true, data: cfg });
    } catch (e) { next(e); }
  },

  async adminListar(req, res, next) {
    try {
      res.json({ ok: true, data: await TransporteService.adminListar() });
    } catch (e) { next(e); }
  },

  async adminCambiarEstado(req, res, next) {
    try {
      res.json({ ok: true, data: await TransporteService.adminCambiarEstado(Number(req.params.id), req.body.activo) });
    } catch (e) { next(e); }
  },
};

module.exports = TransporteController;
