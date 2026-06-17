const express = require("express");
const { autenticar } = require("../middlewares/auth");
const FavoritoController = require("../controllers/favorito.controller");

const router = express.Router();
const auth = [autenticar];

router.get("/", ...auth, FavoritoController.listar);
router.get("/ids", ...auth, FavoritoController.listarIds);
router.post("/:productoId", ...auth, FavoritoController.toggle);

module.exports = router;
