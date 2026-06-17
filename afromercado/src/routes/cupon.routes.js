const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const CuponController = require("../controllers/cupon.controller");

const router = express.Router();

router.post("/validar", autenticar, CuponController.validar);
router.post("/", autenticar, autorizar("ADMIN"), CuponController.crear);
router.get("/", autenticar, autorizar("ADMIN"), CuponController.listar);
router.delete("/:id", autenticar, autorizar("ADMIN"), CuponController.desactivar);

module.exports = router;
