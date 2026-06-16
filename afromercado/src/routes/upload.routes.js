const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { autenticar, autorizar } = require("../middlewares/auth");

const router = express.Router();

const DIR = path.join(__dirname, "..", "..", "uploads", "campanas");
fs.mkdirSync(DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `campana_${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  cb(null, file.mimetype.startsWith("image/"));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/upload/imagen — sólo admin
router.post(
  "/imagen",
  autenticar,
  autorizar("ADMIN"),
  upload.single("imagen"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, mensaje: "No se recibió imagen." });
    const base = `${req.protocol}://${req.get("host")}`;
    const url = `${base}/uploads/campanas/${req.file.filename}`;
    res.json({ ok: true, url });
  },
);

module.exports = router;
