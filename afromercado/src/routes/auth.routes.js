// Rutas de autenticación
const express = require("express");
const AuthController = require("../controllers/auth.controller");
const { autenticar } = require("../middlewares/auth");

const router = express.Router();

router.post("/registro", AuthController.registrar);
router.post("/login", AuthController.login);
router.get("/yo", autenticar, AuthController.yo);

module.exports = router;
