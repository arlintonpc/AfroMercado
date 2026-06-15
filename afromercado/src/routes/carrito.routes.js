// ============================================================
//  Rutas de Carrito — solo COMPRADOR y COMERCIANTE
// ============================================================
const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const CarritoController = require("../controllers/carrito.controller");

const router = express.Router();

const soloCompradoresYComerciantes = [autenticar, autorizar("COMPRADOR", "COMERCIANTE")];

router.get("/", ...soloCompradoresYComerciantes, CarritoController.obtener);
router.post("/items", ...soloCompradoresYComerciantes, CarritoController.agregar);
router.put("/items/:productoId", ...soloCompradoresYComerciantes, CarritoController.actualizarCantidad);
router.delete("/items/:productoId", ...soloCompradoresYComerciantes, CarritoController.eliminarItem);
router.delete("/", ...soloCompradoresYComerciantes, CarritoController.vaciar);

module.exports = router;
