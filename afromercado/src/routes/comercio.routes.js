// ============================================================
//  Rutas de Comercios
// ============================================================
const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const ComercioController = require("../controllers/comercio.controller");
const VisibilidadController = require("../controllers/visibilidad.controller");

const router = express.Router();

// POST /comercios - registrar comercio (COMERCIANTE o ADMIN)
router.post(
  "/",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.registrar,
);

// GET /comercios/mi-comercio - ver el propio comercio
router.get(
  "/mi-comercio",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.miComercio,
);

// GET/PUT /comercios/cuenta-dispersion - cuenta bancaria/billetera para dispersion automatica
router.get(
  "/cuenta-dispersion",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.obtenerCuentaDispersion,
);

router.put(
  "/cuenta-dispersion",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.guardarCuentaDispersion,
);

// GET /comercios/mis-estadisticas - dashboard del comerciante
router.get(
  "/mis-estadisticas",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.misEstadisticas,
);

// GET /comercios/mis-analiticas - analiticas completas
router.get(
  "/mis-analiticas",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.misAnaliticas,
);

// POST /comercios/video - video de presentacion del comercio
router.post(
  "/video",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.uploadVideo,
  ComercioController.subirVideo,
);

// DELETE /comercios/video - elimina el video de presentacion
router.delete(
  "/video",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.quitarVideo,
);

// GET /comercios/visibilidad/metricas - metricas de slots activos del propio comercio
router.get(
  "/visibilidad/metricas",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  VisibilidadController.metricasComerciante,
);

// GET /comercios/mis-pedidos - lista completa de subpedidos del comerciante
router.get(
  "/mis-pedidos",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.misPedidos,
);

// PATCH /comercios/mis-pedidos/:id/estado - avanzar estado del subpedido
router.patch(
  "/mis-pedidos/:id/estado",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.actualizarEstadoPedido,
);

// GET /comercios/liquidaciones - liquidaciones del comerciante autenticado
router.get(
  "/liquidaciones",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.misLiquidaciones,
);

// POST /comercios/subir-documento - foto del documento de identidad
router.post(
  "/subir-documento",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.subirDocumento,
);

// GET /comercios/:id - ver cualquier comercio (publico)
router.get("/:id", ComercioController.obtener);

// PATCH /comercios - actualizar el propio comercio
router.patch(
  "/",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.actualizar,
);

module.exports = router;
