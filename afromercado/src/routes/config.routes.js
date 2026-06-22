const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const ConfigController = require("../controllers/config.controller");

const router = express.Router();

// Pública — el hero banner la lee sin auth
router.get("/hero", ConfigController.heroGet);

// Pública — reglas no sensibles para el frontend (envío gratis, etc.)
router.get("/publicas", ConfigController.publicasGet);

// Solo admin — cambia modo e intervalo
router.put("/hero", autenticar, autorizar("ADMIN"), ConfigController.heroPut);

module.exports = router;
