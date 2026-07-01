// ============================================================
//  Rutas de Administración — solo ADMIN
// ============================================================
const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const AdminController = require("../controllers/admin.controller");
const VisibilidadController = require("../controllers/visibilidad.controller");
const PublicidadController = require("../controllers/publicidad.controller");

const router = express.Router();

const soloAdmin = [autenticar, autorizar("ADMIN")];

// Pagos a la espera de verificación
router.get("/pagos/pendientes", ...soloAdmin, AdminController.pagosPendientes);

// Configuracion de pasarela y pagos digitales
router.get("/pagos/configuracion", ...soloAdmin, AdminController.obtenerConfiguracionPagos);
router.put("/pagos/configuracion", ...soloAdmin, AdminController.actualizarConfiguracionPagos);
router.post("/pagos/configuracion/probar", ...soloAdmin, AdminController.probarConfiguracionPagos);

// Aprobar / rechazar un pago
router.patch("/pagos/:id/verificar", ...soloAdmin, AdminController.verificarPago);

// Ver el comprobante (imagen) de un pago
router.get("/pagos/:id/comprobante", ...soloAdmin, AdminController.comprobante);

// Métricas globales del marketplace
router.get("/estadisticas", ...soloAdmin, AdminController.estadisticas);

// WhatsApp
router.get("/whatsapp/estado", ...soloAdmin, AdminController.estadoWhatsApp);
router.post("/whatsapp/conectar", ...soloAdmin, AdminController.conectarWhatsApp);

// Búsqueda de comercios, productos y usuarios (para formularios admin)
router.get("/comercios/buscar", ...soloAdmin, AdminController.buscarComercios);
router.get("/productos/buscar", ...soloAdmin, AdminController.buscarProductos);
router.get("/usuarios/buscar",  ...soloAdmin, AdminController.buscarUsuarios);

// Gestión de productos del marketplace
router.get("/productos",                   ...soloAdmin, AdminController.listarProductosAdmin);
router.patch("/productos/:id/activo",      ...soloAdmin, AdminController.toggleActivoProducto);

// Moderación de reviews
router.get("/reviews",        ...soloAdmin, AdminController.listarReviews);
router.delete("/reviews/:id", ...soloAdmin, AdminController.eliminarReview);

// Visibilidad pagada (publicidad)
router.post("/visibilidad", ...soloAdmin, VisibilidadController.crear);
router.get("/visibilidad", ...soloAdmin, VisibilidadController.listarTodas);
router.patch("/visibilidad/:id/desactivar", ...soloAdmin, VisibilidadController.desactivar);

// AfroMedia: solicitudes y resumen publicitario
router.get("/publicidad/resumen", ...soloAdmin, PublicidadController.resumenAdmin);
router.get("/publicidad/analitica", ...soloAdmin, PublicidadController.analiticaAdmin);
router.get("/publicidad/tendencias", ...soloAdmin, PublicidadController.tendenciasAdmin);
router.get("/publicidad/inventario", ...soloAdmin, PublicidadController.inventarioAdmin);
router.put("/publicidad/inventario/:tipo", ...soloAdmin, PublicidadController.actualizarInventarioAdmin);
router.get("/publicidad/exportar", ...soloAdmin, PublicidadController.exportarAdmin);
router.get("/publicidad/paquetes", ...soloAdmin, PublicidadController.listarPaquetesAdmin);
router.put("/publicidad/paquetes/:codigo", ...soloAdmin, PublicidadController.actualizarPaqueteAdmin);
router.get("/publicidad/solicitudes", ...soloAdmin, PublicidadController.listarAdmin);
router.patch("/publicidad/solicitudes/:id", ...soloAdmin, PublicidadController.revisarAdmin);
router.patch("/publicidad/solicitudes/:id/pago", ...soloAdmin, PublicidadController.actualizarPagoAdmin);
router.post("/publicidad/solicitudes/:id/convertir", ...soloAdmin, PublicidadController.convertirAdmin);
router.patch("/publicidad/solicitudes/:id/video", ...soloAdmin, PublicidadController.revisarVideoAdmin);
router.get("/publicidad/auditoria", ...soloAdmin, PublicidadController.auditoriaAdmin);

// Email
router.get("/email/estado", ...soloAdmin, AdminController.estadoEmail);
router.put("/email/smtp", ...soloAdmin, AdminController.guardarConfigSmtp);
router.put("/email/config", ...soloAdmin, AdminController.actualizarConfigEmail);
router.post("/email/test", ...soloAdmin, AdminController.enviarEmailTest);

// Gestión de comerciantes
router.get("/comercios",                        ...soloAdmin, AdminController.listarComercios);
router.patch("/comercios/:id/verificar",        ...soloAdmin, AdminController.verificarComerciante);
router.patch("/comercios/:id/whatsapp-visible", ...soloAdmin, AdminController.toggleWhatsappVisible);
router.post("/comercios/:id/comision",          ...soloAdmin, AdminController.setComisionComercio);

// Panel de administración — dashboard y gestión avanzada
router.get("/dashboard",                    ...soloAdmin, AdminController.dashboard);
router.get("/comercios/:id/detalle",        ...soloAdmin, AdminController.detalleComercio);
router.patch("/comercios/:id/estado",       ...soloAdmin, AdminController.cambiarEstadoComercio);
router.patch("/usuarios/:id/rol",           ...soloAdmin, AdminController.cambiarRol);
router.delete("/categorias/:id",            ...soloAdmin, AdminController.eliminarCategoria);
router.patch("/productos/:id/destacado",    ...soloAdmin, AdminController.destacarProducto);

// Mantenimiento puntual
router.post("/backfill-pesos", ...soloAdmin, AdminController.backfillPesos);

// Marca: subir el logo de la plataforma
router.post("/logo", ...soloAdmin, AdminController.uploadLogo, AdminController.subirLogo);

// Config global
router.get("/config",        ...soloAdmin, AdminController.listarConfig);
router.get("/reglas",        ...soloAdmin, AdminController.listarReglas);
router.put("/config/:clave", ...soloAdmin, AdminController.actualizarConfig);

// Gestión de repartidores
router.get("/repartidores", ...soloAdmin, AdminController.listarRepartidores);
router.post("/repartidores", ...soloAdmin, AdminController.crearRepartidor);

// Solicitudes para ser repartidor
router.get("/solicitudes-repartidor", ...soloAdmin, AdminController.listarSolicitudesRepartidor);
router.patch("/solicitudes-repartidor/:id/revisar", ...soloAdmin, AdminController.revisarSolicitudRepartidor);

// Gestión de usuarios
router.get("/usuarios", ...soloAdmin, AdminController.listarUsuarios);
router.patch("/usuarios/:id/activo", ...soloAdmin, AdminController.toggleActivoUsuario);

// Categorías
router.get("/categorias",                ...soloAdmin, AdminController.listarCategorias);
router.post("/categorias",               ...soloAdmin, AdminController.crearCategoria);
router.patch("/categorias/:id",          ...soloAdmin, AdminController.actualizarCategoria);
router.patch("/categorias/:id/activo",   ...soloAdmin, AdminController.toggleActivoCategoria);

// Pedidos (vista admin)
router.get("/pedidos",     ...soloAdmin, AdminController.listarPedidos);
router.get("/pedidos/:id", ...soloAdmin, AdminController.obtenerPedidoAdmin);

module.exports = router;
