// Rutas de autenticación
const express = require("express");
const AuthController = require("../controllers/auth.controller");
const RecuperacionController = require("../controllers/recuperacion.controller");
const { autenticar } = require("../middlewares/auth");

const router = express.Router();

router.post("/registro", AuthController.registrar);
router.post("/login", AuthController.login);
router.post("/logout", AuthController.logout);
router.get("/yo", autenticar, AuthController.yo);

// Recuperación de contraseña
router.post("/recuperar/solicitar", RecuperacionController.solicitarCodigo);
router.post("/recuperar/verificar", RecuperacionController.verificarCodigo);
router.post("/recuperar/cambiar", RecuperacionController.cambiarPassword);

module.exports = router;
