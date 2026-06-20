const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const ChatController = require("../controllers/chat.controller");
const router = express.Router();

router.use(autenticar);
router.get("/conversaciones", ChatController.listarConversaciones);
router.get("/conversaciones/:id/mensajes", ChatController.obtenerMensajes);
router.post("/conversaciones", autorizar("COMPRADOR", "COMERCIANTE"), ChatController.iniciarConversacion);
router.post("/conversaciones/:id/mensajes", ChatController.enviarMensaje);
router.get("/no-leidos", ChatController.noLeidos);

module.exports = router;
