const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { ErrorValidacion } = require("./errores");

const EXTENSIONES_VIDEO = new Set([
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  ".avi",
  ".mkv",
  ".3gp",
  ".mpeg",
  ".mpg",
  ".wmv",
  ".ogv",
  ".ts",
  ".mts",
]);

function esVideoPermitido(file) {
  if (!file) return false;
  if (typeof file.mimetype === "string" && file.mimetype.startsWith("video/")) {
    return true;
  }
  const ext = path.extname(file.originalname || "").toLowerCase();
  return EXTENSIONES_VIDEO.has(ext);
}

function crearUploadVideo({
  dir,
  prefijo,
  fieldName = "video",
  maxFileSize = 100 * 1024 * 1024,
}) {
  fs.mkdirSync(dir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".mp4";
      const idParte = req.params.id ? `-${req.params.id}` : "";
      cb(null, `${prefijo}${idParte}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    if (!esVideoPermitido(file)) {
      return cb(new ErrorValidacion("Solo se permiten videos"));
    }
    cb(null, true);
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: maxFileSize },
  }).single(fieldName);
}

function aNumero(valor, fallback = null) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : fallback;
}

function extraerVideoMeta(body = {}) {
  return {
    durationSeconds: aNumero(body.duracionSegundos),
    width: aNumero(body.ancho),
    height: aNumero(body.alto),
    bytes: aNumero(body.bytes),
    mimeType: typeof body.mimeType === "string" ? body.mimeType.trim() || null : null,
    format: typeof body.formato === "string" ? body.formato.trim() || null : null,
  };
}

function urlLocalVideo(req, relativePath) {
  const base = `${req.protocol}://${req.get("host")}`;
  const limpio = String(relativePath).replace(/^\/+/, "");
  return `${base}/${limpio}`;
}

function eliminarArchivoLocalDesdeUrl(url) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith("/uploads/videos/")) return false;

    const ruta = path.join(__dirname, "..", "..", parsed.pathname.replace(/^\/+/, ""));
    if (!fs.existsSync(ruta)) return false;
    fs.unlink(ruta, () => {});
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  crearUploadVideo,
  extraerVideoMeta,
  eliminarArchivoLocalDesdeUrl,
  esVideoPermitido,
  urlLocalVideo,
};
