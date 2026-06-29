const fs = require("fs");
const { subirACloudinary } = require("../utils/cloudinary");
const TourService = require("../services/tour.service");

const TourController = {
  async listar(req, res, next) {
    try {
      const { municipio, departamento } = req.query;
      res.json({ ok: true, data: await TourService.listarTours({ municipio, departamento }) });
    } catch (e) { next(e); }
  },

  async obtener(req, res, next) {
    try {
      res.json({ ok: true, data: await TourService.obtenerTour(Number(req.params.id)) });
    } catch (e) { next(e); }
  },

  async disponibilidad(req, res, next) {
    try {
      const { configTourId, fecha } = req.query;
      res.json({ ok: true, data: await TourService.verificarDisponibilidad(Number(configTourId), fecha) });
    } catch (e) { next(e); }
  },

  async reservar(req, res, next) {
    try {
      const reserva = await TourService.crearReserva(req.usuario.id, req.body);
      res.status(201).json({ ok: true, data: reserva });
    } catch (e) { next(e); }
  },

  async misReservas(req, res, next) {
    try {
      res.json({ ok: true, data: await TourService.misReservas(req.usuario.id) });
    } catch (e) { next(e); }
  },

  async cancelarReserva(req, res, next) {
    try {
      res.json({ ok: true, data: await TourService.cancelarReserva(req.usuario.id, Number(req.params.id)) });
    } catch (e) { next(e); }
  },

  async miTour(req, res, next) {
    try {
      res.json({ ok: true, data: await TourService.miTour(req.usuario.comercio.id) });
    } catch (e) { next(e); }
  },

  async actualizarTour(req, res, next) {
    try {
      res.json({ ok: true, data: await TourService.actualizarTour(req.usuario.comercio.id, req.body) });
    } catch (e) { next(e); }
  },

  async reservasOperador(req, res, next) {
    try {
      const { estado } = req.query;
      res.json({ ok: true, data: await TourService.reservasOperador(req.usuario.comercio.id, estado) });
    } catch (e) { next(e); }
  },

  async cambiarEstado(req, res, next) {
    try {
      res.json({ ok: true, data: await TourService.cambiarEstadoReserva(req.usuario.comercio.id, Number(req.params.id), req.body.estado) });
    } catch (e) { next(e); }
  },

  async adminListar(req, res, next) {
    try {
      res.json({ ok: true, data: await TourService.adminListar() });
    } catch (e) { next(e); }
  },

  async adminCambiarEstado(req, res, next) {
    try {
      res.json({ ok: true, data: await TourService.adminCambiarEstado(Number(req.params.id), req.body.activo) });
    } catch (e) { next(e); }
  },

  async subirFotos(req, res, next) {
    try {
      const files = req.files ?? [];
      const urls = [];
      for (const f of files) {
        const url = await subirACloudinary(f.path, "afromercado/tours");
        urls.push(url ?? `/uploads/tours/${f.filename}`);
        try { if (url) fs.unlinkSync(f.path); } catch {}
      }
      const tour = await TourService.agregarFotos(req.usuario.comercio.id, urls);
      res.json({ ok: true, data: tour });
    } catch (e) { next(e); }
  },
};

module.exports = TourController;
