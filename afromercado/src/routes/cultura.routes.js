const path = require("path");
const fs = require("fs");
const multer = require("multer");
const express = require("express");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { autenticar, autorizar, autenticarOpcional } = require("../middlewares/auth");
const CulturaController = require("../controllers/cultura.controller");
const ReviewController = require("../controllers/review.controller");
const { subirACloudinary, subirVideoACloudinary, construirUrlVideoOptimizada, construirPosterVideo } = require("../utils/cloudinary");
const { crearUploadVideo, extraerVideoMeta, normalizarRecorteVideo, urlLocalVideo } = require("../utils/video-media");

const router = express.Router();

// Límite anti-spam: máx. 25 publicaciones/adjuntos por usuario cada 24h
// (mismo estilo que apiLimiter/authLimiter en app.js, pero por usuario en
// vez de por IP ya que estos endpoints requieren autenticación).
const publicacionLimiter = rateLimit({
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  windowMs: 24 * 60 * 60 * 1000,
  max: 25,
  keyGenerator: (req) => (req.usuario?.id ? `usuario:${req.usuario.id}` : `ip:${ipKeyGenerator(req.ip)}`),
  skip: () => process.env.NODE_ENV !== "production",
  message: { ok: false, error: "Alcanzaste el límite diario de publicaciones. Intenta mañana." },
});

// Límite anti-spam para comentarios en publicaciones de Vitrina/Comparte tu
// Chocó — sin cola de moderación previa (a diferencia de Empleo/Inmueble),
// así que este límite es la única barrera contra un usuario inundando de
// comentarios una publicación. Más permisivo que publicacionLimiter porque
// comentar es una acción más liviana que publicar con adjuntos.
const comentarioLimiter = rateLimit({
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  windowMs: 24 * 60 * 60 * 1000,
  max: 60,
  keyGenerator: (req) => (req.usuario?.id ? `usuario:${req.usuario.id}` : `ip:${ipKeyGenerator(req.ip)}`),
  skip: () => process.env.NODE_ENV !== "production",
  message: { ok: false, error: "Alcanzaste el límite diario de comentarios. Intenta mañana." },
});

const soloAuth     = [autenticar];
const soloComercio = [autenticar, autorizar("COMERCIANTE")];
const soloAdmin    = [autenticar, autorizar("ADMIN")];

// ── Multer para fotos/video adjuntos a Cultura (reseñas y publicaciones) ──
// Cualquier usuario autenticado puede adjuntar (no solo comerciantes),
// mismo patrón que empleo.routes.js::uploadCv (sin autorizar por rol).
// Factories reutilizables: mismo storage+fileFilter+límites que ya usaban
// las reseñas, para no duplicar el multer al agregar publicaciones.
function crearUploaderFoto(dirLocal, prefijoArchivo) {
  fs.mkdirSync(dirLocal, { recursive: true });
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dirLocal),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `${prefijoArchivo}_${req.usuario.id}_${Date.now()}${ext}`);
    },
  });
  return multer({
    storage,
    fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  });
}

function crearUploaderVideo(dirLocal, prefijoArchivo) {
  fs.mkdirSync(dirLocal, { recursive: true });
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dirLocal),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".mp4";
      cb(null, `${prefijoArchivo}_${req.usuario.id}_${Date.now()}${ext}`);
    },
  });
  return multer({
    storage,
    fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith("video/")),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  });
}

function crearHandlerSubidaFoto(carpetaCloudinary, nombreCarpetaUrl) {
  return async (req, res, next) => {
    const filePath = req.file?.path;
    try {
      if (!req.file) return res.status(400).json({ ok: false, error: "No se recibió imagen" });
      const secureUrl = await subirACloudinary(req.file.path, carpetaCloudinary);
      if (secureUrl) {
        fs.unlink(filePath, () => {});
        return res.json({ ok: true, url: secureUrl });
      }
      const url = `${req.protocol}://${req.get("host")}/uploads/${nombreCarpetaUrl}/${req.file.filename}`;
      res.json({ ok: true, url });
    } catch (e) { next(e); }
  };
}

function crearHandlerSubidaVideo(carpetaCloudinary, nombreCarpetaUrl) {
  return async (req, res, next) => {
    const filePath = req.file?.path;
    try {
      if (!req.file) return res.status(400).json({ ok: false, error: "No se recibió video" });
      const resultado = await subirVideoACloudinary(req.file.path, carpetaCloudinary);
      if (resultado) {
        fs.unlink(filePath, () => {});
        return res.json({ ok: true, url: resultado.optimizedUrl || resultado.secureUrl });
      }
      const url = `${req.protocol}://${req.get("host")}/uploads/${nombreCarpetaUrl}/${req.file.filename}`;
      res.json({ ok: true, url });
    } catch (e) { next(e); }
  };
}

// Reseñas de Cultura (comportamiento idéntico al original, ahora vía factory)
const DIR_REVIEWS_CULTURA = path.join(__dirname, "..", "..", "uploads", "reviews-cultura");
const uploadFotoReviewCultura = crearUploaderFoto(DIR_REVIEWS_CULTURA, "review-cultura");
const uploadVideoReviewCultura = crearUploaderVideo(DIR_REVIEWS_CULTURA, "review-cultura");
const handlerSubidaFotoReviewCultura = crearHandlerSubidaFoto("afromercado/reviews-cultura", "reviews-cultura");
const handlerSubidaVideoReviewCultura = crearHandlerSubidaVideo("afromercado/reviews-cultura", "reviews-cultura");

// Publicaciones comunitarias ("Comparte tu Chocó") y vitrina de video de comercio
const DIR_PUBLICACIONES_CULTURA = path.join(__dirname, "..", "..", "uploads", "publicaciones-cultura");
const uploadFotoPublicacion = crearUploaderFoto(DIR_PUBLICACIONES_CULTURA, "publicacion-cultura");
const handlerSubidaFotoPublicacion = crearHandlerSubidaFoto("afromercado/publicaciones-cultura", "publicaciones-cultura");

// Video de publicaciones: migrado al middleware maduro de video-media.js
// (usado por Tour) — valida duración máxima 45s server-side (con recorte) y
// captura metadata rica, a diferencia del multer bespoke que usan reseñas/eventos.
const DIR_VIDEOS_PUBLICACIONES = path.join(__dirname, "..", "..", "uploads", "videos", "publicaciones-cultura");
const _uploadVideoPublicacion = crearUploadVideo({
  dir: DIR_VIDEOS_PUBLICACIONES,
  prefijo: "publicacion-cultura-video",
  fieldName: "video",
  maxFileSize: 45 * 1024 * 1024, // 45 MB — menor que los 100MB de Tour: video vertical corto no lo necesita
});
function uploadVideoPublicacion(req, res, next) {
  _uploadVideoPublicacion(req, res, (err) => { if (err) return next(err); next(); });
}

async function handlerSubidaVideoPublicacion(req, res, next) {
  const filePath = req.file?.path;
  let mantenerLocal = false;
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "No se recibió video" });
    const meta = extraerVideoMeta(req.body);
    const subida = await subirVideoACloudinary(req.file.path, "afromercado/publicaciones-cultura");
    const recorte = normalizarRecorteVideo(meta, subida?.duration ?? null);
    mantenerLocal = !subida?.secureUrl;
    const secureUrl = subida?.secureUrl ?? urlLocalVideo(req, `uploads/videos/publicaciones-cultura/${req.file.filename}`);
    const videoUrl = construirUrlVideoOptimizada(secureUrl, recorte);
    const posterUrl = construirPosterVideo(secureUrl, recorte);
    res.json({
      ok: true,
      url: videoUrl,
      posterUrl,
      duracionSegundos: recorte.duracionFinal,
      publicId: subida?.publicId ?? null,
    });
  } catch (e) { next(e); } finally {
    if (filePath && !mantenerLocal) fs.unlink(filePath, () => {});
  }
}

// Media de eventos (organizador): portada, galería de fotos y video del evento
const DIR_EVENTOS_CULTURA = path.join(__dirname, "..", "..", "uploads", "eventos-cultura");
const uploadFotoEvento = crearUploaderFoto(DIR_EVENTOS_CULTURA, "evento-cultura");
const uploadVideoEvento = crearUploaderVideo(DIR_EVENTOS_CULTURA, "evento-cultura");
const handlerSubidaFotoEvento = crearHandlerSubidaFoto("afromercado/eventos-cultura", "eventos-cultura");
const handlerSubidaVideoEvento = crearHandlerSubidaVideo("afromercado/eventos-cultura", "eventos-cultura");

// ── PÚBLICO ──────────────────────────────────────────────────
router.get("/", CulturaController.listarAgenda);

// ── ORGANIZADOR (comercio) ───────────────────────────────────
router.get(   "/mis-eventos",              ...soloComercio, CulturaController.misEventos);
router.post(  "/mis-eventos",              ...soloComercio, CulturaController.crearEvento);
router.get(   "/mis-eventos/reservas",     ...soloComercio, CulturaController.reservasOrganizador);
router.patch( "/mis-eventos/reservas/:id/estado", ...soloComercio, CulturaController.cambiarEstadoReserva);
router.patch( "/mis-eventos/:id",          ...soloComercio, CulturaController.actualizarEvento);
router.post(  "/mis-eventos/foto",         ...soloComercio, uploadFotoEvento.single("foto"),   handlerSubidaFotoEvento);
router.post(  "/mis-eventos/video",        ...soloComercio, uploadVideoEvento.single("video"), handlerSubidaVideoEvento);
router.post(  "/mis-eventos/:id/entradas", ...soloComercio, CulturaController.crearEntrada);
router.patch( "/entradas/:id",             ...soloComercio, CulturaController.actualizarEntrada);
router.delete("/entradas/:id",             ...soloComercio, CulturaController.eliminarEntrada);

// ── CLIENTE ──────────────────────────────────────────────────
router.post( "/reservas",              ...soloAuth, CulturaController.reservar);
router.get(  "/reservas/mis",          ...soloAuth, CulturaController.misReservas);
router.patch("/reservas/:id/cancelar", ...soloAuth, CulturaController.cancelarReserva);
router.post( "/reservas/:id/review",   ...soloAuth, ReviewController.crearReviewCultura);

// ── RESEÑAS: adjuntos de foto/video (cualquier usuario autenticado) ──
router.post("/reviews/foto",  ...soloAuth, uploadFotoReviewCultura.single("foto"),   handlerSubidaFotoReviewCultura);
router.post("/reviews/video", ...soloAuth, uploadVideoReviewCultura.single("video"), handlerSubidaVideoReviewCultura);

// Galería pública — antes de "/:id" para evitar ambigüedad de rutas
router.get("/galeria", ReviewController.galeriaCultura);

// ── COMPARTE TU CHOCÓ (publicaciones comunitarias, sin moderación previa) ──
// Cualquier usuario autenticado publica; control solo reactivo vía denuncias.
router.post("/publicaciones",               ...soloAuth, publicacionLimiter, CulturaController.crearPublicacion);
router.get(  "/publicaciones",                            autenticarOpcional, CulturaController.listarPublicaciones);
router.post("/publicaciones/foto",          ...soloAuth, publicacionLimiter, uploadFotoPublicacion.single("foto"), handlerSubidaFotoPublicacion);
router.post("/publicaciones/video",         ...soloAuth, publicacionLimiter, uploadVideoPublicacion, handlerSubidaVideoPublicacion);
router.post("/publicaciones/:id/denunciar", ...soloAuth, CulturaController.denunciarPublicacion);
router.post("/publicaciones/:id/like/toggle", ...soloAuth, CulturaController.toggleLikePublicacion);
router.post("/publicaciones/:id/favorito/toggle", ...soloAuth, CulturaController.toggleFavoritoPublicacion);
router.post("/publicaciones/:id/vista",           autenticarOpcional, CulturaController.registrarVista);
router.post("/publicaciones/:id/compartir",       autenticarOpcional, CulturaController.registrarCompartido);
router.get("/publicaciones/:id/comentarios",      autenticarOpcional, CulturaController.listarComentarios);
router.post("/publicaciones/:id/comentarios",     ...soloAuth, comentarioLimiter, CulturaController.crearComentario);

// ── VITRINA DE VIDEO (v0) — publicaciones de comercio ──────────
// Antes de "/:id" para evitar ambigüedad de rutas.
router.get("/vitrina", autenticarOpcional, CulturaController.listarVitrina);

// ── ADMIN ─────────────────────────────────────────────────────
router.get(  "/admin/todos",      ...soloAdmin, CulturaController.adminListar);
router.post( "/admin/eventos",    ...soloAdmin, CulturaController.adminCrearEvento);
router.patch("/admin/:id/estado", ...soloAdmin, CulturaController.adminCambiarEstado);

// Nota de diseño: dado el mount point router.use("/cultura", ...) en
// routes/index.js, las rutas admin de publicaciones se declaran aquí como
// "/admin/publicaciones/..." (no "/admin/cultura/publicaciones/...") para
// que el path HTTP final sea /cultura/admin/publicaciones/denuncias y no
// un duplicado /cultura/admin/cultura/publicaciones/denuncias.
router.get(  "/admin/publicaciones/denuncias",              ...soloAdmin, CulturaController.listarDenunciasPublicacionPendientes);
router.patch("/admin/publicaciones/denuncias/:id/resolver", ...soloAdmin, CulturaController.resolverDenunciaPublicacion);

// ── PÚBLICO (reviews) ─────────────────────────────────────────
router.get("/:id/reviews", ReviewController.reviewsCultura);

// Favoritos — antes de "/:id" para evitar ambigüedad de rutas
router.get(  "/favoritos/mis",        ...soloAuth, CulturaController.misFavoritos);
router.post( "/favoritos/:id/toggle", ...soloAuth, CulturaController.toggleFavorito);
router.get(  "/favoritos/:id",        ...soloAuth, CulturaController.esFavorito);

// Detalle público del evento — al final para no capturar rutas específicas
router.get("/:id", CulturaController.obtener);

module.exports = router;
