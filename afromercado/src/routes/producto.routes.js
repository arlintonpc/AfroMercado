// Rutas de Productos
const express = require("express");
const ProductoController = require("../controllers/producto.controller");
const { autenticar, autorizar } = require("../middlewares/auth");

const router = express.Router();

// Rutas públicas (cualquiera puede ver el catálogo)
router.get("/", ProductoController.listar);
router.get("/:id", ProductoController.obtener);

// Rutas protegidas — solo COMERCIANTE o ADMIN
router.post("/", autenticar, autorizar("COMERCIANTE", "ADMIN"), ProductoController.crear);
router.get("/mis/productos", autenticar, autorizar("COMERCIANTE", "ADMIN"), ProductoController.misProductos);
router.patch("/:id", autenticar, autorizar("COMERCIANTE", "ADMIN"), ProductoController.actualizar);
router.delete("/:id", autenticar, autorizar("COMERCIANTE", "ADMIN"), ProductoController.desactivar);

module.exports = router;
