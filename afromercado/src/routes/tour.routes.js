const express = require("express");
const multer  = require("multer");
const path    = require("path");
const { autenticar, autorizar } = require("../middlewares/auth");
const TourController   = require("../controllers/tour.controller");
const ReviewController = require("../controllers/review.controller");

const router = express.Router();

const _upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => {
      const dir = path.join(__dirname, "../../uploads/tours");
      require("fs").mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  fileFilter: (_, file, cb) => cb(null, file.mimetype.startsWith("image/")),
  limits: { fileSize: 8 * 1024 * 1024 },
});
const uploadFotos = _upload.array("fotos", 10);

const soloAuth     = [autenticar];
const soloComercio = [autenticar, autorizar("COMERCIANTE")];
const soloAdmin    = [autenticar, autorizar("ADMIN")];

// ── PÚBLICO ──────────────────────────────────────────────────
router.get("/",               TourController.listar);
router.get("/disponibilidad", TourController.disponibilidad);

// Cupones (validar es público)
router.post(   "/cupones/validar",      TourController.validarCupon);
router.get(    "/mi-tour/cupones",      ...soloComercio, TourController.listarCupones);
router.post(   "/mi-tour/cupones",      ...soloComercio, TourController.crearCupon);
router.delete( "/mi-tour/cupones/:id",  ...soloComercio, TourController.eliminarCupon);

// Favoritos
router.get(  "/favoritos/mis",          ...soloAuth, TourController.misFavoritos);
router.post( "/favoritos/:id/toggle",   ...soloAuth, TourController.toggleFavorito);
router.get(  "/favoritos/:id",          ...soloAuth, TourController.esFavorito);

// Estadísticas
router.get(  "/mi-tour/estadisticas",   ...soloComercio, TourController.estadisticas);

router.get("/:id",            TourController.obtener);

// ── CLIENTE ──────────────────────────────────────────────────
router.post(  "/reservas",              ...soloAuth, TourController.reservar);
router.get(   "/reservas/mis",          ...soloAuth, TourController.misReservas);
router.patch( "/reservas/:id/cancelar", ...soloAuth, TourController.cancelarReserva);

// ── OPERADOR ─────────────────────────────────────────────────
router.get(  "/mi-tour/config",              ...soloComercio, TourController.miTour);
router.post( "/mi-tour/config/fotos",        ...soloComercio, uploadFotos, TourController.subirFotos);
router.put(  "/mi-tour/config",             ...soloComercio, TourController.actualizarTour);
router.get(  "/mi-tour/reservas",           ...soloComercio, TourController.reservasOperador);
router.patch("/mi-tour/reservas/:id/estado",...soloComercio, TourController.cambiarEstado);

// ── REVIEWS ──────────────────────────────────────────────────
router.get( "/:id/reviews",        ReviewController.reviewsTour);
router.post("/reservas/:id/review",...soloAuth, ReviewController.crearReviewTour);

// ── ADMIN ─────────────────────────────────────────────────────
router.get(  "/admin/todos",       ...soloAdmin, TourController.adminListar);
router.patch("/admin/:id/estado",  ...soloAdmin, TourController.adminCambiarEstado);

module.exports = router;
