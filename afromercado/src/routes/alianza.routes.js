// ============================================================
//  Rutas de Alianzas comerciales — cupón compartido entre
//  comercios de distintos módulos (Express, Hotel, Tour,
//  Transporte, Pedido).
// ============================================================
const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const AlianzaController = require("../controllers/alianza.controller");

const router = express.Router();

const soloComercio = [autenticar, autorizar("COMERCIANTE")];

// ── COMERCIO ─────────────────────────────────────────────────
// "/mias" va antes de "/:id/..." y "/codigo/:codigo" para no ambigüedad de rutas.
router.get(   "/mias",             ...soloComercio, AlianzaController.misAlianzas);
router.post(  "/",                 ...soloComercio, AlianzaController.crear);
router.post(  "/:id/socios",       ...soloComercio, AlianzaController.invitarSocio);
router.patch( "/:id/socios/mio",   ...soloComercio, AlianzaController.aceptarInvitacion);
router.delete("/:id/socios/mio",   ...soloComercio, AlianzaController.rechazarOSalir);

// ── PÚBLICO ──────────────────────────────────────────────────
// Página de descubrimiento — al final para no capturar las rutas anteriores.
router.get("/region",         AlianzaController.listarPorRegion);
router.get("/codigo/:codigo", AlianzaController.obtenerPorCodigo);

module.exports = router;
