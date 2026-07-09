const fs = require("fs");
const path = require("path");
const { subirACloudinary, subirVideoACloudinary, construirUrlVideoOptimizada, construirPosterVideo } = require("../utils/cloudinary");
const TransporteService = require("../services/transporte.service");
const prisma = require("../config/prisma");
const {
  crearUploadVideo,
  extraerVideoMeta,
  normalizarRecorteVideo,
  urlLocalVideo,
  eliminarArchivoLocalDesdeUrl,
} = require("../utils/video-media");

const _uploadVideoTransporte = crearUploadVideo({
  dir: path.join(__dirname, "../../uploads/videos/transportes"),
  prefijo: "transporte-video",
  fieldName: "video",
});

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

  // ── CUPONES ───────────────────────────────────────────────────
  async validarCupon(req, res, next) {
    try {
      const { codigo, rutaTransporteId, asientos } = req.body;
      const cantidadAsientos = Number(asientos) || 1;
      const ruta = await prisma.rutaTransporte.findUnique({ where: { id: Number(rutaTransporteId) }, include: { configTransporte: true } });
      if (!ruta) return res.status(404).json({ ok: false, error: "Ruta no encontrada" });
      const totalOriginal = Number(ruta.precioAsiento) * cantidadAsientos;
      const data = await TransporteService.validarCuponTransporte(codigo, ruta.configTransporteId, cantidadAsientos, req.usuario?.id, totalOriginal, ruta.configTransporte?.comercioId ?? null);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async listarCupones(req, res, next) {
    try {
      const data = await TransporteService.listarCuponesTransporte(req.usuario.comercio.id);
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async crearCupon(req, res, next) {
    try {
      const data = await TransporteService.crearCuponTransporte(req.usuario.comercio.id, req.body);
      res.status(201).json({ ok: true, data });
    } catch (e) { next(e); }
  },

  async eliminarCupon(req, res, next) {
    try {
      await TransporteService.eliminarCuponTransporte(req.usuario.comercio.id, Number(req.params.id));
      res.json({ ok: true });
    } catch (e) { next(e); }
  },
};

// ── VIDEO TRANSPORTE ──────────────────────────────────────────

async function uploadVideoTransporte(req, res, next) {
  _uploadVideoTransporte(req, res, err => { if (err) return next(err); next(); });
}

async function subirVideoTransporte(req, res, next) {
  const filePath = req.file?.path;
  try {
    const comercioId = req.usuario.comercio.id;
    if (!req.file) return res.status(400).json({ ok: false, error: "No se recibió archivo de video" });
    const meta = extraerVideoMeta(req.body);
    const recorte = normalizarRecorteVideo(meta);
    const { secureUrl } = await subirVideoACloudinary(req.file.path, "afromercado/videos/transportes");
    const videoUrl = construirUrlVideoOptimizada(secureUrl, recorte);
    const posterFinal = construirPosterVideo(secureUrl, recorte);
    const result = await TransporteService.subirVideoTransporte(comercioId, videoUrl, posterFinal, recorte.duracionFinal);
    res.json({ ok: true, data: result });
  } catch (err) { next(err); } finally {
    if (filePath) fs.unlink(filePath, () => {});
  }
}

async function quitarVideoTransporte(req, res, next) {
  try {
    const comercioId = req.usuario.comercio.id;
    const result = await TransporteService.quitarVideoTransporte(comercioId);
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
}

async function guardarVideoLinkTransporte(req, res, next) {
  try {
    const comercioId = req.usuario.comercio.id;
    const { videoUrl } = req.body;
    if (!videoUrl || typeof videoUrl !== 'string') return res.status(400).json({ ok: false, error: "videoUrl requerido" });
    const result = await TransporteService.guardarVideoLinkTransporte(comercioId, videoUrl.trim());
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
}

TransporteController.uploadVideoTransporte        = uploadVideoTransporte;
TransporteController.subirVideoTransporte         = subirVideoTransporte;
TransporteController.quitarVideoTransporte        = quitarVideoTransporte;
TransporteController.guardarVideoLinkTransporte   = guardarVideoLinkTransporte;

module.exports = TransporteController;
