const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { ErrorValidacion } = require("./errores");

const VIDEO_DURACION_MAXIMA_SEGUNDOS = 45;
const TOLERANCIA_SEGUNDOS = 0.05;

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

function redondearSegundos(valor) {
  if (valor === null || valor === undefined) return null;
  return Math.round(Number(valor) * 1000) / 1000;
}

function extraerVideoMeta(body = {}) {
  return {
    durationSeconds: aNumero(body.duracionSegundos),
    width: aNumero(body.ancho),
    height: aNumero(body.alto),
    bytes: aNumero(body.bytes),
    mimeType: typeof body.mimeType === "string" ? body.mimeType.trim() || null : null,
    format: typeof body.formato === "string" ? body.formato.trim() || null : null,
    trimStartSeconds: aNumero(body.recorteInicioSegundos),
    trimEndSeconds: aNumero(body.recorteFinSegundos),
  };
}

function normalizarRecorteVideo(meta, duracionReal = null) {
  const duracionOriginal = redondearSegundos(duracionReal ?? meta.durationSeconds);
  const tieneRecorte = meta.trimStartSeconds !== null || meta.trimEndSeconds !== null;

  if (!tieneRecorte) {
    if (duracionOriginal !== null && duracionOriginal > VIDEO_DURACION_MAXIMA_SEGUNDOS + TOLERANCIA_SEGUNDOS) {
      throw new ErrorValidacion("Selecciona un fragmento de maximo 45 segundos");
    }
    return {
      tieneRecorte: false,
      inicio: null,
      fin: null,
      duracionFinal: duracionOriginal,
      duracionOriginal,
    };
  }

  const inicio = Math.max(0, redondearSegundos(meta.trimStartSeconds ?? 0) ?? 0);
  let fin = redondearSegundos(meta.trimEndSeconds);
  if (fin === null) {
    fin = inicio + VIDEO_DURACION_MAXIMA_SEGUNDOS;
  }
  if (duracionOriginal !== null) {
    fin = Math.min(fin, duracionOriginal);
  }
  fin = redondearSegundos(fin);

  const duracionFinal = redondearSegundos(fin - inicio);
  if (duracionFinal === null || duracionFinal <= 0) {
    throw new ErrorValidacion("El fragmento seleccionado no es valido");
  }
  if (duracionFinal > VIDEO_DURACION_MAXIMA_SEGUNDOS + TOLERANCIA_SEGUNDOS) {
    throw new ErrorValidacion("El fragmento no puede superar 45 segundos");
  }

  return {
    tieneRecorte: true,
    inicio,
    fin,
    duracionFinal,
    duracionOriginal,
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
  VIDEO_DURACION_MAXIMA_SEGUNDOS,
  crearUploadVideo,
  extraerVideoMeta,
  eliminarArchivoLocalDesdeUrl,
  esVideoPermitido,
  normalizarRecorteVideo,
  urlLocalVideo,
};
