// ============================================================
//  Rutas de Pagos — solo COMPRADOR
// ============================================================
const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const PagoController = require("../controllers/pago.controller");

const router = express.Router();

const soloCompradores = [autenticar, autorizar("COMPRADOR", "COMERCIANTE", "REPARTIDOR")];

// Webhooks de la pasarela (sin autenticacion de usuario; se valida por firma/proveedor)
router.post("/webhooks/:proveedor", PagoController.webhook);

// Crear checkout digital en pasarela
router.post("/checkout", ...soloCompradores, PagoController.crearCheckoutDigital);

// Consultar estado del pago digital
router.get("/pedido/:pedidoId/estado", ...soloCompradores, PagoController.estadoPorPedido);
router.get("/:id/estado", ...soloCompradores, PagoController.estadoPorPago);

// Crear un pago para un pedido
router.post("/", ...soloCompradores, PagoController.crear);

// Subir el comprobante de un pago (imagen, campo "comprobante")
router.post(
  "/:id/comprobante",
  ...soloCompradores,
  PagoController.uploadComprobante,
  PagoController.subirComprobante
);

// Obtener las instrucciones de pago de un pedido
router.get(
  "/instrucciones/:pedidoId",
  ...soloCompradores,
  PagoController.instrucciones
);

module.exports = router;
