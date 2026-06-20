const express = require("express");
const { autenticar } = require("../middlewares/auth");
const PushController = require("../controllers/push.controller");

const router = express.Router();

router.get("/clave-publica",         PushController.clavePublica);
router.post("/suscribir",  autenticar, PushController.suscribir);
router.delete("/suscribir", autenticar, PushController.desuscribir);

module.exports = router;
