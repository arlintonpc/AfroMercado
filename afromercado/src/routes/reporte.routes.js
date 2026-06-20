// Rutas de reportería — AfroMercado
const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const ReporteController = require("../controllers/reporte.controller");

const router = express.Router();

const soloComercio = [autenticar, autorizar("COMERCIANTE", "ADMIN")];
const soloAdmin    = [autenticar, autorizar("ADMIN")];

// ─── Comerciante ─────────────────────────────────────────────────────────────
// GET /reportes/comercio/resumen
router.get("/comercio/resumen",   ...soloComercio, ReporteController.resumenComercio);
// GET /reportes/comercio/ventas
router.get("/comercio/ventas",    ...soloComercio, ReporteController.ventasComercio);
// GET /reportes/comercio/productos
router.get("/comercio/productos", ...soloComercio, ReporteController.productosComercio);
// GET /reportes/comercio/resenas
router.get("/comercio/resenas",   ...soloComercio, ReporteController.resenasComercio);
// GET /reportes/comercio/serie
router.get("/comercio/serie",     ...soloComercio, ReporteController.serieComercio);
// GET /reportes/comercio/exportar  → descarga .xlsx
router.get("/comercio/exportar",  ...soloComercio, ReporteController.exportarVentasComercio);

// ─── Admin ────────────────────────────────────────────────────────────────────
// GET /reportes/admin/dashboard
router.get("/admin/dashboard",    ...soloAdmin, ReporteController.dashboardAdmin);
// GET /reportes/admin/serie
router.get("/admin/serie",        ...soloAdmin, ReporteController.serieAdmin);
// GET /reportes/admin/municipios
router.get("/admin/municipios",   ...soloAdmin, ReporteController.municipiosAdmin);
// GET /reportes/admin/comercios
router.get("/admin/comercios",    ...soloAdmin, ReporteController.rankingAdmin);
// GET /reportes/admin/riesgo
router.get("/admin/riesgo",       ...soloAdmin, ReporteController.riesgoAdmin);
// GET /reportes/admin/cohortes
router.get("/admin/cohortes",     ...soloAdmin, ReporteController.cohortesAdmin);
// GET /reportes/admin/cupones-roi
router.get("/admin/cupones-roi",  ...soloAdmin, ReporteController.cuponesROIAdmin);
// GET /reportes/admin/exportar  → descarga .xlsx
router.get("/admin/exportar",     ...soloAdmin, ReporteController.exportarAdmin);

module.exports = router;
