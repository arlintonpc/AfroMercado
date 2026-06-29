const fs = require("fs");
const { subirACloudinary } = require("../utils/cloudinary");
const HotelService = require("../services/hotel.service");

const HotelController = {
  // ── PÚBLICO ──────────────────────────────────────────────────
  async listar(req, res, next) {
    try {
      const { municipio, departamento } = req.query;
      const data = await HotelService.listarHoteles({ municipio, departamento });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async obtener(req, res, next) {
    try {
      const data = await HotelService.obtenerHotel(Number(req.params.id));
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async disponibilidad(req, res, next) {
    try {
      const { habitacionTipoId, fechaEntrada, fechaSalida } = req.query;
      const data = await HotelService.verificarDisponibilidad(
        Number(habitacionTipoId), new Date(fechaEntrada), new Date(fechaSalida)
      );
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // ── CLIENTE ──────────────────────────────────────────────────
  async reservar(req, res, next) {
    try {
      const data = await HotelService.crearReserva(req.usuario.id, req.body);
      res.status(201).json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async misReservas(req, res, next) {
    try {
      const data = await HotelService.misReservas(req.usuario.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async cancelarReserva(req, res, next) {
    try {
      const data = await HotelService.cancelarReservaCliente(Number(req.params.id), req.usuario.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // ── HOTELERO ─────────────────────────────────────────────────
  async miConfig(req, res, next) {
    try {
      const data = await HotelService.obtenerOCrearConfig(req.usuario.comercio.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async actualizarConfig(req, res, next) {
    try {
      const data = await HotelService.actualizarConfig(req.usuario.comercio.id, req.body);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async agregarHabitacion(req, res, next) {
    try {
      const data = await HotelService.agregarHabitacion(req.usuario.comercio.id, req.body);
      res.status(201).json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async actualizarHabitacion(req, res, next) {
    try {
      const data = await HotelService.actualizarHabitacion(req.usuario.comercio.id, Number(req.params.id), req.body);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async eliminarHabitacion(req, res, next) {
    try {
      await HotelService.eliminarHabitacion(req.usuario.comercio.id, Number(req.params.id));
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  async reservasHotelero(req, res, next) {
    try {
      const data = await HotelService.reservasHotelero(req.usuario.comercio.id, req.query);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async cambiarEstado(req, res, next) {
    try {
      const data = await HotelService.cambiarEstadoReserva(
        req.usuario.comercio.id, Number(req.params.id), req.body.estado
      );
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async ocupacion(req, res, next) {
    try {
      const data = await HotelService.ocupacion(req.usuario.comercio.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async subirFotosHabitacion(req, res, next) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ ok: false, error: "Adjunta al menos una foto" });
      }
      const base = `${req.protocol}://${req.get("host")}`;
      const urls = [];
      for (const f of req.files) {
        const cloudUrl = await subirACloudinary(f.path, "afromercado/hoteles");
        if (cloudUrl) {
          urls.push(cloudUrl);
          fs.unlink(f.path, () => {});
        } else {
          urls.push(`${base}/uploads/hoteles/${f.filename}`);
        }
      }
      const hab = await HotelService.agregarFotosHabitacion(
        req.usuario.comercio.id, Number(req.params.id), urls
      );
      res.json({ ok: true, data: hab });
    } catch (e) { next(e); }
  },
  // ── BLOQUEOS MANUALES ─────────────────────────────────────────
  async listarBloqueos(req, res, next) {
    try {
      const data = await HotelService.listarBloqueos(req.usuario.comercio.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async crearBloqueo(req, res, next) {
    try {
      const data = await HotelService.crearBloqueo(req.usuario.comercio.id, req.body);
      res.status(201).json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async eliminarBloqueo(req, res, next) {
    try {
      const data = await HotelService.eliminarBloqueo(req.usuario.comercio.id, req.params.bloqueoId);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // ── ADMIN ──────────────────────────────────────────────────────
  async adminListar(req, res, next) {
    try {
      const data = await HotelService.adminListarHoteles();
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async adminCambiarEstado(req, res, next) {
    try {
      const { activo } = req.body;
      const data = await HotelService.adminCambiarEstado(Number(req.params.id), activo);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async adminReservas(req, res, next) {
    try {
      const data = await HotelService.adminReservasHotel(Number(req.params.id));
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },
};

module.exports = HotelController;
