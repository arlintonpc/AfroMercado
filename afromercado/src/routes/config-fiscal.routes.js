const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const ConfigFiscalController = require("../controllers/config-fiscal.controller");

const router = express.Router();
const soloAdmin = [autenticar, autorizar("ADMIN")];

// Activar/consultar IVA es exclusivo de ADMIN: es un cambio de obligación
// legal del comercio, no una preferencia que el comerciante deba autogestionar.
router.get("/admin/comercios/:comercioId/config-fiscal", ...soloAdmin, ConfigFiscalController.obtener);
router.patch("/admin/comercios/:comercioId/config-fiscal/activar", ...soloAdmin, ConfigFiscalController.activar);
router.patch("/admin/comercios/:comercioId/config-fiscal/desactivar", ...soloAdmin, ConfigFiscalController.desactivar);

module.exports = router;
