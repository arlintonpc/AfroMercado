// ============================================================
//  Rutas de Comercios
// ============================================================
const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const ComercioController = require("../controllers/comercio.controller");

const router = express.Router();

// POST /comercios — registrar comercio (COMERCIANTE o ADMIN)
router.post(
  "/",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.registrar
);

// GET /comercios/mi-comercio — ver el propio comercio
router.get(
  "/mi-comercio",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.miComercio
);

// GET /comercios/mis-estadisticas — dashboard del comerciante
router.get(
  "/mis-estadisticas",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.misEstadisticas
);

// GET /comercios/:id — ver cualquier comercio (público)
router.get("/:id", ComercioController.obtener);

// PATCH /comercios — actualizar el propio comercio
router.patch(
  "/",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.actualizar
);

module.exports = router;
