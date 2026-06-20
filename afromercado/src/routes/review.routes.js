const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const ReviewController = require("../controllers/review.controller");

const router = express.Router();
const soloCompradores = [autenticar, autorizar("COMPRADOR", "COMERCIANTE")];

router.post("/", ...soloCompradores, ReviewController.crear);
router.get("/puede-calificar/:productoId", ...soloCompradores, ReviewController.puedeCalificar);
router.post("/tienda", ...soloCompradores, ReviewController.crearTienda);
router.get("/puede-calificar-tienda/:pedidoId", autenticar, ReviewController.puedeCalificarTienda);
router.get("/comercio/:comercioId", ReviewController.listarTienda);

module.exports = router;
