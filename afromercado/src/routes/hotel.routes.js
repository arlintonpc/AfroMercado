const express = require("express");
const multer  = require("multer");
const path    = require("path");
const { autenticar, autorizar } = require("../middlewares/auth");
const { verificarModuloActivo } = require("../middlewares/moduloActivo");
const HotelController  = require("../controllers/hotel.controller");
const ReviewController = require("../controllers/review.controller");

const router = express.Router();
router.use(verificarModuloActivo("flag_modulo_hoteles"));

const soloAuth     = [autenticar];
const soloComercio = [autenticar, autorizar("COMERCIANTE")];
const soloAdmin    = [autenticar, autorizar("ADMIN")];

// Multer para fotos de habitaciones
const _uploadFotos = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => {
      const dir = path.join(__dirname, "../../uploads/hoteles");
      require("fs").mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  fileFilter: (_, file, cb) => cb(null, file.mimetype.startsWith("image/")),
  limits: { fileSize: 8 * 1024 * 1024 },
});
const uploadFotos = _uploadFotos.array("fotos", 10);

// ── PÚBLICO ──────────────────────────────────────────────────
router.get("/",                         HotelController.listar);
router.get("/disponibilidad",           HotelController.disponibilidad);

// Validación de cupón — auth opcional (clienteId puede ser null)
router.post("/cupones/validar", HotelController.validarCupon);

// ── CLIENTE ──────────────────────────────────────────────────
router.post(  "/reservas",                   ...soloAuth, HotelController.reservar);
router.post(  "/reservas/multiple",          ...soloAuth, HotelController.reservarMultiple);
router.get(   "/reservas/mis",               ...soloAuth, HotelController.misReservas);
router.patch( "/reservas/:id/cancelar",           ...soloAuth, HotelController.cancelarReserva);
router.get(   "/reservas/:id/politica-cancelacion", ...soloAuth, HotelController.politicaCancelacion);
router.post(  "/reservas/:id/checkout",      ...soloAuth, HotelController.iniciarPagoReserva);

// ── HOTELERO ─────────────────────────────────────────────────
router.get(  "/mi-hotel/config",                ...soloComercio, HotelController.miConfig);
router.put(  "/mi-hotel/config",                ...soloComercio, HotelController.actualizarConfig);
router.post( "/mi-hotel/habitaciones",          ...soloComercio, HotelController.agregarHabitacion);
router.post( "/mi-hotel/habitaciones/:id/fotos",  ...soloComercio, uploadFotos, HotelController.subirFotosHabitacion);
router.post(  "/mi-hotel/habitaciones/:id/video",      ...soloComercio, HotelController.uploadVideoHabitacion, HotelController.subirVideoHabitacion);
router.delete("/mi-hotel/habitaciones/:id/video",      ...soloComercio, HotelController.quitarVideoHabitacion);
router.patch( "/mi-hotel/habitaciones/:id/video-link", ...soloComercio, HotelController.guardarVideoLinkHabitacion);
router.put(  "/mi-hotel/habitaciones/:id",      ...soloComercio, HotelController.actualizarHabitacion);
router.delete("/mi-hotel/habitaciones/:id",     ...soloComercio, HotelController.eliminarHabitacion);
router.get(  "/mi-hotel/habitaciones-fisicas",  ...soloComercio, HotelController.habitacionesFisicas);
router.post( "/mi-hotel/habitaciones-fisicas",  ...soloComercio, HotelController.crearHabitacionFisica);
router.put(  "/mi-hotel/habitaciones-fisicas/:id", ...soloComercio, HotelController.actualizarHabitacionFisica);
router.patch("/mi-hotel/habitaciones-fisicas/:id/estado", ...soloComercio, HotelController.cambiarEstadoHabitacionFisica);
router.delete("/mi-hotel/habitaciones-fisicas/:id", ...soloComercio, HotelController.eliminarHabitacionFisica);
router.get(  "/mi-hotel/reservas",              ...soloComercio, HotelController.reservasHotelero);
router.patch("/mi-hotel/reservas/:id/estado",   ...soloComercio, HotelController.cambiarEstado);
router.patch("/mi-hotel/reservas/:id/habitacion-fisica", ...soloComercio, HotelController.asignarHabitacionFisicaReserva);
router.get(  "/mi-hotel/ocupacion",             ...soloComercio, HotelController.ocupacion);
router.get(   "/mi-hotel/bloqueos",             ...soloComercio, HotelController.listarBloqueos);
router.post(  "/mi-hotel/bloqueos",             ...soloComercio, HotelController.crearBloqueo);
router.delete("/mi-hotel/bloqueos/:bloqueoId",  ...soloComercio, HotelController.eliminarBloqueo);

// Cupones del hotel
router.get(   "/mi-hotel/cupones",      ...soloComercio, HotelController.listarCupones);
router.post(  "/mi-hotel/cupones",      ...soloComercio, HotelController.crearCupon);
router.delete("/mi-hotel/cupones/:id",  ...soloComercio, HotelController.eliminarCupon);

// Temporadas (precios por temporada)
router.get(   "/mi-hotel/temporadas",     ...soloComercio, HotelController.listarTemporadas);
router.post(  "/mi-hotel/temporadas",     ...soloComercio, HotelController.crearTemporada);
router.delete("/mi-hotel/temporadas/:id", ...soloComercio, HotelController.eliminarTemporada);

// Estadísticas del hotelero
router.get("/mi-hotel/estadisticas", ...soloComercio, HotelController.estadisticas);

// Favoritos — auth cliente (mis debe ir ANTES de :id para evitar ambigüedad)
router.get ("/favoritos/mis",         ...soloAuth, HotelController.misFavoritos);
router.post("/favoritos/:id/toggle",  ...soloAuth, HotelController.toggleFavorito);
router.get ("/favoritos/:id",         ...soloAuth, HotelController.esFavorito);

// ── CHECK-IN ONLINE ───────────────────────────────────────────
// Cliente genera su token (requiere auth)
router.post("/reservas/:id/checkin-token", ...soloAuth, HotelController.solicitarTokenCheckin);

// Formulario público de check-in (el token actúa como credencial)
router.get( "/checkin/:token", HotelController.verCheckinPublico);
router.post("/checkin/:token", HotelController.realizarCheckin);

// ── DETALLE PÚBLICO — va al final para no capturar rutas específicas ──
router.get("/:id",                      HotelController.obtener);

// ── REVIEWS ──────────────────────────────────────────────────
router.get( "/:id/reviews",        ReviewController.reviewsHotel);
router.post("/reservas/:id/review",...soloAuth, ReviewController.crearReviewHotel);

// ── ADMIN ─────────────────────────────────────────────────────
router.get(   "/admin/todos",         ...soloAdmin, HotelController.adminListar);
router.patch( "/admin/:id/estado",    ...soloAdmin, HotelController.adminCambiarEstado);
router.get(   "/admin/:id/reservas",  ...soloAdmin, HotelController.adminReservas);
router.patch( "/admin/:id/rnt",       ...soloAdmin, HotelController.adminVerificarRnt);

module.exports = router;
