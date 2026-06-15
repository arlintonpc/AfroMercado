// ============================================================
//  Rutas de Pedidos — solo COMPRADOR
// ============================================================
const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const PedidoController = require("../controllers/pedido.controller");

const router = express.Router();

const soloCompradores = [autenticar, autorizar("COMPRADOR")];

router.post("/checkout", ...soloCompradores, PedidoController.checkout);
router.get("/", ...soloCompradores, PedidoController.listar);
router.get("/:id", ...soloCompradores, PedidoController.detalle);
router.post("/:id/cancelar", ...soloCompradores, PedidoController.cancelar);

module.exports = router;
