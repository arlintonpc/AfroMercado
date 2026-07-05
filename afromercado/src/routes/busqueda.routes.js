const express = require("express");
const { autenticarOpcional } = require("../middlewares/auth");
const BusquedaController = require("../controllers/busqueda.controller");

const router = express.Router();

// GET /busqueda?q=&categoria=&precioMin=&precioMax=&calificacionMin=&lat=&lng=&radioKm=&page=
router.get("/", autenticarOpcional, BusquedaController.buscar);
// GET /busqueda/sugerencias?q= — autocompletado liviano, alimenta BusquedaHistorial
router.get("/sugerencias", autenticarOpcional, BusquedaController.sugerencias);

module.exports = router;
