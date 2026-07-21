// ============================================================
//  Rutas de Comercios
// ============================================================
const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const ComercioController = require("../controllers/comercio.controller");
const VisibilidadController = require("../controllers/visibilidad.controller");

const router = express.Router();

// POST /comercios - abrir tienda con la cuenta ya autenticada (COMPRADOR se
// convierte en COMERCIANTE; ADMIN queda bloqueado dentro del service por
// separación de privilegios). COMERCIANTE también puede pegarle (ej. reintento),
// el service ya rechaza si ya tiene un comercio registrado.
router.post(
  "/",
  autenticar,
  autorizar("COMPRADOR", "COMERCIANTE"),
  ComercioController.registrar,
);

// GET /comercios/mi-comercio - ver el propio comercio (o null si aún no tiene).
// Cualquier rol autenticado puede consultarlo (solo devuelve datos del propio
// usuario, sin filtro de rol tiene sentido: así sabe si ya abrió tienda o si
// registro-comercio debe mostrarle el formulario, sin importar su rol actual).
router.get(
  "/mi-comercio",
  autenticar,
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

// PATCH /comercios/video-link - usa un link externo (YouTube/Facebook/etc.) como video de la tienda
router.patch(
  "/video-link",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.guardarVideoLink,
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

// POST /comercios/subir-camara-comercio - foto/captura del certificado de Cámara de Comercio
router.post(
  "/subir-camara-comercio",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.subirCamaraComercio,
);

// POST /comercios/declaracion-territorial - solicitar declaracion de organizacion territorial (Ley 1581)
router.post(
  "/declaracion-territorial",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.solicitarDeclaracionTerritorial,
);

// DELETE /comercios/declaracion-territorial - revocar la declaracion propia, sin pasar por revision
router.delete(
  "/declaracion-territorial",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.revocarDeclaracionTerritorial,
);

// PATCH /comercios/compras-publicas - opt-in/opt-out al directorio de proveedores certificados
router.patch(
  "/compras-publicas",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.toggleComprasPublicas,
);

// GET /comercios/buscar?q=texto - autocomplete de comercios activos/verificados
// (ej. para invitar un socio a una alianza comercial). Debe declararse ANTES
// de "/:id" para que Express no interprete "buscar" como el parametro :id.
router.get(
  "/buscar",
  autenticar,
  autorizar("COMERCIANTE", "ADMIN"),
  ComercioController.buscar,
);

// POST /comercios/:id/seguir/toggle - seguir/dejar de seguir un comercio
// (Vitrina v0.2). Cualquier usuario autenticado, sin restricción de rol.
router.post(
  "/:id/seguir/toggle",
  autenticar,
  ComercioController.toggleSeguir,
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
