const express = require("express");
const { autenticar, autenticarOpcional, autorizar } = require("../middlewares/auth");
const PqrsdController = require("../controllers/pqrsd.controller");

const router = express.Router();
const soloAdmin = [autenticar, autorizar("ADMIN")];

// Público — un visitante sin cuenta también puede escribir a la plataforma.
router.post("/pqrsd", autenticarOpcional, PqrsdController.crear);
router.get("/pqrsd/mios", autenticar, PqrsdController.misTickets);
router.get("/pqrsd/:id", autenticar, PqrsdController.obtenerDetalle);

router.get("/admin/pqrsd", ...soloAdmin, PqrsdController.listarAdmin);
router.patch("/admin/pqrsd/:id/responder", ...soloAdmin, PqrsdController.responderAdmin);
router.patch("/admin/pqrsd/:id/cerrar", ...soloAdmin, PqrsdController.cerrarAdmin);

module.exports = router;
