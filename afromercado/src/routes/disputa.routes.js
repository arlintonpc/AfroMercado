const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const DisputaController = require("../controllers/disputa.controller");

const router = express.Router();
const soloAdmin = [autenticar, autorizar("ADMIN")];

router.post("/disputas", autenticar, autorizar("COMPRADOR", "COMERCIANTE", "ADMIN"), DisputaController.crear);
router.get("/disputas/mias", autenticar, DisputaController.misDisputas);
router.get("/disputas/comercio", autenticar, autorizar("COMERCIANTE", "ADMIN"), DisputaController.disputasComercio);
router.get("/disputas/:id", autenticar, DisputaController.obtenerDetalle);
router.post("/disputas/:id/responder", autenticar, autorizar("COMERCIANTE", "ADMIN"), DisputaController.responder);

router.get("/admin/disputas", ...soloAdmin, DisputaController.listarAdmin);
router.patch("/admin/disputas/:id/resolver", ...soloAdmin, DisputaController.resolverAdmin);
router.patch("/admin/disputas/:id/marcar-transferido", ...soloAdmin, DisputaController.marcarTransferidoAdmin);

module.exports = router;
