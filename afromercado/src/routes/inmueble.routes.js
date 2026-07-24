const path = require("path");
const fs = require("fs");
const multer = require("multer");
const express = require("express");
const { autenticar, autorizar } = require("../middlewares/auth");
const { verificarModuloActivo } = require("../middlewares/moduloActivo");
const InmuebleController = require("../controllers/inmueble.controller");

const router = express.Router();
router.use(verificarModuloActivo("flag_modulo_inmuebles"));
const soloAdmin = [autenticar, autorizar("ADMIN")];

// ── Multer para fotos del inmueble (imagen) ─────────────────────
const DIR_FOTOS = path.join(__dirname, "..", "..", "uploads", "inmuebles");
fs.mkdirSync(DIR_FOTOS, { recursive: true });

const storageFoto = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DIR_FOTOS),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `inmueble_${req.usuario.id}_${Date.now()}${ext}`);
  },
});

const uploadFoto = multer({
  storage: storageFoto,
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ── Multer para el documento de soporte (evidencia de título, PDF) ─────
const DIR_DOCUMENTOS = path.join(__dirname, "..", "..", "uploads", "inmuebles-documentos");
fs.mkdirSync(DIR_DOCUMENTOS, { recursive: true });

const storageDocumento = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DIR_DOCUMENTOS),
  filename: (req, file, cb) => cb(null, `documento_${req.usuario.id}_${Date.now()}.pdf`),
});

const uploadDocumento = multer({
  storage: storageDocumento,
  fileFilter: (req, file, cb) => cb(null, file.mimetype === "application/pdf"),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// Públicas
router.get("/inmuebles", InmuebleController.listarPublicas);

// Publicaciones propias — "mis-publicaciones" antes de ":id" para evitar ambigüedad
// de rutas (si no, GET /inmuebles/:id capturaría "mis-publicaciones" como :id).
router.get("/inmuebles/mis-publicaciones", autenticar, InmuebleController.misPublicaciones);
router.get("/inmuebles/:id", InmuebleController.obtenerDetalle);

router.post("/inmuebles", autenticar, InmuebleController.crear);
router.put("/inmuebles/:id", autenticar, InmuebleController.actualizar);
router.patch("/inmuebles/:id/estado", autenticar, InmuebleController.cambiarEstado);
router.delete("/inmuebles/:id", autenticar, InmuebleController.eliminar);
router.post("/inmuebles/:id/foto", autenticar, uploadFoto.single("foto"), InmuebleController.subirFoto);
router.post("/inmuebles/:id/documento-soporte", autenticar, uploadDocumento.single("documento"), InmuebleController.subirDocumentoSoporte);

// Denuncias
router.post("/inmuebles/:id/denunciar", autenticar, InmuebleController.denunciar);

// Admin: moderación
router.get("/admin/inmuebles/pendientes", ...soloAdmin, InmuebleController.listarPendientesModeracion);
router.patch("/admin/inmuebles/:id/moderar", ...soloAdmin, InmuebleController.moderar);

// Admin: denuncias
router.get("/admin/inmuebles/denuncias", ...soloAdmin, InmuebleController.listarDenunciasPendientes);
router.patch("/admin/inmuebles/denuncias/:id/resolver", ...soloAdmin, InmuebleController.resolverDenuncia);

module.exports = router;
