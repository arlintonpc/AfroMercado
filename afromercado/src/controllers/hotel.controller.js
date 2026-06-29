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
};

module.exports = HotelController;
