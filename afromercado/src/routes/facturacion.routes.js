const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const FacturacionController = require("../controllers/facturacion.controller");

const router = express.Router();
const soloAdmin = [autenticar, autorizar("ADMIN")];

router.get("/facturas/:moduloOrigen/:referenciaId", autenticar, FacturacionController.consultar);

router.get("/admin/facturas", ...soloAdmin, FacturacionController.listarAdmin);
router.post("/admin/facturas/reintentar", ...soloAdmin, FacturacionController.reintentarAdmin);
router.patch("/admin/facturas/:id/anular", ...soloAdmin, FacturacionController.anularAdmin);

module.exports = router;
