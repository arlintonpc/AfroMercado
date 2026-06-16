const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const OfertaController = require("../controllers/oferta.controller");

const router = express.Router();
const soloComerciante = [autenticar, autorizar("COMERCIANTE", "ADMIN")];

// Pública — sección "Mejores precios"
router.get("/activas", OfertaController.listarActivas);

// Comerciante — gestión propia
router.get("/mis-ofertas",     ...soloComerciante, OfertaController.misOfertas);
router.post("/",               ...soloComerciante, OfertaController.crear);
router.patch("/:id/desactivar",...soloComerciante, OfertaController.desactivar);

module.exports = router;
