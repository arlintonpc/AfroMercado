const express = require("express");
const multer  = require("multer");
const path    = require("path");
const { autenticar, autorizar } = require("../middlewares/auth");
const TransporteController = require("../controllers/transporte.controller");
const ReviewController     = require("../controllers/review.controller");
const TransporteService    = require("../services/transporte.service");
const prisma               = require("../config/prisma");

const router = express.Router();
const soloAuth     = [autenticar];
const soloComercio = [autenticar, autorizar("COMERCIANTE")];
const soloAdmin    = [autenticar, autorizar("ADMIN")];

const _upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => {
      const dir = path.join(__dirname, "../../uploads/transportes");
      require("fs").mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  fileFilter: (_, file, cb) => cb(null, file.mimetype.startsWith("image/")),
  limits: { fileSize: 8 * 1024 * 1024 },
});
const uploadFotos = _upload.array("fotos", 10);

// ── PÚBLICO ──────────────────────────────────────────────────
router.get("/",               TransporteController.listar);
router.get("/disponibilidad", TransporteController.disponibilidad);

// ── FAVORITOS (antes de /:id para que no lo capture el wildcard) ──
router.get( "/favoritos/mis",        ...soloAuth, async (req, res, next) => {
  try { res.json({ ok: true, data: await TransporteService.misFavoritosTransporte(req.usuario.id) }); } catch(e) { next(e); }
});
router.post("/favoritos/:id/toggle", ...soloAuth, async (req, res, next) => {
  try { res.json({ ok: true, data: await TransporteService.toggleFavorito(req.usuario.id, Number(req.params.id)) }); } catch(e) { next(e); }
});
router.get( "/favoritos/:id",        ...soloAuth, async (req, res, next) => {
  try { res.json({ ok: true, data: await TransporteService.esFavoritoTransporte(req.usuario.id, Number(req.params.id)) }); } catch(e) { next(e); }
});

// ── CLIENTE ──────────────────────────────────────────────────
router.post(  "/reservas",              ...soloAuth, TransporteController.reservar);
router.get(   "/reservas/mis",          ...soloAuth, TransporteController.misReservas);
router.patch( "/reservas/:id/cancelar", ...soloAuth, TransporteController.cancelarReserva);

// ── OPERADOR ─────────────────────────────────────────────────
router.get(   "/mi-transporte/config",              ...soloComercio, TransporteController.miConfig);
router.put(   "/mi-transporte/config",              ...soloComercio, TransporteController.actualizarConfig);
router.post(  "/mi-transporte/config/fotos",        ...soloComercio, uploadFotos, TransporteController.subirFotos);
router.post(  "/mi-transporte/config/video",        ...soloComercio, TransporteController.uploadVideoTransporte, TransporteController.subirVideoTransporte);
router.delete("/mi-transporte/config/video",        ...soloComercio, TransporteController.quitarVideoTransporte);
router.patch( "/mi-transporte/config/video-link",   ...soloComercio, TransporteController.guardarVideoLinkTransporte);
router.post(  "/mi-transporte/rutas",               ...soloComercio, TransporteController.agregarRuta);
router.put(   "/mi-transporte/rutas/:id",           ...soloComercio, TransporteController.actualizarRuta);
router.delete("/mi-transporte/rutas/:id",           ...soloComercio, TransporteController.eliminarRuta);
router.get(   "/mi-transporte/reservas",            ...soloComercio, TransporteController.reservasOperador);
router.patch( "/mi-transporte/reservas/:id/estado", ...soloComercio, TransporteController.cambiarEstado);
router.get(   "/mi-transporte/estadisticas",        ...soloComercio, async (req, res, next) => {
  try {
    const comercioId = req.usuario.comercio?.id;
    if (!comercioId) return res.status(400).json({ error: "No tienes un comercio asignado" });
    res.json({ ok: true, data: await TransporteService.estadisticas(comercioId) });
  } catch(e) { next(e); }
});

// ── REVIEWS ──────────────────────────────────────────────────
router.get( "/:id/reviews",             ReviewController.reviewsTransporte);
router.post("/reservas/:id/review", ...soloAuth, ReviewController.crearReviewTransporte);

// ── ADMIN ─────────────────────────────────────────────────────
router.get(   "/admin/todos",          ...soloAdmin, TransporteController.adminListar);
router.patch( "/admin/:id/estado",     ...soloAdmin, TransporteController.adminCambiarEstado);
router.get(   "/admin/:id/reservas",   ...soloAdmin, async (req, res, next) => {
  try {
    const data = await prisma.reservaTransporte.findMany({
      where: { ruta: { configTransporteId: Number(req.params.id) } },
      include: {
        ruta: { select: { origen: true, destino: true, horario: true } },
        cliente: { select: { nombre: true, email: true } },
      },
      orderBy: { creadoAt: "desc" },
      take: 100,
    });
    res.json({ ok: true, data });
  } catch(e) { next(e); }
});

// ── DETALLE PÚBLICO (al final para no capturar rutas específicas) ──
router.get("/:id", TransporteController.obtener);

module.exports = router;
