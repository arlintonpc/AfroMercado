// ============================================================
//  Controlador de Pagos
// ============================================================
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const PagoService = require("../services/pago.service");
const { ErrorValidacion } = require("../utils/errores");

// Carpeta donde se guardan los comprobantes de pago.
const DIR_COMPROBANTES = path.join(
  __dirname,
  "..",
  "..",
  "uploads",
  "comprobantes"
);

// Asegura que la carpeta exista al arrancar.
fs.mkdirSync(DIR_COMPROBANTES, { recursive: true });

// Configuración de multer: guarda en disco con nombre único.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(DIR_COMPROBANTES, { recursive: true });
    cb(null, DIR_COMPROBANTES);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const nombre = `pago-${req.params.id}-${Date.now()}${ext}`;
    cb(null, nombre);
  },
});

function fileFilter(req, file, cb) {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new ErrorValidacion("El comprobante debe ser una imagen"));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

const PagoController = {
  // Middleware multer expuesto para usar en la ruta (campo "comprobante").
  uploadComprobante: upload.single("comprobante"),

  // POST /pagos
  async crear(req, res, next) {
    try {
      const { pedidoId, metodo, referencia, idempotencyKey } = req.body;
      const pago = await PagoService.crearPago(req.usuario.id, {
        pedidoId,
        metodo,
        referencia,
        idempotencyKey,
      });
      res.status(201).json({ ok: true, data: pago });
    } catch (e) {
      next(e);
    }
  },

  // POST /pagos/:id/comprobante  (multipart, campo "comprobante")
  async subirComprobante(req, res, next) {
    try {
      if (!req.file) {
        throw new ErrorValidacion("Debes adjuntar el comprobante (campo 'comprobante')");
      }
      // Guardamos la ruta relativa al proyecto (no la absoluta del sistema).
      const rutaRelativa = path
        .join("uploads", "comprobantes", req.file.filename)
        .replace(/\\/g, "/");

      const pago = await PagoService.adjuntarComprobante(
        req.usuario.id,
        req.params.id,
        rutaRelativa
      );
      res.json({ ok: true, data: pago });
    } catch (e) {
      next(e);
    }
  },

  // GET /pagos/instrucciones/:pedidoId
  async instrucciones(req, res, next) {
    try {
      const data = await PagoService.obtenerInstruccionesPago(req.params.pedidoId);
      res.json({ ok: true, data });
    } catch (e) {
      next(e);
    }
  },
};

module.exports = PagoController;
