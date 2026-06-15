// ============================================================
//  Controlador de Administración
// ============================================================
const path = require("path");
const fs = require("fs");
const AdminService = require("../services/admin.service");
const PagoRepository = require("../repositories/pago.repository");
const { ErrorNoEncontrado } = require("../utils/errores");

// Raíz del proyecto (donde vive la carpeta uploads/).
const RAIZ_PROYECTO = path.join(__dirname, "..", "..");

const AdminController = {
  // GET /admin/pagos/pendientes
  async pagosPendientes(req, res, next) {
    try {
      const pagos = await AdminService.listarPagosPendientes();
      res.json({ ok: true, data: pagos });
    } catch (e) {
      next(e);
    }
  },

  // PATCH /admin/pagos/:id/verificar  (body: { accion, notas? })
  async verificarPago(req, res, next) {
    try {
      const { accion, notas } = req.body;
      const resultado = await AdminService.verificarPago(
        req.usuario.id,
        req.params.id,
        { accion, notas }
      );
      res.json({ ok: true, data: resultado });
    } catch (e) {
      next(e);
    }
  },

  // GET /admin/estadisticas
  async estadisticas(req, res, next) {
    try {
      const stats = await AdminService.estadisticas();
      res.json({ ok: true, data: stats });
    } catch (e) {
      next(e);
    }
  },

  // GET /admin/pagos/:id/comprobante  -> sirve el archivo de imagen
  async comprobante(req, res, next) {
    try {
      const pago = await PagoRepository.buscarPorId(Number(req.params.id));
      if (!pago) throw new ErrorNoEncontrado("Pago no encontrado");
      if (!pago.comprobanteUrl) {
        throw new ErrorNoEncontrado("Este pago no tiene comprobante adjunto");
      }

      // comprobanteUrl es una ruta relativa al proyecto.
      const rutaAbsoluta = path.resolve(RAIZ_PROYECTO, pago.comprobanteUrl);

      // Evitar path traversal: el archivo debe estar dentro de uploads/.
      const dirUploads = path.resolve(RAIZ_PROYECTO, "uploads");
      if (!rutaAbsoluta.startsWith(dirUploads)) {
        throw new ErrorNoEncontrado("Comprobante no disponible");
      }
      if (!fs.existsSync(rutaAbsoluta)) {
        throw new ErrorNoEncontrado("El archivo del comprobante no existe");
      }

      res.sendFile(rutaAbsoluta);
    } catch (e) {
      next(e);
    }
  },
};

module.exports = AdminController;
