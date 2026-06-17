// Enrutador principal — agrupa todas las rutas de la API
const express = require("express");
const authRoutes = require("./auth.routes");
const usuarioRoutes = require("./usuario.routes");
const productoRoutes = require("./producto.routes");
const comercioRoutes = require("./comercio.routes");
const carritoRoutes = require("./carrito.routes");
const pedidoRoutes = require("./pedido.routes");
const direccionRoutes = require("./direccion.routes");
const reviewRoutes = require("./review.routes");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ ok: true, mensaje: "API de AfroMercado 🌿", version: "1.0.0-mvp" });
});

router.use("/auth", authRoutes);
router.use("/usuario", usuarioRoutes);
router.use("/productos", productoRoutes);
router.use("/comercios", comercioRoutes);
router.use("/carrito", carritoRoutes);
router.use("/pedidos", pedidoRoutes);
router.use("/direcciones", direccionRoutes);
router.use("/reviews", reviewRoutes);
router.use("/categorias", require("./categorias.routes"));
router.use("/pagos", require("./pago.routes"));
router.use("/admin", require("./admin.routes"));
router.use("/config", require("./config.routes"));
router.use("/campanas", require("./campana.routes"));
router.use("/ofertas",  require("./oferta.routes"));
router.use("/upload",  require("./upload.routes"));
router.use("/notificaciones", require("./notificacion.routes"));
router.use("/favoritos", require("./favorito.routes"));

module.exports = router;
