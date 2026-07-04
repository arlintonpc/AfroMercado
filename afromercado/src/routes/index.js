// Enrutador principal — agrupa todas las rutas de la API
const express = require("express");
const packageJson = require("../../package.json");
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
  const commit =
    process.env.RENDER_GIT_COMMIT ||
    process.env.GIT_COMMIT ||
    process.env.COMMIT_SHA ||
    null;

  res.json({
    ok: true,
    mensaje: "API de AfroMercado",
    version: process.env.APP_VERSION || packageJson.version,
    commit: commit ? commit.slice(0, 7) : null,
  });
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
router.use("/cupones", require("./cupon.routes"));
router.use("/chat", require("./chat.routes"));
router.use("/repartidor", require("./repartidor.routes"));
router.use("/envios",        require("./envio.routes"));
router.use("/reportes",      require("./reporte.routes"));
router.use("/push",          require("./push.routes"));
router.use("/liquidaciones", require("./liquidacion.routes"));
router.use("/publicidad",    require("./publicidad.routes"));
router.use("/express",       require("./express.routes"));
router.use("/hoteles",       require("./hotel.routes"));
router.use("/tours",         require("./tour.routes"));
router.use("/transportes",   require("./transporte.routes"));
router.use("/cultura",       require("./cultura.routes"));
router.use("/busqueda",      require("./busqueda.routes"));
router.use("/alianzas",      require("./alianza.routes"));
router.use("/datos-abiertos", require("./datosabiertos.routes"));
router.use("/directorio-compras-publicas", require("./directorio.routes"));

module.exports = router;
