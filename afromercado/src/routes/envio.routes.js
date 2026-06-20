const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const EnvioController = require("../controllers/envio.controller");

const router = express.Router();

router.get("/calcular", EnvioController.calcular);
router.get("/tarifas", EnvioController.listarTarifas);
router.post("/tarifas", autenticar, autorizar("ADMIN"), EnvioController.upsertTarifa);
router.patch("/tarifas/:id/desactivar", autenticar, autorizar("ADMIN"), EnvioController.desactivarTarifa);

module.exports = router;
