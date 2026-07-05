const express = require("express");
const { autenticar } = require("../middlewares/auth");
const FidelizacionController = require("../controllers/fidelizacion.controller");

const router = express.Router();

router.get("/fidelizacion/mi-perfil", autenticar, FidelizacionController.miPerfil);
router.get("/fidelizacion/movimientos", autenticar, FidelizacionController.misMovimientos);
router.post("/fidelizacion/canjear", autenticar, FidelizacionController.canjear);

module.exports = router;
