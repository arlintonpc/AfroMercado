// ============================================================
//  Rutas de Administración — solo ADMIN
// ============================================================
const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const AdminController = require("../controllers/admin.controller");

const router = express.Router();

const soloAdmin = [autenticar, autorizar("ADMIN")];

// Pagos a la espera de verificación
router.get("/pagos/pendientes", ...soloAdmin, AdminController.pagosPendientes);

// Aprobar / rechazar un pago
router.patch("/pagos/:id/verificar", ...soloAdmin, AdminController.verificarPago);

// Ver el comprobante (imagen) de un pago
router.get("/pagos/:id/comprobante", ...soloAdmin, AdminController.comprobante);

// Métricas globales del marketplace
router.get("/estadisticas", ...soloAdmin, AdminController.estadisticas);

module.exports = router;
