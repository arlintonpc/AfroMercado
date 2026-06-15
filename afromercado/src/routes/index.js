// Enrutador principal — agrupa todas las rutas de la API
const express = require("express");
const authRoutes = require("./auth.routes");
const productoRoutes = require("./producto.routes");
const comercioRoutes = require("./comercio.routes");
const carritoRoutes = require("./carrito.routes");
const pedidoRoutes = require("./pedido.routes");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ ok: true, mensaje: "API de AfroMercado 🌿", version: "1.0.0-mvp" });
});

router.use("/auth", authRoutes);
router.use("/productos", productoRoutes);
router.use("/comercios", comercioRoutes);
router.use("/carrito", carritoRoutes);
router.use("/pedidos", pedidoRoutes);
router.use("/categorias", require("./categorias.routes"));
router.use("/pagos", require("./pago.routes"));
router.use("/admin", require("./admin.routes"));
// Aquí se irán sumando: /entregas

module.exports = router;
