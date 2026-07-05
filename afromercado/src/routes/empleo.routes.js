const path = require("path");
const fs = require("fs");
const multer = require("multer");
const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const EmpleoController = require("../controllers/empleo.controller");

const router = express.Router();
const soloAdmin = [autenticar, autorizar("ADMIN")];

// ── Multer para el CV adjunto (PDF) ────────────────────────────
const DIR_CV = path.join(__dirname, "..", "..", "uploads", "hojas-de-vida");
fs.mkdirSync(DIR_CV, { recursive: true });

const storageCv = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DIR_CV),
  filename: (req, file, cb) => cb(null, `cv_${req.usuario.id}_${Date.now()}.pdf`),
});

const uploadCv = multer({
  storage: storageCv,
  fileFilter: (req, file, cb) => cb(null, file.mimetype === "application/pdf"),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// Públicas
router.get("/empleo/ofertas", EmpleoController.listarPublicas);
router.get("/empleo/ofertas/:id", EmpleoController.obtenerDetalle);
router.get("/empleo/ofertas/:id/otras-del-publicador", EmpleoController.otrasDelPublicador);

// Favoritos — "mis" antes de ":id" para evitar ambigüedad de rutas
router.get("/empleo/favoritos/mis", autenticar, EmpleoController.misFavoritos);
router.post("/empleo/favoritos/:id/toggle", autenticar, EmpleoController.toggleFavorito);
router.get("/empleo/favoritos/:id", autenticar, EmpleoController.esFavorito);

// Ofertas propias (cualquier usuario autenticado puede publicar)
router.post("/empleo/ofertas", autenticar, EmpleoController.crearOferta);
router.patch("/empleo/ofertas/:id", autenticar, EmpleoController.actualizarOferta);
router.patch("/empleo/ofertas/:id/estado", autenticar, EmpleoController.cambiarEstadoOferta);
router.get("/empleo/mis-ofertas", autenticar, EmpleoController.misOfertas);
router.get("/empleo/ofertas/:id/postulaciones", autenticar, EmpleoController.postulacionesDeOferta);

// Hoja de vida
router.get("/empleo/hoja-de-vida", autenticar, EmpleoController.obtenerMiHojaDeVida);
router.put("/empleo/hoja-de-vida", autenticar, EmpleoController.guardarHojaDeVida);
router.post("/empleo/hoja-de-vida/cv", autenticar, uploadCv.single("cv"), EmpleoController.subirCvHojaDeVida);

// Postulaciones
router.post("/empleo/ofertas/:id/postular", autenticar, EmpleoController.postularse);
router.get("/empleo/mis-postulaciones", autenticar, EmpleoController.misPostulaciones);
router.patch("/empleo/postulaciones/:id/estado", autenticar, EmpleoController.cambiarEstadoPostulacion);
router.patch("/empleo/postulaciones/:id/retirar", autenticar, EmpleoController.retirarPostulacion);

// Admin: moderación
router.get("/admin/empleo/pendientes", ...soloAdmin, EmpleoController.listarPendientesModeracion);
router.patch("/admin/empleo/:id/moderar", ...soloAdmin, EmpleoController.moderar);

module.exports = router;
