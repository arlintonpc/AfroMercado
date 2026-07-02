const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const ExpressController = require("../controllers/express.controller");
const ReviewController  = require("../controllers/review.controller");

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

// Cupones Express (validar es público con auth opcional)
router.post(   "/cupones/validar",      ExpressController.validarCupon);
router.get(    "/mis-cupones",          ...soloComercio, ExpressController.listarCupones);
router.post(   "/mis-cupones",          ...soloComercio, ExpressController.crearCupon);
router.delete( "/mis-cupones/:id",      ...soloComercio, ExpressController.eliminarCupon);

// Estadísticas del comerciante
router.get(    "/mis-estadisticas",     ...soloComercio, ExpressController.estadisticas);

// Video Express
router.post(  "/config/video",      ...soloComercio, ExpressController.uploadVideoExpress, ExpressController.subirVideoExpress);
router.delete("/config/video",      ...soloComercio, ExpressController.quitarVideoExpress);
router.patch( "/config/video-link", ...soloComercio, ExpressController.guardarVideoLinkExpress);

// Complementos (add-ons) por producto
router.get(   "/complementos/:productoId/biblioteca",           ...soloComercio, ExpressController.listarBibliotecaComplementos);
router.post(  "/complementos/biblioteca/grupos",                ...soloComercio, ExpressController.crearGrupoBiblioteca);
router.patch( "/complementos/biblioteca/grupos/:grupoId",       ...soloComercio, ExpressController.actualizarGrupoBiblioteca);
router.delete("/complementos/biblioteca/grupos/:grupoId",       ...soloComercio, ExpressController.eliminarGrupoBiblioteca);
router.post(  "/complementos/biblioteca/grupos/:grupoId/items", ...soloComercio, ExpressController.crearItemBiblioteca);
router.patch( "/complementos/biblioteca/items/:itemId",         ...soloComercio, ExpressController.actualizarItemBiblioteca);
router.delete("/complementos/biblioteca/items/:itemId",         ...soloComercio, ExpressController.eliminarItemBiblioteca);
router.post(  "/complementos/:productoId/biblioteca/:grupoId",  ...soloComercio, ExpressController.vincularGrupoBibliotecaProducto);
router.delete("/complementos/:productoId/biblioteca/:grupoId",  ...soloComercio, ExpressController.desvincularGrupoBibliotecaProducto);
router.get(   "/complementos/:productoId",              ...soloComercio, ExpressController.listarComplementos);
router.post(  "/complementos/:productoId/grupos",       ...soloComercio, ExpressController.crearGrupoComplemento);
router.patch( "/complementos/grupos/:id",               ...soloComercio, ExpressController.actualizarGrupoComplemento);
router.delete("/complementos/grupos/:id",               ...soloComercio, ExpressController.eliminarGrupoComplemento);
router.post(  "/complementos/grupos/:grupoId/items",    ...soloComercio, ExpressController.crearItemComplemento);
router.patch( "/complementos/items/:id",                ...soloComercio, ExpressController.actualizarItemComplemento);
router.delete("/complementos/items/:id",                ...soloComercio, ExpressController.eliminarItemComplemento);
router.post(  "/complementos/items/:itemId/imagen",     ...soloComercio, ExpressController.uploadItemComplementoImagen, ExpressController.subirImagenItemComplemento);
router.post(  "/complementos/:grupoId/copiar-a-todos",  ...soloComercio, ExpressController.copiarGrupoATodos);

// ── REVIEWS ──────────────────────────────────────────────────
router.get( "/comercios/:id/reviews",        ReviewController.reviewsExpress);
router.post("/pedidos/:id/review", ...soloAuth, ReviewController.crearReviewExpress);

// ── ADMIN ────────────────────────────────────────────────────
router.get(  "/admin/deudas",                          ...soloAdmin, ExpressController.deudasAdmin);
router.post( "/admin/deudas/:comercioId/saldar",       ...soloAdmin, ExpressController.saldarDeudaAdmin);
router.put(  "/admin/deudas/:comercioId/limite",       ...soloAdmin, ExpressController.actualizarLimiteAdmin);

module.exports = router;
