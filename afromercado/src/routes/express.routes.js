const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const ExpressController = require("../controllers/express.controller");

const router = express.Router();

const soloAuth       = [autenticar];
const soloComercio   = [autenticar, autorizar("COMERCIANTE")];
const soloAdmin      = [autenticar, autorizar("ADMIN")];

// ── PÚBLICO ──────────────────────────────────────────────────
router.get("/comercios",                    ExpressController.comerciosExpress);
router.get("/festivos",                     ExpressController.festivosAnio);
router.get("/comercios/:comercioId/menu",   ExpressController.menuComercio);

// ── CLIENTE ──────────────────────────────────────────────────
router.post(  "/pedidos",     ...soloAuth, ExpressController.crearPedido);
router.get(   "/pedidos/mis", ...soloAuth, ExpressController.misPedidos);
router.get(   "/pedidos/:id", ...soloAuth, ExpressController.obtenerPedido);

// ── COMERCIO ─────────────────────────────────────────────────
router.get(   "/config",                                    ...soloComercio, ExpressController.obtenerConfig);
router.put(   "/config",                                    ...soloComercio, ExpressController.actualizarConfig);

// Secciones del menú
router.get(    "/config/secciones",                         ...soloComercio, ExpressController.listarSecciones);
router.post(   "/config/secciones",                         ...soloComercio, ExpressController.crearSeccion);
router.patch(  "/config/secciones/productos/:productoId",   ...soloComercio, ExpressController.asignarSeccionProducto);
router.patch(  "/config/secciones/:id",                     ...soloComercio, ExpressController.actualizarSeccion);
router.delete( "/config/secciones/:id",                     ...soloComercio, ExpressController.eliminarSeccion);

router.patch( "/config/abierto",                            ...soloComercio, ExpressController.toggleAbierto);
router.get(   "/mis-pedidos",               ...soloComercio, ExpressController.pedidosComercio);
router.post(  "/mis-pedidos/:id/aceptar",   ...soloComercio, ExpressController.aceptarPedido);
router.post(  "/mis-pedidos/:id/rechazar",  ...soloComercio, ExpressController.rechazarPedido);
router.post(  "/mis-pedidos/:id/avanzar",   ...soloComercio, ExpressController.avanzarEstado);

// ── ADMIN ────────────────────────────────────────────────────
router.get(  "/admin/deudas",                          ...soloAdmin, ExpressController.deudasAdmin);
router.post( "/admin/deudas/:comercioId/saldar",       ...soloAdmin, ExpressController.saldarDeudaAdmin);
router.put(  "/admin/deudas/:comercioId/limite",       ...soloAdmin, ExpressController.actualizarLimiteAdmin);

module.exports = router;
