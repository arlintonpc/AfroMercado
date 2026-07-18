// ============================================================
//  Rutas del Directorio empresarial general (ciudadano, no B2G)
//  Público, sin middleware de autenticación.
// ============================================================
const express = require("express");
const DirectorioGeneralController = require("../controllers/directorio-general.controller");

const router = express.Router();

router.get("/", DirectorioGeneralController.listar);
router.get("/:id", DirectorioGeneralController.detalle);

module.exports = router;
