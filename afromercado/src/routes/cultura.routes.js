const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const CulturaController = require("../controllers/cultura.controller");

const router = express.Router();

const soloAuth     = [autenticar];
const soloComercio = [autenticar, autorizar("COMERCIANTE")];
const soloAdmin    = [autenticar, autorizar("ADMIN")];

// ── PÚBLICO ──────────────────────────────────────────────────
router.get("/", CulturaController.listarAgenda);

// ── ORGANIZADOR (comercio) ───────────────────────────────────
router.get(   "/mis-eventos",              ...soloComercio, CulturaController.misEventos);
router.post(  "/mis-eventos",              ...soloComercio, CulturaController.crearEvento);
router.get(   "/mis-eventos/reservas",     ...soloComercio, CulturaController.reservasOrganizador);
router.patch( "/mis-eventos/:id",          ...soloComercio, CulturaController.actualizarEvento);
router.post(  "/mis-eventos/:id/entradas", ...soloComercio, CulturaController.crearEntrada);
router.patch( "/entradas/:id",             ...soloComercio, CulturaController.actualizarEntrada);
router.delete("/entradas/:id",             ...soloComercio, CulturaController.eliminarEntrada);

// ── CLIENTE ──────────────────────────────────────────────────
router.post( "/reservas",              ...soloAuth, CulturaController.reservar);
router.get(  "/reservas/mis",          ...soloAuth, CulturaController.misReservas);
router.patch("/reservas/:id/cancelar", ...soloAuth, CulturaController.cancelarReserva);

// ── ADMIN ─────────────────────────────────────────────────────
router.get(  "/admin/todos",      ...soloAdmin, CulturaController.adminListar);
router.post( "/admin/eventos",    ...soloAdmin, CulturaController.adminCrearEvento);
router.patch("/admin/:id/estado", ...soloAdmin, CulturaController.adminCambiarEstado);

// Detalle público del evento — al final para no capturar rutas específicas
router.get("/:id", CulturaController.obtener);

module.exports = router;
