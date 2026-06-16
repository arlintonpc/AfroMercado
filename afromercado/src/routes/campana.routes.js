const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const CampanaController = require("../controllers/campana.controller");

const router = express.Router();
const soloAdmin = [autenticar, autorizar("ADMIN")];

// Públicas
router.get("/activas", CampanaController.listarActivas);
router.post("/:id/vista", CampanaController.registrarVista);
router.post("/:id/clic", CampanaController.registrarClic);

// Admin
router.get("/", ...soloAdmin, CampanaController.listarTodas);
router.post("/", ...soloAdmin, CampanaController.crear);
router.patch("/:id/desactivar", ...soloAdmin, CampanaController.desactivar);

module.exports = router;
