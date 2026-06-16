// Rutas de Productos
const express = require("express");
const ProductoController = require("../controllers/producto.controller");
const { autenticar, autorizar } = require("../middlewares/auth");

const router = express.Router();

const ReviewController = require("../controllers/review.controller");
const VisibilidadController = require("../controllers/visibilidad.controller");

// Rutas públicas (cualquiera puede ver el catálogo)
router.get("/destacados", VisibilidadController.listarActivas);
router.get("/", ProductoController.listar);
router.get("/:id", ProductoController.obtener);
// Registra 1 vista orgánica en VistaProducto (con dedup sesionId 4h)
router.post("/:id/vista", ProductoController.registrarVista);
router.get("/:id/reviews", ReviewController.listar);

// Rutas protegidas — solo COMERCIANTE o ADMIN
router.post("/", autenticar, autorizar("COMERCIANTE", "ADMIN"), ProductoController.crear);
router.get("/mis/productos", autenticar, autorizar("COMERCIANTE", "ADMIN"), ProductoController.misProductos);
router.patch("/:id", autenticar, autorizar("COMERCIANTE", "ADMIN"), ProductoController.actualizar);
router.delete("/:id", autenticar, autorizar("COMERCIANTE", "ADMIN"), ProductoController.desactivar);

// Imágenes del producto — solo COMERCIANTE/ADMIN (dueño)
router.post(
  "/:id/imagenes",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ProductoController.uploadImagenes,
  ProductoController.subirImagenes
);
router.delete("/:id/imagenes", autenticar, autorizar("COMERCIANTE", "ADMIN"), ProductoController.quitarImagen);
router.patch("/:id/foto-principal", autenticar, autorizar("COMERCIANTE", "ADMIN"), ProductoController.fotoPrincipal);

module.exports = router;
