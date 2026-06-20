const express = require("express");
const { autenticar } = require("../middlewares/auth");
const NotificacionController = require("../controllers/notificacion.controller");

const router = express.Router();

// SSE stream — respuesta no termina, no aplicar timeout
router.get("/stream", autenticar, NotificacionController.stream);

router.get("/", autenticar, NotificacionController.listar);
router.get("/no-leidas/count", autenticar, NotificacionController.contarNoLeidas);
router.patch("/leer-todas", autenticar, NotificacionController.marcarTodasLeidas);
router.patch("/:id/leer", autenticar, NotificacionController.marcarLeida);

module.exports = router;
