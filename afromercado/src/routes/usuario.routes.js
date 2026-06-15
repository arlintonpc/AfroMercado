// Rutas de perfil de usuario
const { Router } = require("express");
const { autenticar } = require("../middlewares/auth");
const UsuarioController = require("../controllers/usuario.controller");

const router = Router();

router.get("/yo", autenticar, UsuarioController.obtenerPerfil);
router.patch("/yo", autenticar, UsuarioController.actualizarPerfil);

module.exports = router;
