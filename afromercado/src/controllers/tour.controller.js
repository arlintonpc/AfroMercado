const fs = require("fs");
const path = require("path");
const { subirACloudinary, subirVideoACloudinary, construirUrlVideoOptimizada, construirPosterVideo } = require("../utils/cloudinary");
const TourService = require("../services/tour.service");
const {
  crearUploadVideo,
  extraerVideoMeta,
  normalizarRecorteVideo,
  urlLocalVideo,
  eliminarArchivoLocalDesdeUrl,
} = require("../utils/video-media");

const _uploadVideoTour = crearUploadVideo({
  dir: path.join(__dirname, "../../uploads/videos/tours"),
  prefijo: "tour-video",
  fieldName: "video",
});

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

  // ── CUPONES TOUR ──────────────────────────────────────────────

  async validarCupon(req, res, next) {
    try {
      const { codigo, participantes, configTourId } = req.body;
      if (!codigo || !participantes || !configTourId) {
        return res.status(400).json({ ok: false, error: "codigo, participantes y configTourId requeridos" });
      }
      const data = await TourService.validarCuponTour(codigo, Number(configTourId), Number(participantes), req.usuario?.id ?? null);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async listarCupones(req, res, next) {
    try {
      const comercioId = req.usuario.comercio.id;
      const data = await TourService.listarCuponesTour(comercioId);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async crearCupon(req, res, next) {
    try {
      const comercioId = req.usuario.comercio.id;
      const data = await TourService.crearCuponTour(comercioId, req.body);
      res.status(201).json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async eliminarCupon(req, res, next) {
    try {
      const comercioId = req.usuario.comercio.id;
      await TourService.eliminarCuponTour(comercioId, Number(req.params.id));
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  // ── FAVORITOS TOUR ────────────────────────────────────────────

  async toggleFavorito(req, res, next) {
    try {
      const data = await TourService.toggleFavoritoTour(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async misFavoritos(req, res, next) {
    try {
      const data = await TourService.misFavoritosTour(req.usuario.id);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async esFavorito(req, res, next) {
    try {
      const data = await TourService.esFavoritoTour(req.usuario.id, Number(req.params.id));
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  // ── ESTADÍSTICAS TOUR ─────────────────────────────────────────

  async estadisticas(req, res, next) {
    try {
      const comercioId = req.usuario.comercio.id;
      const data = await TourService.estadisticasTour(comercioId);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },
};

// ── VIDEO TOUR ────────────────────────────────────────────────

async function uploadVideoTour(req, res, next) {
  _uploadVideoTour(req, res, err => { if (err) return next(err); next(); });
}

async function subirVideoTour(req, res, next) {
  const filePath = req.file?.path;
  try {
    const comercioId = req.usuario.comercio.id;
    if (!req.file) return res.status(400).json({ ok: false, error: "No se recibió archivo de video" });
    const meta = extraerVideoMeta(req.body);
    const recorte = normalizarRecorteVideo(meta);
    const { secureUrl } = await subirVideoACloudinary(req.file.path, "afromercado/videos/tours");
    const videoUrl = construirUrlVideoOptimizada(secureUrl, recorte);
    const posterFinal = construirPosterVideo(secureUrl, recorte);
    const result = await TourService.subirVideoTour(comercioId, videoUrl, posterFinal, recorte.duracionFinal);
    res.json({ ok: true, data: result });
  } catch (err) { next(err); } finally {
    if (filePath) fs.unlink(filePath, () => {});
  }
}

async function quitarVideoTour(req, res, next) {
  try {
    const comercioId = req.usuario.comercio.id;
    const result = await TourService.quitarVideoTour(comercioId);
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
}

async function guardarVideoLinkTour(req, res, next) {
  try {
    const comercioId = req.usuario.comercio.id;
    const { videoUrl } = req.body;
    if (!videoUrl || typeof videoUrl !== 'string') return res.status(400).json({ ok: false, error: "videoUrl requerido" });
    const result = await TourService.guardarVideoLinkTour(comercioId, videoUrl.trim());
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
}

TourController.uploadVideoTour    = uploadVideoTour;
TourController.subirVideoTour     = subirVideoTour;
TourController.quitarVideoTour    = quitarVideoTour;
TourController.guardarVideoLinkTour = guardarVideoLinkTour;

module.exports = TourController;
