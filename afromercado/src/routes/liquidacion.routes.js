const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const LiquidacionController = require("../controllers/liquidacion.controller");

const router = express.Router();
const soloAdmin = [autenticar, autorizar("ADMIN")];

router.get("/admin/liquidaciones",              ...soloAdmin, LiquidacionController.listar);
router.get("/admin/liquidaciones/resumen",      ...soloAdmin, LiquidacionController.resumen);
router.post("/admin/liquidaciones",             ...soloAdmin, LiquidacionController.crear);
router.patch("/admin/liquidaciones/:id/pagar",  ...soloAdmin, LiquidacionController.marcarPagada);
router.patch("/admin/liquidaciones/:id/cancelar", ...soloAdmin, LiquidacionController.cancelar);

router.get("/mis-liquidaciones", autenticar, autorizar("COMERCIANTE", "REPARTIDOR"), LiquidacionController.misLiquidaciones);

module.exports = router;
