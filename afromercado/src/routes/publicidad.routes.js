const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const PublicidadController = require("../controllers/publicidad.controller");

const router = express.Router();

router.get("/politicas", PublicidadController.politicas);
router.get("/paquetes", PublicidadController.listarPaquetes);
router.post("/track", PublicidadController.trackMetrica);

router.get(
  "/mis-solicitudes",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  PublicidadController.misSolicitudes,
);

router.get(
  "/mis-metricas",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  PublicidadController.misMetricas,
);

router.post(
  "/solicitudes",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  PublicidadController.crearSolicitud,
);

router.post(
  "/solicitudes/:id/pago/iniciar",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  PublicidadController.iniciarPago,
);

module.exports = router;
