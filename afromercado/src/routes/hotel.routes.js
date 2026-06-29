const express = require("express");
const multer  = require("multer");
const path    = require("path");
const { autenticar, autorizar } = require("../middlewares/auth");
const HotelController = require("../controllers/hotel.controller");

const router = express.Router();

const soloAuth     = [autenticar];
const soloComercio = [autenticar, autorizar("COMERCIANTE")];

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
router.get("/:id",                      HotelController.obtener);

// ── CLIENTE ──────────────────────────────────────────────────
router.post(  "/reservas",              ...soloAuth, HotelController.reservar);
router.get(   "/reservas/mis",          ...soloAuth, HotelController.misReservas);
router.patch( "/reservas/:id/cancelar", ...soloAuth, HotelController.cancelarReserva);

// ── HOTELERO ─────────────────────────────────────────────────
router.get(  "/mi-hotel/config",                ...soloComercio, HotelController.miConfig);
router.put(  "/mi-hotel/config",                ...soloComercio, HotelController.actualizarConfig);
router.post( "/mi-hotel/habitaciones",          ...soloComercio, HotelController.agregarHabitacion);
router.post( "/mi-hotel/habitaciones/:id/fotos", ...soloComercio, uploadFotos, HotelController.subirFotosHabitacion);
router.put(  "/mi-hotel/habitaciones/:id",      ...soloComercio, HotelController.actualizarHabitacion);
router.delete("/mi-hotel/habitaciones/:id",     ...soloComercio, HotelController.eliminarHabitacion);
router.get(  "/mi-hotel/reservas",              ...soloComercio, HotelController.reservasHotelero);
router.patch("/mi-hotel/reservas/:id/estado",   ...soloComercio, HotelController.cambiarEstado);
router.get(  "/mi-hotel/ocupacion",             ...soloComercio, HotelController.ocupacion);

module.exports = router;
