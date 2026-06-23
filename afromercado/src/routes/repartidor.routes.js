const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const RepartidorController = require("../controllers/repartidor.controller");

const router = express.Router();

router.get("/entregas", autenticar, autorizar("REPARTIDOR"), RepartidorController.misEntregas);
router.get("/entregas/disponibles", autenticar, autorizar("REPARTIDOR"), RepartidorController.disponibles);
router.patch("/entregas/:id/tomar", autenticar, autorizar("REPARTIDOR"), RepartidorController.tomar);
router.patch("/entregas/:id/estado", autenticar, autorizar("REPARTIDOR"), RepartidorController.actualizarEstado);
router.post("/entregas/:id/foto", autenticar, autorizar("REPARTIDOR"), RepartidorController.uploadFotoEntrega, RepartidorController.subirFotoEntrega);

router.get("/admin/entregas", autenticar, autorizar("ADMIN"), RepartidorController.listarAdmin);
router.patch("/admin/entregas/:id/asignar", autenticar, autorizar("ADMIN"), RepartidorController.asignarAdmin);

// Solicitud para ser repartidor (cualquier usuario autenticado)
router.post("/solicitar",   autenticar, RepartidorController.enviarSolicitud);
router.get("/mi-solicitud", autenticar, RepartidorController.miSolicitud);
router.post("/solicitud/foto", autenticar, RepartidorController.uploadDocSolicitud, RepartidorController.subirDocSolicitud);

module.exports = router;
