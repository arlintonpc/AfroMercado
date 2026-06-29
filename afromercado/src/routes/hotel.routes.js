const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const HotelController = require("../controllers/hotel.controller");

const router = express.Router();

const soloAuth     = [autenticar];
const soloComercio = [autenticar, autorizar("COMERCIANTE")];

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
router.put(  "/mi-hotel/habitaciones/:id",      ...soloComercio, HotelController.actualizarHabitacion);
router.delete("/mi-hotel/habitaciones/:id",     ...soloComercio, HotelController.eliminarHabitacion);
router.get(  "/mi-hotel/reservas",              ...soloComercio, HotelController.reservasHotelero);
router.patch("/mi-hotel/reservas/:id/estado",   ...soloComercio, HotelController.cambiarEstado);
router.get(  "/mi-hotel/ocupacion",             ...soloComercio, HotelController.ocupacion);

module.exports = router;
