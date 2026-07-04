// Rutas de Datos Abiertos — AfroMercado
// SIN middleware de autenticación: son genuinamente públicas (transparencia).
const express = require("express");
const router = express.Router();
const DatosAbiertosController = require("../controllers/datosabiertos.controller");

router.get("/", DatosAbiertosController.listarDatasets);
router.get("/municipios", DatosAbiertosController.municipios);
router.get("/departamentos", DatosAbiertosController.departamentos);

module.exports = router;
