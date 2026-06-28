// Rutas de Productos
const express = require("express");
const ProductoController = require("../controllers/producto.controller");
const { autenticar, autorizar, autenticarOpcional } = require("../middlewares/auth");

const router = express.Router();

const ReviewController = require("../controllers/review.controller");
const VisibilidadController = require("../controllers/visibilidad.controller");

// Rutas públicas (cualquiera puede ver el catálogo)
router.get("/destacados", VisibilidadController.listarActivas);
router.get("/recomendaciones", autenticarOpcional, ProductoController.recomendaciones);
router.get("/busquedas-recientes", autenticarOpcional, ProductoController.busquedasRecientes);
router.get("/historial-vistas", autenticarOpcional, ProductoController.historialVistas);
router.post("/busqueda", autenticarOpcional, ProductoController.registrarBusqueda);
router.get("/", ProductoController.listar);

// Rutas protegidas estáticas — deben ir ANTES de /:id para evitar conflicto
router.post("/", autenticar, autorizar("COMERCIANTE", "ADMIN"), ProductoController.crear);
router.get("/mis/productos", autenticar, autorizar("COMERCIANTE", "ADMIN"), ProductoController.misProductos);

// Rutas dinámicas con :id
router.get("/:id", ProductoController.obtener);
router.post("/:id/vista", autenticarOpcional, ProductoController.registrarVista);
router.post("/:id/clic-patrocinado", autenticarOpcional, VisibilidadController.registrarClic);
router.post("/:id/carrito-patrocinado", autenticarOpcional, VisibilidadController.registrarCarrito);
router.get("/:id/reviews", ReviewController.listar);
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
router.post(
  "/:id/video",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ProductoController.uploadVideo,
  ProductoController.subirVideo
);
router.delete("/:id/imagenes", autenticar, autorizar("COMERCIANTE", "ADMIN"), ProductoController.quitarImagen);
router.delete("/:id/video", autenticar, autorizar("COMERCIANTE", "ADMIN"), ProductoController.quitarVideo);
router.patch("/:id/foto-principal", autenticar, autorizar("COMERCIANTE", "ADMIN"), ProductoController.fotoPrincipal);

module.exports = router;
