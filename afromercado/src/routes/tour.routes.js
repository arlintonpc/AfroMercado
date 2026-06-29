const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const TourController = require("../controllers/tour.controller");

const router = express.Router();

const soloAuth     = [autenticar];
const soloComercio = [autenticar, autorizar("COMERCIANTE")];
const soloAdmin    = [autenticar, autorizar("ADMIN")];

// ── PÚBLICO ──────────────────────────────────────────────────
router.get("/",               TourController.listar);
router.get("/disponibilidad", TourController.disponibilidad);
router.get("/:id",            TourController.obtener);

// ── CLIENTE ──────────────────────────────────────────────────
router.post(  "/reservas",              ...soloAuth, TourController.reservar);
router.get(   "/reservas/mis",          ...soloAuth, TourController.misReservas);
router.patch( "/reservas/:id/cancelar", ...soloAuth, TourController.cancelarReserva);

// ── OPERADOR ─────────────────────────────────────────────────
router.get(  "/mi-tour/config",             ...soloComercio, TourController.miTour);
router.put(  "/mi-tour/config",             ...soloComercio, TourController.actualizarTour);
router.get(  "/mi-tour/reservas",           ...soloComercio, TourController.reservasOperador);
router.patch("/mi-tour/reservas/:id/estado",...soloComercio, TourController.cambiarEstado);

// ── ADMIN ─────────────────────────────────────────────────────
router.get(  "/admin/todos",       ...soloAdmin, TourController.adminListar);
router.patch("/admin/:id/estado",  ...soloAdmin, TourController.adminCambiarEstado);

module.exports = router;
