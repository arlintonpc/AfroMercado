const express = require("express");
const { autenticar } = require("../middlewares/auth");
const DireccionController = require("../controllers/direccion.controller");

const router = express.Router();

router.use(autenticar);

router.get("/", DireccionController.listar);
router.post("/", DireccionController.crear);
router.put("/:id", DireccionController.actualizar);
router.delete("/:id", DireccionController.eliminar);
router.patch("/:id/principal", DireccionController.marcarPrincipal);

module.exports = router;
