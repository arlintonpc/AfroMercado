const fs = require("fs");
const path = require("path");
const { subirACloudinary, subirVideoACloudinary, construirUrlVideoOptimizada, construirPosterVideo } = require("../utils/cloudinary");
const HotelService = require("../services/hotel.service");
const { ErrorValidacion } = require("../utils/errores");
const prisma = require("../config/prisma");
const {
  crearUploadVideo,
  extraerVideoMeta,
  normalizarRecorteVideo,
  urlLocalVideo,
} = require("../utils/video-media");

const _uploadVideo = crearUploadVideo({
  dir: path.join(__dirname, "../../uploads/videos/habitaciones"),
  prefijo: "hab-video",
  fieldName: "video",
});

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
      const id = Number(req.params.id);
      if (!id || isNaN(id)) return res.status(404).json({ ok: false, error: "Hotel no encontrado" });
      const data = await HotelService.obtenerHotel(id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async disponibilidad(req, res, next) {
    try {
      const { habitacionTipoId, fechaEntrada, fechaSalida, modalidad } = req.query;
      const data = await HotelService.verificarDisponibilidad(
        Number(habitacionTipoId), new Date(fechaEntrada), new Date(fechaSalida), { modalidad }
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

  async reservarMultiple(req, res, next) {
    try {
      const data = await HotelService.crearReservaMultiple(req.usuario.id, req.body);
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

  async politicaCancelacion(req, res, next) {
    try {
      const data = await HotelService.consultarPoliticaCancelacion(Number(req.params.id), req.usuario.id);
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

  async habitacionesFisicas(req, res, next) {
    try {
      const data = await HotelService.habitacionesFisicas(req.usuario.comercio.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async crearHabitacionFisica(req, res, next) {
    try {
      const data = await HotelService.crearHabitacionFisica(req.usuario.comercio.id, req.body);
      res.status(201).json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async actualizarHabitacionFisica(req, res, next) {
    try {
      const data = await HotelService.actualizarHabitacionFisica(
        req.usuario.comercio.id,
        Number(req.params.id),
        req.body
      );
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async cambiarEstadoHabitacionFisica(req, res, next) {
    try {
      const data = await HotelService.cambiarEstadoHabitacionFisica(
        req.usuario.comercio.id,
        Number(req.params.id),
        req.body.estado
      );
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async eliminarHabitacionFisica(req, res, next) {
    try {
      await HotelService.eliminarHabitacionFisica(req.usuario.comercio.id, Number(req.params.id));
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  async asignarHabitacionFisicaReserva(req, res, next) {
    try {
      const data = await HotelService.asignarHabitacionFisicaReserva(
        req.usuario.comercio.id,
        Number(req.params.id),
        Number(req.body.habitacionFisicaId)
      );
      res.json({ ok: true, data });
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
        req.usuario.comercio.id, Number(req.params.id), req.body.estado, req.body
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

  // ── FAVORITOS ─────────────────────────────────────────────────
  async toggleFavorito(req, res, next) {
    try {
      const data = await HotelService.toggleFavorito(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async misFavoritos(req, res, next) {
    try {
      const data = await HotelService.misFavoritosHotel(req.usuario.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async esFavorito(req, res, next) {
    try {
      const data = await HotelService.esFavoritoHotel(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // ── ESTADÍSTICAS ──────────────────────────────────────────────
  async estadisticas(req, res, next) {
    try {
      const data = await HotelService.estadisticasHotelero(req.usuario.comercio.id);
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

  async adminVerificarRnt(req, res, next) {
    try {
      const { verificado } = req.body;
      const data = await prisma.configHotel.update({
        where: { id: Number(req.params.id) },
        data: { rntVerificado: !!verificado },
      });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // ── VIDEO HABITACIÓN ──────────────────────────────────────────
  uploadVideoHabitacion: _uploadVideo,

  async subirVideoHabitacion(req, res, next) {
    let cloud = null;
    const filePath = req.file?.path;
    try {
      if (!req.file) throw new ErrorValidacion('Adjunta un video en el campo "video"');

      const meta = extraerVideoMeta(req.body);
      normalizarRecorteVideo(meta);

      cloud = await subirVideoACloudinary(req.file.path, "afromercado/videos/habitaciones");
      const recorte = normalizarRecorteVideo(meta, cloud?.duration ?? meta.durationSeconds);

      const urlLocalBase = urlLocalVideo(req, `uploads/videos/habitaciones/${req.file.filename}`);
      const urlLocalFinal = recorte.tieneRecorte
        ? `${urlLocalBase}#t=${recorte.inicio},${recorte.fin}`
        : urlLocalBase;

      const videoUrl = cloud
        ? (construirUrlVideoOptimizada(cloud.secureUrl, recorte) || cloud.optimizedUrl || cloud.secureUrl)
        : urlLocalFinal;
      const posterUrl = cloud ? (construirPosterVideo?.(cloud.secureUrl, recorte) ?? cloud.posterUrl ?? null) : null;
      const duracion  = recorte.duracionFinal ?? cloud?.duration ?? null;

      const hab = await HotelService.subirVideoHabitacion(
        req.usuario.comercio.id, Number(req.params.id), videoUrl, posterUrl, duracion
      );
      res.json({ ok: true, data: {
        videoUrl: hab.videoUrl,
        videoPosterUrl: hab.videoPosterUrl,
        videoDuracionSeg: hab.videoDuracionSeg,
      }});
    } catch (e) {
      next(e);
    } finally {
      if (filePath) fs.unlink(filePath, () => {});
    }
  },

  async quitarVideoHabitacion(req, res, next) {
    try {
      await HotelService.quitarVideoHabitacion(req.usuario.comercio.id, Number(req.params.id));
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  async guardarVideoLinkHabitacion(req, res, next) {
    try {
      const { videoUrl } = req.body;
      if (!videoUrl || typeof videoUrl !== 'string') return res.status(400).json({ ok: false, error: "videoUrl requerido" });
      const hab = await HotelService.guardarVideoLinkHabitacion(req.usuario.comercio.id, Number(req.params.id), videoUrl.trim());
      res.json({ ok: true, data: hab });
    } catch (e) { next(e); }
  },

  // ── CUPONES ───────────────────────────────────────────────────
  async validarCupon(req, res, next) {
    try {
      const { codigo, habitacionTipoId, fechaEntrada, fechaSalida, modalidad } = req.body;
      const entrada = new Date(fechaEntrada);
      const salida  = new Date(fechaSalida);
      const modalidadNormalizada = String(modalidad || "NOCHE").trim().toUpperCase();
      const duracionHoras = Math.max(0, (salida - entrada) / 3600000);
      const noches  = modalidadNormalizada === "HORAS" ? 1 : Math.ceil((salida - entrada) / 86400000);
      const tipo    = await prisma.habitacionTipo.findUnique({ where: { id: Number(habitacionTipoId) } });
      if (!tipo) return res.status(404).json({ ok: false, error: "Habitación no encontrada" });
      const totalOriginal = modalidadNormalizada === "HORAS"
        ? Number(tipo.precioPorHora || 0) * duracionHoras
        : Number(tipo.precioPorNoche) * noches;
      const data = await HotelService.validarCuponHotel(codigo, tipo.configHotelId, noches, req.usuario?.id, totalOriginal);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async listarCupones(req, res, next) {
    try {
      const data = await HotelService.listarCuponesHotel(req.usuario.comercio.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async crearCupon(req, res, next) {
    try {
      const data = await HotelService.crearCuponHotel(req.usuario.comercio.id, req.body);
      res.status(201).json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async eliminarCupon(req, res, next) {
    try {
      await HotelService.eliminarCuponHotel(req.usuario.comercio.id, Number(req.params.id));
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  // ── TEMPORADAS ────────────────────────────────────────────────
  async listarTemporadas(req, res, next) {
    try {
      const data = await HotelService.listarTemporadas(req.usuario.comercio.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async crearTemporada(req, res, next) {
    try {
      const data = await HotelService.crearTemporada(req.usuario.comercio.id, req.body);
      res.status(201).json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async eliminarTemporada(req, res, next) {
    try {
      await HotelService.eliminarTemporada(req.usuario.comercio.id, Number(req.params.id));
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  // ── PAGO DIGITAL ──────────────────────────────────────────────
  async iniciarPagoReserva(req, res, next) {
    try {
      const resultado = await HotelService.iniciarPagoHotel(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, data: resultado });
    } catch (e) { next(e); }
  },

  // ── CHECK-IN ONLINE ───────────────────────────────────────────
  async solicitarTokenCheckin(req, res, next) {
    try {
      const data = await HotelService.generarTokenCheckin(Number(req.params.id), req.usuario.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async verCheckinPublico(req, res, next) {
    try {
      const data = await HotelService.obtenerReservaPorToken(req.params.token);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async realizarCheckin(req, res, next) {
    try {
      const data = await HotelService.realizarCheckinOnline(req.params.token, req.body);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },
};

module.exports = HotelController;
