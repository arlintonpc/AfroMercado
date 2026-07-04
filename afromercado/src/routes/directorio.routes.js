// ============================================================
//  Rutas del Directorio de proveedores certificados (Módulo C)
//  Público, sin middleware de autenticación.
// ============================================================
const express = require("express");
const DirectorioController = require("../controllers/directorio.controller");

const router = express.Router();

router.get("/", DirectorioController.listar);

module.exports = router;
