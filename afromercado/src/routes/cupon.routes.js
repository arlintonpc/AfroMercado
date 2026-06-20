const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const CuponController = require("../controllers/cupon.controller");

const router = express.Router();
const soloAdmin = [autenticar, autorizar("ADMIN")];

// Uso público (compradores)
router.post("/validar", autenticar, CuponController.validar);

// Selector de comercios para el formulario de creación
router.get("/comercios", ...soloAdmin, CuponController.listarComerciosSelector);

// Dashboard / reportes globales
router.get("/reporte/resumen",     ...soloAdmin, CuponController.resumenGlobal);
router.get("/reporte/lista",       ...soloAdmin, CuponController.listaComparativa);
router.get("/usos",                ...soloAdmin, CuponController.logUsos);
router.get("/alertas",             ...soloAdmin, CuponController.alertasGlobal);
router.get("/auditoria/integridad",...soloAdmin, CuponController.integridadDatos);

// CRUD admin
router.post("/",   ...soloAdmin, CuponController.crear);
router.get("/",    ...soloAdmin, CuponController.listar);
router.delete("/:id", ...soloAdmin, CuponController.desactivar);

// Detalle de un cupón específico
router.get("/:id/metricas",    ...soloAdmin, CuponController.metricas);
router.get("/:id/usos",        ...soloAdmin, CuponController.usosPorCupon);
router.get("/:id/serie",       ...soloAdmin, CuponController.serie);
router.get("/:id/por-comercio",...soloAdmin, CuponController.porComercio);
router.get("/:id/por-usuario", ...soloAdmin, CuponController.porUsuario);

module.exports = router;
