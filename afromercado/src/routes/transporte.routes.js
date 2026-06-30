const express = require("express");
const multer  = require("multer");
const path    = require("path");
const { autenticar, autorizar } = require("../middlewares/auth");
const TransporteController = require("../controllers/transporte.controller");

const router = express.Router();
const soloAuth     = [autenticar];
const soloComercio = [autenticar, autorizar("COMERCIANTE")];
const soloAdmin    = [autenticar, autorizar("ADMIN")];

const _upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => {
      const dir = path.join(__dirname, "../../uploads/transportes");
      require("fs").mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  fileFilter: (_, file, cb) => cb(null, file.mimetype.startsWith("image/")),
  limits: { fileSize: 8 * 1024 * 1024 },
});
const uploadFotos = _upload.array("fotos", 10);

// ── PÚBLICO ──────────────────────────────────────────────────
router.get("/",               TransporteController.listar);
router.get("/disponibilidad", TransporteController.disponibilidad);
router.get("/:id",            TransporteController.obtener);

// ── CLIENTE ──────────────────────────────────────────────────
router.post(  "/reservas",              ...soloAuth, TransporteController.reservar);
router.get(   "/reservas/mis",          ...soloAuth, TransporteController.misReservas);
router.patch( "/reservas/:id/cancelar", ...soloAuth, TransporteController.cancelarReserva);

// ── OPERADOR ─────────────────────────────────────────────────
router.get(   "/mi-transporte/config",              ...soloComercio, TransporteController.miConfig);
router.put(   "/mi-transporte/config",              ...soloComercio, TransporteController.actualizarConfig);
router.post(  "/mi-transporte/config/fotos",        ...soloComercio, uploadFotos, TransporteController.subirFotos);
router.post(  "/mi-transporte/config/video",        ...soloComercio, TransporteController.uploadVideoTransporte, TransporteController.subirVideoTransporte);
router.delete("/mi-transporte/config/video",        ...soloComercio, TransporteController.quitarVideoTransporte);
router.patch( "/mi-transporte/config/video-link",   ...soloComercio, TransporteController.guardarVideoLinkTransporte);
router.post(  "/mi-transporte/rutas",               ...soloComercio, TransporteController.agregarRuta);
router.put(   "/mi-transporte/rutas/:id",           ...soloComercio, TransporteController.actualizarRuta);
router.delete("/mi-transporte/rutas/:id",           ...soloComercio, TransporteController.eliminarRuta);
router.get(   "/mi-transporte/reservas",            ...soloComercio, TransporteController.reservasOperador);
router.patch( "/mi-transporte/reservas/:id/estado", ...soloComercio, TransporteController.cambiarEstado);

// ── ADMIN ─────────────────────────────────────────────────────
router.get(   "/admin/todos",      ...soloAdmin, TransporteController.adminListar);
router.patch( "/admin/:id/estado", ...soloAdmin, TransporteController.adminCambiarEstado);

module.exports = router;
