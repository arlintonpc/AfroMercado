const path = require("path");
const fs = require("fs");
const prisma = require("../config/prisma");
const AdminService = require("../services/admin.service");
const PagoRepository = require("../repositories/pago.repository");
const { ErrorNoEncontrado, ErrorValidacion } = require("../utils/errores");
const { obtenerEstadoWA, iniciarWhatsApp } = require("../utils/whatsapp");
const { estaConfigurado, obtenerFrom, enviarEmail, obtenerConfigSmtp } = require("../utils/email");
const ConfigRepository = require("../repositories/config.repository");

const RAIZ_PROYECTO = path.join(__dirname, "..", "..");

const AdminController = {
  async pagosPendientes(req, res, next) {
    try {
      const pagos = await AdminService.listarPagosPendientes();
      res.json({ ok: true, data: pagos });
    } catch (e) { next(e); }
  },

  async verificarPago(req, res, next) {
    try {
      const { accion, notas } = req.body;
      const resultado = await AdminService.verificarPago(req.usuario.id, req.params.id, { accion, notas });
      res.json({ ok: true, data: resultado });
    } catch (e) { next(e); }
  },

  async estadisticas(req, res, next) {
    try {
      const stats = await AdminService.estadisticas();
      res.json({ ok: true, data: stats });
    } catch (e) { next(e); }
  },

  async estadoWhatsApp(req, res, next) {
    try {
      res.json({ ok: true, data: obtenerEstadoWA() });
    } catch (err) { next(err); }
  },

  async conectarWhatsApp(req, res, next) {
    try {
      await iniciarWhatsApp();
      res.json({ ok: true, mensaje: "Proceso de conexión iniciado" });
    } catch (err) { next(err); }
  },

  async comprobante(req, res, next) {
    try {
      const pago = await PagoRepository.buscarPorId(Number(req.params.id));
      if (!pago) throw new ErrorNoEncontrado("Pago no encontrado");
      if (!pago.comprobanteUrl) throw new ErrorNoEncontrado("Este pago no tiene comprobante adjunto");
      const rutaAbsoluta = path.resolve(RAIZ_PROYECTO, pago.comprobanteUrl);
      const dirUploads = path.resolve(RAIZ_PROYECTO, "uploads");
      if (!rutaAbsoluta.startsWith(dirUploads)) throw new ErrorNoEncontrado("Comprobante no disponible");
      if (!fs.existsSync(rutaAbsoluta)) throw new ErrorNoEncontrado("El archivo del comprobante no existe");
      res.sendFile(rutaAbsoluta);
    } catch (e) { next(e); }
  },

  // GET /admin/email/estado
  async estadoEmail(req, res, next) {
    try {
      const [configurado, cfg, adminEmail] = await Promise.all([
        estaConfigurado(),
        obtenerConfigSmtp(),
        ConfigRepository.obtener("adminEmail"),
      ]);
      res.json({
        ok: true,
        data: {
          configurado,
          from: obtenerFrom(cfg.user),
          adminEmail: adminEmail || process.env.ADMIN_EMAIL || null,
          smtp: {
            host: cfg.host,
            port: cfg.port,
            user: cfg.user,
            secure: cfg.secure,
            tienePassword: !!cfg.pass,
          },
        },
      });
    } catch (e) { next(e); }
  },

  // PUT /admin/email/smtp
  async guardarConfigSmtp(req, res, next) {
    try {
      const { host, port, user, pass, secure } = req.body;
      if (!host || !String(host).trim()) throw new ErrorValidacion("El servidor SMTP es requerido");
      if (!user || !String(user).trim()) throw new ErrorValidacion("El usuario SMTP es requerido");

      await Promise.all([
        ConfigRepository.guardar("smtpHost", String(host).trim()),
        ConfigRepository.guardar("smtpPort", String(parseInt(port, 10) || 587)),
        ConfigRepository.guardar("smtpUser", String(user).trim()),
        ConfigRepository.guardar("smtpSecure", secure ? "true" : "false"),
      ]);
      if (pass) {
        await ConfigRepository.guardar("smtpPass", String(pass));
      }

      res.json({ ok: true, mensaje: "Configuración SMTP guardada" });
    } catch (e) { next(e); }
  },

  // PUT /admin/email/config  (email del administrador)
  async actualizarConfigEmail(req, res, next) {
    try {
      const { adminEmail } = req.body;
      if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
        throw new ErrorValidacion("Email de administrador inválido");
      }
      await ConfigRepository.guardar("adminEmail", adminEmail.trim().toLowerCase());
      res.json({ ok: true, mensaje: "Email de administrador actualizado" });
    } catch (e) { next(e); }
  },

  // GET /admin/comercios/buscar?q=texto — para autocomplete en formularios admin
  // Busca por nombre, municipio o número de WhatsApp
  async buscarComercios(req, res, next) {
    try {
      const q = req.query.q?.trim() ?? '';
      const where = q
        ? {
            OR: [
              { nombre:    { contains: q, mode: 'insensitive' } },
              { municipio: { contains: q, mode: 'insensitive' } },
              { whatsapp:  { contains: q, mode: 'insensitive' } },
            ],
          }
        : {};
      const items = await prisma.comercio.findMany({
        where,
        select: { id: true, nombre: true, municipio: true, whatsapp: true },
        orderBy: { nombre: 'asc' },
        take: 20,
      });
      res.json({ ok: true, items });
    } catch (e) { next(e); }
  },

  // GET /admin/productos/buscar?q=texto&comercioId=X — para autocomplete en formularios admin
  async buscarProductos(req, res, next) {
    try {
      const q = req.query.q?.trim() ?? '';
      const comercioId = req.query.comercioId ? Number(req.query.comercioId) : undefined;
      const where = { deletedAt: null };
      if (q) where.nombre = { contains: q, mode: 'insensitive' };
      if (comercioId) where.comercioId = comercioId;
      const items = await prisma.producto.findMany({
        where,
        select: { id: true, nombre: true, comercioId: true },
        orderBy: { nombre: 'asc' },
        take: 50,
      });
      res.json({ ok: true, items });
    } catch (e) { next(e); }
  },

  // POST /admin/email/test
  async enviarEmailTest(req, res, next) {
    try {
      if (!await estaConfigurado()) {
        throw new ErrorValidacion("SMTP no configurado — configura el servidor antes de enviar la prueba");
      }
      const adminEmail = await ConfigRepository.obtener("adminEmail") || process.env.ADMIN_EMAIL;
      if (!adminEmail) {
        throw new ErrorValidacion("Configura un email de administrador antes de enviar la prueba");
      }
      await enviarEmail({
        to: adminEmail,
        subject: "Prueba de email — AfroMercado",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#2D6A4F">¡El email está funcionando!</h2>
            <p>Este es un correo de prueba enviado desde el panel de administración de <strong>AfroMercado</strong>.</p>
            <p style="color:#666;font-size:14px">Si recibiste este mensaje, las notificaciones por email están correctamente configuradas.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
            <p style="color:#999;font-size:12px">AfroMercado — Del Chocó para el mundo</p>
          </div>
        `,
      });
      res.json({ ok: true, mensaje: `Email de prueba enviado a ${adminEmail}` });
    } catch (e) { next(e); }
  },

  // GET /admin/comercios?soloSinVerificar=true
  async listarComercios(req, res, next) {
    try {
      const { soloSinVerificar } = req.query;
      const comercios = await AdminService.listarComercios({ soloSinVerificar: soloSinVerificar === 'true' });
      res.json({ ok: true, data: comercios });
    } catch (e) { next(e); }
  },

  // PATCH /admin/comercios/:id/verificar
  async verificarComerciante(req, res, next) {
    try {
      const { accion, notas } = req.body;
      const resultado = await AdminService.verificarComerciante(req.usuario.id, Number(req.params.id), { accion, notas });
      res.json({ ok: true, data: resultado });
    } catch (e) { next(e); }
  },
};

module.exports = AdminController;
