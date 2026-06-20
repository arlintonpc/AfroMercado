// Rutas de perfil de usuario
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { Router } = require("express");
const { autenticar } = require("../middlewares/auth");
const UsuarioController = require("../controllers/usuario.controller");
const UsuarioRepository = require("../repositories/usuario.repository");

const router = Router();

// ── Multer para avatares ──────────────────────────────────────
const DIR_AVATARES = path.join(__dirname, "..", "..", "uploads", "avatares");
fs.mkdirSync(DIR_AVATARES, { recursive: true });

const storageAvatar = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DIR_AVATARES),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `avatar_${req.usuario.id}_${Date.now()}${ext}`);
  },
});

const uploadAvatar = multer({
  storage: storageAvatar,
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB
});

// ── Rutas ─────────────────────────────────────────────────────
router.get("/yo", autenticar, UsuarioController.obtenerPerfil);
router.patch("/yo", autenticar, UsuarioController.actualizarPerfil);
router.patch("/yo/cambiar-password", autenticar, UsuarioController.cambiarPassword);

// POST /api/usuario/yo/avatar — sube y actualiza la foto de perfil
router.post(
  "/yo/avatar",
  autenticar,
  uploadAvatar.single("avatar"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ ok: false, mensaje: "No se recibió imagen." });
      }
      const base = `${req.protocol}://${req.get("host")}`;
      const avatarUrl = `${base}/uploads/avatares/${req.file.filename}`;
      const actualizado = await UsuarioRepository.actualizar(req.usuario.id, { avatarUrl });
      const { passwordHash, deletedAt, ...publico } = actualizado;
      res.json({ ok: true, data: publico });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
