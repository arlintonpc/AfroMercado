const path = require("path");
const fs = require("fs");
const prisma = require("../config/prisma");
const AdminService = require("../services/admin.service");
const PagoRepository = require("../repositories/pago.repository");
const UsuarioRepository = require("../repositories/usuario.repository");
const { ErrorNoEncontrado, ErrorValidacion } = require("../utils/errores");
const { obtenerEstadoWA, iniciarWhatsApp } = require("../utils/whatsapp");
const { estaConfigurado, obtenerFrom, enviarEmail, obtenerConfigSmtp } = require("../utils/email");
const { hashearPassword } = require("../utils/auth");
const ConfigRepository = require("../repositories/config.repository");
const Reglas = require("../config/reglas");
const NotificacionService = require("../services/notificacion.service");

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

  // GET /admin/usuarios/buscar?q=texto&rol=REPARTIDOR — busca por nombre o teléfono, filtra por rol opcionalmente
  async buscarUsuarios(req, res, next) {
    try {
      const q   = req.query.q?.trim() ?? '';
      const rol = req.query.rol?.trim() ?? '';
      if (!q || q.length < 3) return res.json({ ok: true, data: [] });
      const where = {
        OR: [
          { telefono: { contains: q, mode: 'insensitive' } },
          { nombre:   { contains: q, mode: 'insensitive' } },
        ],
      };
      if (rol) where.rol = rol;
      const data = await prisma.usuario.findMany({
        where,
        select: { id: true, nombre: true, telefono: true, email: true, rol: true },
        orderBy: { nombre: 'asc' },
        take: 10,
      });
      res.json({ ok: true, items: data });
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
      const { soloSinVerificar, estado } = req.query;
      const comercios = await AdminService.listarComerciosAdmin({ soloSinVerificar: soloSinVerificar === 'true', estado: estado || null });
      res.json({ ok: true, data: comercios });
    } catch (e) { next(e); }
  },

  // PATCH /admin/comercios/:id/verificar
  async verificarComerciante(req, res, next) {
    try {
      const { accion, motivo } = req.body;
      const resultado = await AdminService.verificarComerciante(req.usuario.id, Number(req.params.id), { accion, motivo });
      res.json({ ok: true, data: resultado });
    } catch (e) { next(e); }
  },

  // PATCH /admin/comercios/:id/whatsapp-visible
  async toggleWhatsappVisible(req, res, next) {
    try {
      const id = Number(req.params.id);
      const comercio = await prisma.comercio.findUnique({ where: { id }, select: { id: true, whatsappVisible: true } });
      if (!comercio) throw new ErrorNoEncontrado("Comercio no encontrado");
      const activo = !comercio.whatsappVisible;
      const actualizado = await prisma.comercio.update({
        where: { id },
        data: {
          whatsappVisible:    activo,
          whatsappAprobadoPor: activo ? req.usuario.id : null,
          whatsappAprobadoAt:  activo ? new Date() : null,
        },
        select: { id: true, nombre: true, whatsappVisible: true },
      });
      await prisma.accionModeracion.create({
        data: { adminId: req.usuario.id, targetId: id, targetTipo: "COMERCIO", accion: activo ? "ACTIVAR_WHATSAPP" : "DESACTIVAR_WHATSAPP" },
      });
      res.json({ ok: true, data: actualizado });
    } catch (e) { next(e); }
  },

  // GET /admin/config
  async listarConfig(req, res, next) {
    try {
      const CLAVES_SENSIBLES = ["smtpPass", "smtp_pass", "smtp_password"];
      const data = await prisma.config.findMany({ orderBy: { clave: "asc" } });
      const filtrado = data.map(c =>
        CLAVES_SENSIBLES.includes(c.clave) ? { ...c, valor: "••••••••" } : c
      );
      res.json({ ok: true, data: filtrado });
    } catch (e) { next(e); }
  },

  // GET /admin/reglas — reglas de negocio agrupadas con su valor actual
  async listarReglas(req, res, next) {
    try {
      const grupos = await Reglas.todasConMeta();
      res.json({ ok: true, data: grupos });
    } catch (e) { next(e); }
  },

  // PUT /admin/config/:clave
  async actualizarConfig(req, res, next) {
    try {
      const { clave } = req.params;
      let { valor } = req.body;
      if (valor === undefined || valor === null || valor.toString().trim() === "")
        throw new ErrorValidacion("El valor es obligatorio");
      valor = valor.toString().trim();

      // Validación según el tipo definido en el Centro de Reglas.
      const def = Reglas.DEFAULTS[clave];
      if (def) {
        if (def.tipo === "bool" && !["true", "false"].includes(valor))
          throw new ErrorValidacion("Debe ser verdadero o falso");
        if (def.tipo === "numero") {
          const n = Number(valor);
          if (!Number.isFinite(n) || n < 0) throw new ErrorValidacion("Debe ser un número válido (mayor o igual a 0)");
        }
        if (def.tipo === "porcentaje_decimal") {
          const n = parseFloat(valor);
          if (isNaN(n) || n < 0 || n > 1)
            throw new ErrorValidacion("Debe ser un decimal entre 0 y 1 (ej: 0.10 = 10%)");
        }
        if (def.tipo === "select" && def.opciones && !def.opciones.includes(valor))
          throw new ErrorValidacion(`Valor inválido. Opciones: ${def.opciones.join(", ")}`);
      }

      const data = await prisma.config.upsert({
        where:  { clave },
        update: { valor },
        create: { clave, valor },
      });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /admin/pedidos — lista paginada con filtros opcionales
  async listarPedidos(req, res, next) {
    try {
      const pagina  = Math.max(1, parseInt(req.query.page   || "1",  10));
      const limite  = Math.min(100, parseInt(req.query.limit || "20", 10));
      const { estado, comercioId, compradorId } = req.query;

      const where = {};
      if (estado)      where.estado      = estado;
      if (compradorId) where.compradorId = Number(compradorId);
      if (comercioId)  where.subPedidos  = { some: { comercioId: Number(comercioId) } };

      const [total, items] = await Promise.all([
        prisma.pedido.count({ where }),
        prisma.pedido.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (pagina - 1) * limite,
          take: limite,
          include: {
            comprador: { select: { id: true, nombre: true, email: true, telefono: true } },
            subPedidos: { select: { id: true, estado: true, comercio: { select: { id: true, nombre: true } } } },
            pagos: { select: { id: true, monto: true, metodo: true, estado: true, createdAt: true } },
          },
        }),
      ]);

      const data = items.map(p => ({
        ...p,
        subtotal:       Number(p.subtotal),
        comisionTotal:  Number(p.comisionTotal),
        total:          Number(p.total),
        costoEnvio:     Number(p.costoEnvio ?? 0),
        cuponDescuento: p.cuponDescuento != null ? Number(p.cuponDescuento) : null,
        pagos: p.pagos.map(pg => ({ ...pg, monto: Number(pg.monto) })),
      }));

      res.json({
        ok: true,
        data: { items: data, total, pagina, paginas: Math.ceil(total / limite) },
      });
    } catch (e) { next(e); }
  },

  // GET /admin/pedidos/:id — detalle completo de un pedido
  async obtenerPedidoAdmin(req, res, next) {
    try {
      const id = Number(req.params.id);
      const p = await prisma.pedido.findUnique({
        where: { id },
        include: {
          comprador: { select: { id: true, nombre: true, email: true, telefono: true } },
          subPedidos: {
            include: {
              comercio: { select: { id: true, nombre: true, municipio: true } },
              items: {
                include: {
                  producto: { select: { id: true, nombre: true, fotoUrl: true } },
                },
              },
              entrega: true,
            },
          },
          pagos: true,
          cupon: { select: { id: true, codigo: true, tipo: true, valor: true } },
        },
      });

      if (!p) throw new ErrorNoEncontrado("Pedido no encontrado");

      const data = {
        ...p,
        subtotal:       Number(p.subtotal),
        comisionTotal:  Number(p.comisionTotal),
        total:          Number(p.total),
        costoEnvio:     Number(p.costoEnvio ?? 0),
        cuponDescuento: p.cuponDescuento != null ? Number(p.cuponDescuento) : null,
        subPedidos: p.subPedidos.map(sp => ({
          ...sp,
          subtotal:             Number(sp.subtotal),
          comision:             Number(sp.comision),
          neto:                 Number(sp.neto),
          tasaComisionAplicada: sp.tasaComisionAplicada != null ? Number(sp.tasaComisionAplicada) : null,
          items: sp.items.map(item => ({
            ...item,
            precioUnitario: Number(item.precioUnitario),
            subtotal:       Number(item.subtotal),
          })),
        })),
        pagos: p.pagos.map(pg => ({ ...pg, monto: Number(pg.monto) })),
        cupon: p.cupon ? { ...p.cupon, valor: Number(p.cupon.valor) } : null,
      };

      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // POST /admin/comercios/:id/comision
  async setComisionComercio(req, res, next) {
    try {
      const comercioId = Number(req.params.id);
      const { tasa, motivo, hasta } = req.body;
      if (tasa === undefined || tasa === null) throw new ErrorValidacion("La tasa es obligatoria");
      const tasaNum = parseFloat(tasa);
      if (isNaN(tasaNum) || tasaNum < 0 || tasaNum > 1) throw new ErrorValidacion("La tasa debe ser un número entre 0 y 1");

      // Cerrar rate activo anterior
      await prisma.comisionComercio.updateMany({
        where: { comercioId, hasta: null },
        data:  { hasta: new Date() },
      });
      const nueva = await prisma.comisionComercio.create({
        data: {
          comercioId,
          tasa:     tasaNum,
          motivo:   motivo?.trim() || null,
          hasta:    hasta ? new Date(hasta) : null,
          creadoPor: req.usuario.id,
        },
      });
      res.status(201).json({ ok: true, data: nueva });
    } catch (e) { next(e); }
  },

  // GET /admin/repartidores — lista todos los usuarios con rol REPARTIDOR
  async listarRepartidores(req, res, next) {
    try {
      const data = await prisma.usuario.findMany({
        where: { rol: "REPARTIDOR" },
        select: { id: true, nombre: true, email: true, telefono: true, createdAt: true },
        orderBy: { nombre: "asc" },
      });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // GET /admin/solicitudes-repartidor?estado=PENDIENTE
  async listarSolicitudesRepartidor(req, res, next) {
    try {
      const { estado } = req.query;
      const where = estado ? { estado } : {};
      const data = await prisma.solicitudRepartidor.findMany({
        where,
        include: {
          usuario: { select: { id: true, nombre: true, email: true, telefono: true, rol: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // PATCH /admin/solicitudes-repartidor/:id/revisar
  async revisarSolicitudRepartidor(req, res, next) {
    try {
      const id = Number(req.params.id);
      const { accion, notas } = req.body;
      if (!["APROBAR", "RECHAZAR"].includes(accion))
        throw new ErrorValidacion("accion debe ser APROBAR o RECHAZAR");

      const solicitud = await prisma.solicitudRepartidor.findUnique({ where: { id } });
      if (!solicitud) throw new ErrorNoEncontrado("Solicitud no encontrada");
      if (solicitud.estado !== "PENDIENTE")
        throw new ErrorValidacion("Esta solicitud ya fue revisada");

      const estadoFinal = accion === "APROBAR" ? "APROBADA" : "RECHAZADA";
      const [actualizada] = await prisma.$transaction([
        prisma.solicitudRepartidor.update({
          where: { id },
          data: {
            estado: estadoFinal,
            notasAdmin: notas?.trim() ?? null,
            revisadoPor: req.usuario.id,
            revisadoAt: new Date(),
          },
          include: {
            usuario: { select: { id: true, nombre: true, email: true, telefono: true } },
          },
        }),
        ...(accion === "APROBAR"
          ? [prisma.usuario.update({ where: { id: solicitud.usuarioId }, data: { rol: "REPARTIDOR" } })]
          : []),
      ]);

      // N-R-02 / N-R-03: notificar al solicitante
      setImmediate(async () => {
        try {
          if (accion === "APROBAR") {
            await NotificacionService.solicitudRepartidorAprobada({ usuario: actualizada.usuario });
          } else {
            await NotificacionService.solicitudRepartidorRechazada({
              usuario: actualizada.usuario,
              notasAdmin: notas?.trim() ?? null,
            });
          }
        } catch (e) {
          console.error("[NOTIF] revisar solicitud repartidor:", e.message);
        }
      });

      res.json({ ok: true, data: actualizada });
    } catch (e) { next(e); }
  },

  // POST /admin/repartidores — crea una cuenta de repartidor
  async crearRepartidor(req, res, next) {
    try {
      const { nombre, email, telefono, password } = req.body;
      if (!nombre?.trim()) throw new ErrorValidacion("El nombre es obligatorio");
      if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new ErrorValidacion("Email inválido");
      if (!telefono?.trim()) throw new ErrorValidacion("El teléfono es obligatorio");
      if (!password || password.length < 6)
        throw new ErrorValidacion("La contraseña debe tener al menos 6 caracteres");

      if (await UsuarioRepository.buscarPorEmail(email.toLowerCase().trim()))
        throw new ErrorValidacion("Ya existe una cuenta con ese correo");
      if (await UsuarioRepository.buscarPorTelefono(telefono.trim()))
        throw new ErrorValidacion("Ya existe una cuenta con ese teléfono");

      const passwordHash = await hashearPassword(password);
      const usuario = await UsuarioRepository.crear({
        nombre: nombre.trim(),
        email: email.toLowerCase().trim(),
        telefono: telefono.trim(),
        passwordHash,
        rol: "REPARTIDOR",
        autorizacionDatos: true,
        autorizacionFecha: new Date(),
        tipoDocumento: null,
        numeroDocumento: null,
      });

      res.status(201).json({
        ok: true,
        data: {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          telefono: usuario.telefono,
          rol: usuario.rol,
        },
      });
    } catch (e) { next(e); }
  },

  // GET /admin/usuarios — lista todos los usuarios con paginación y filtros
  async listarUsuarios(req, res, next) {
    try {
      const pagina  = Math.max(1, parseInt(req.query.pagina  || "1", 10));
      const limite  = 25;
      const rol     = req.query.rol  || undefined;
      const activo  = req.query.activo === "false" ? false : req.query.activo === "true" ? true : undefined;
      const q       = req.query.q?.trim() || undefined;

      const where = {};
      if (rol)    where.rol = rol;
      if (activo !== undefined) where.activo = activo;
      if (q) {
        where.OR = [
          { nombre: { contains: q, mode: "insensitive" } },
          { email:  { contains: q, mode: "insensitive" } },
        ];
      }

      const [total, items] = await Promise.all([
        prisma.usuario.count({ where }),
        prisma.usuario.findMany({
          where,
          select: {
            id: true, nombre: true, email: true, telefono: true,
            rol: true, activo: true, createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          skip: (pagina - 1) * limite,
          take: limite,
        }),
      ]);

      res.json({ ok: true, data: { items, total, pagina, paginas: Math.ceil(total / limite) } });
    } catch (e) { next(e); }
  },

  // PATCH /admin/usuarios/:id/activo — activa o desactiva un usuario
  async toggleActivoUsuario(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const { motivo } = req.body;
      const usuario = await prisma.usuario.findUnique({ where: { id }, select: { id: true, activo: true, rol: true } });
      if (!usuario) throw new ErrorNoEncontrado("Usuario no encontrado");
      if (usuario.rol === "ADMIN") throw new ErrorValidacion("No se puede desactivar a un administrador.");

      const bloqueando = usuario.activo;
      const dataUsuario = bloqueando
        ? { activo: false, motivoBloqueo: motivo?.trim() || null, bloqueadoPor: req.usuario.id, bloqueadoAt: new Date() }
        : { activo: true, motivoBloqueo: null, bloqueadoPor: null, bloqueadoAt: null };

      const [actualizado] = await prisma.$transaction([
        prisma.usuario.update({ where: { id }, data: dataUsuario, select: { id: true, nombre: true, activo: true, motivoBloqueo: true } }),
        // Si es comerciante, ocultar también su comercio del catálogo
        ...(usuario.rol === "COMERCIANTE"
          ? [prisma.comercio.updateMany({ where: { usuarioId: id }, data: { activo: !bloqueando } })]
          : []),
        // Log de moderación
        prisma.accionModeracion.create({
          data: {
            adminId: req.usuario.id,
            targetId: id,
            targetTipo: "USUARIO",
            accion: bloqueando ? "BLOQUEAR" : "ACTIVAR",
            motivo: motivo?.trim() || null,
          },
        }),
      ]);

      res.json({ ok: true, data: actualizado });
    } catch (e) { next(e); }
  },

  // GET /admin/categorias
  async listarCategorias(req, res, next) {
    try {
      const data = await prisma.categoria.findMany({ orderBy: { nombre: "asc" } });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // POST /admin/categorias
  async crearCategoria(req, res, next) {
    try {
      const { nombre, icono } = req.body;
      if (!nombre?.trim()) throw new ErrorValidacion("El nombre es obligatorio");
      const slug = nombre
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const data = await prisma.categoria.create({
        data: { nombre: nombre.trim(), slug, icono: icono?.trim() ?? null, activa: true },
      });
      res.status(201).json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // PATCH /admin/categorias/:id
  async actualizarCategoria(req, res, next) {
    try {
      const { nombre, icono } = req.body;
      const upd = {};
      if (nombre !== undefined) upd.nombre = nombre.trim();
      if (icono  !== undefined) upd.icono  = icono?.trim() ?? null;
      const data = await prisma.categoria.update({
        where: { id: Number(req.params.id) },
        data: upd,
      });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },

  // PATCH /admin/categorias/:id/activo
  async toggleActivoCategoria(req, res, next) {
    try {
      const c = await prisma.categoria.findUnique({ where: { id: Number(req.params.id) } });
      if (!c) throw new ErrorNoEncontrado("Categoría no encontrada");
      const data = await prisma.categoria.update({
        where: { id: c.id },
        data: { activa: !c.activa },
      });
      res.json({ ok: true, data });
    } catch (e) { next(e); }
  },
};

module.exports = AdminController;
