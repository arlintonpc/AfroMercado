const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");
const { diaSemanaEnum, festivosAnio } = require("../utils/festivos-colombia");
const { enviarPushAUsuario } = require("../utils/push");
const sseManager = require("../utils/sse-manager");

const DIAS_ORDEN = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO','FESTIVO'];

function ahoraEnColombia() {
  // Colombia = UTC-5 fijo (no cambia horario de verano)
  const utcMs = Date.now();
  return new Date(utcMs - 5 * 60 * 60 * 1000);
}

function horaActualEnRango(apertura, cierre) {
  if (apertura === '00:00' && cierre === '23:59') return true; // 24 horas
  const ahora = ahoraEnColombia();
  const hhmm = `${String(ahora.getUTCHours()).padStart(2,'0')}:${String(ahora.getUTCMinutes()).padStart(2,'0')}`;
  return hhmm >= apertura && hhmm < cierre;
}

function comercioAbiertoAhora(horarios) {
  if (!horarios || horarios.length === 0) return false;
  const hoy = ahoraEnColombia();
  const diaEnum = diaSemanaEnum(hoy);
  const horario = horarios.find(h => h.dia === diaEnum);
  if (!horario || !horario.abierto) return false;
  return horaActualEnRango(horario.apertura, horario.cierre);
}

async function notifExpress(usuarioId, titulo, cuerpo, url) {
  if (!usuarioId) return;
  try {
    await prisma.notificacion.create({
      data: { usuarioId, tipo: "EXPRESS", titulo, mensaje: cuerpo, url: url || null },
    });
    sseManager.enviar(usuarioId, "notificacion", { tipo: "EXPRESS", titulo, mensaje: cuerpo, url });
    await enviarPushAUsuario(prisma, usuarioId, { titulo, cuerpo, url, icono: "/icon-192.svg" });
  } catch (e) {
    console.error("[NOTIF-EXPRESS]", e.message);
  }
}

async function usuarioDelComercio(comercioId) {
  const c = await prisma.comercio.findUnique({ where: { id: comercioId }, select: { usuarioId: true } });
  return c?.usuarioId ?? null;
}

const PEDIDO_INCLUDE = {
  items: { include: { producto: { select: { nombre: true, fotoUrl: true } } } },
  cliente: { select: { nombre: true, email: true, telefono: true } },
};

const TASA_COMISION = 0.10;
const TIMEOUT_ACEPTACION_MIN = 3;

function generarCodigo() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `EX-${ts}-${rnd}`;
}

const ExpressService = {

  // ── CONFIG DEL COMERCIO ──────────────────────────────────────

  async obtenerConfig(comercioId) {
    let cfg = await prisma.configExpress.findUnique({
      where: { comercioId },
      include: { horarios: { orderBy: { dia: 'asc' } } },
    });
    if (!cfg) {
      cfg = await prisma.configExpress.create({
        data: { comercioId, modalidades: ["RECOGER"] },
        include: { horarios: true },
      });
    }
    return { ...cfg, abiertoAhora: cfg.abierto && comercioAbiertoAhora(cfg.horarios) };
  },

  async actualizarConfig(comercioId, datos) {
    const { activo, tiempoPrepMinutos, municipiosEntrega, modalidades, costoEnvioBase, horarios } = datos;
    const cfg = await prisma.configExpress.upsert({
      where:  { comercioId },
      update: { activo, tiempoPrepMinutos, municipiosEntrega, modalidades, costoEnvioBase, updatedAt: new Date() },
      create: { comercioId, activo: activo ?? false,
                tiempoPrepMinutos: tiempoPrepMinutos ?? 20,
                municipiosEntrega: municipiosEntrega ?? [],
                modalidades: modalidades ?? ["RECOGER"],
                costoEnvioBase: costoEnvioBase ?? 3000 },
    });

    // Upsert horarios por día si vienen en el payload
    if (Array.isArray(horarios) && horarios.length > 0) {
      for (const h of horarios) {
        await prisma.horarioExpress.upsert({
          where:  { configExpressId_dia: { configExpressId: cfg.id, dia: h.dia } },
          update: { abierto: h.abierto, apertura: h.apertura, cierre: h.cierre },
          create: { configExpressId: cfg.id, dia: h.dia, abierto: h.abierto ?? true,
                    apertura: h.apertura ?? '07:00', cierre: h.cierre ?? '20:00' },
        });
      }
    }

    return prisma.configExpress.findUnique({
      where: { comercioId },
      include: { horarios: { orderBy: { dia: 'asc' } } },
    });
  },

  async toggleAbierto(comercioId, abierto) {
    const cfg = await prisma.configExpress.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Configura primero el perfil Express");
    if (!cfg.activo) throw new ErrorValidacion("El módulo Express no está activo para este comercio");
    return prisma.configExpress.update({ where: { comercioId }, data: { abierto } });
  },

  async festivosAnio(anio) {
    const año = anio ?? new Date().getFullYear();
    return { anio: año, festivos: festivosAnio(año) };
  },

  // ── CREAR PEDIDO (CLIENTE) ───────────────────────────────────

  async crearPedido({ clienteId, comercioId, modalidad, metodoPago, items, notaCliente, direccionTexto, municipioEntrega, codigoCupon }) {
    const cfg = await prisma.configExpress.findUnique({
      where: { comercioId },
      include: { horarios: true },
    });
    if (!cfg) throw new ErrorNoEncontrado("Este comercio no tiene servicio Express");
    if (!cfg.activo) throw new ErrorValidacion("El servicio Express de este comercio no está activo");
    // Verificar horario automático + override manual de abierto
    const abiertoAhora = cfg.abierto && comercioAbiertoAhora(cfg.horarios);
    if (!abiertoAhora) throw new ErrorValidacion("El comercio está cerrado en este momento");
    if (!cfg.modalidades.includes(modalidad)) {
      throw new ErrorValidacion(`Este comercio no ofrece la modalidad ${modalidad}`);
    }
    if (modalidad === "DOMICILIO" && !direccionTexto) {
      throw new ErrorValidacion("Debes indicar la dirección de entrega");
    }

    // Verificar límite de crédito en efectivo
    if (metodoPago === "EFECTIVO") {
      const limite = Number(cfg.limiteCreditoEfectivo);
      const deuda  = Number(cfg.deudaEfectivoActual);
      if (deuda >= limite) {
        throw new ErrorValidacion("Este comercio no puede aceptar pagos en efectivo en este momento");
      }
    }

    // Calcular totales
    const productoIds = items.map(i => i.productoId);
    const productos = await prisma.producto.findMany({
      where: { id: { in: productoIds }, activo: true, comercioId },
      select: { id: true, nombre: true, precio: true },
    });
    if (productos.length !== productoIds.length) {
      throw new ErrorValidacion("Uno o más productos no están disponibles");
    }
    const prodMap = Object.fromEntries(productos.map(p => [p.id, p]));

    let subtotal = 0;
    const itemsData = items.map(item => {
      const prod = prodMap[item.productoId];
      const precioUnitario = Number(prod.precio);
      const sub = precioUnitario * item.cantidad;
      subtotal += sub;
      return { productoId: item.productoId, cantidad: item.cantidad,
               precioUnitario, subtotal: sub, nota: item.nota ?? null };
    });

    // Aplicar cupón si viene
    let montoDescuento = 0;
    let cuponAplicado = null;
    if (codigoCupon) {
      const validacion = await this.validarCuponExpress(codigoCupon, cfg.id, subtotal, clienteId);
      montoDescuento = validacion.descuento;
      cuponAplicado = validacion.cupon;
    }

    const costoEnvio = modalidad === "DOMICILIO" ? Number(cfg.costoEnvioBase) : 0;
    const comision   = Math.round((subtotal - montoDescuento) * TASA_COMISION);
    const total      = subtotal - montoDescuento + costoEnvio;
    const expiresAt  = new Date(Date.now() + TIMEOUT_ACEPTACION_MIN * 60 * 1000);

    const pedido = await prisma.pedidoExpress.create({
      data: {
        codigo: generarCodigo(),
        comercioId,
        clienteId,
        configExpressId: cfg.id,
        modalidad,
        metodoPago,
        subtotal,
        costoEnvio,
        comision,
        montoDescuento: montoDescuento > 0 ? montoDescuento : null,
        codigoCupon: cuponAplicado?.codigo ?? null,
        total,
        notaCliente,
        direccionTexto,
        municipioEntrega,
        tiempoEstimadoMin: cfg.tiempoPrepMinutos + (modalidad === "DOMICILIO" ? 15 : 0),
        expiresAt,
        items: { create: itemsData },
      },
      include: { items: { include: { producto: { select: { nombre: true } } } } },
    });

    // Registrar uso del cupón
    if (cuponAplicado) {
      await prisma.cuponExpressUso.create({
        data: { cuponExpressId: cuponAplicado.id, clienteId, pedidoExpressId: pedido.id },
      });
      await prisma.cuponExpress.update({
        where: { id: cuponAplicado.id },
        data: { usosActuales: { increment: 1 } },
      });
    }

    // Notificar al comerciante
    const uidComerciante = await usuarioDelComercio(comercioId);
    notifExpress(uidComerciante,
      "🛵 Nuevo pedido Express",
      `Pedido ${pedido.codigo} · $${Number(total).toLocaleString("es-CO")}`,
      "/comerciante/express"
    );
    // Notificar al cliente
    notifExpress(clienteId,
      "⚡ Pedido recibido",
      `Tu pedido ${pedido.codigo} está siendo revisado por el restaurante`,
      "/express/mis-pedidos"
    );

    return pedido;
  },

  // ── ACCIONES DEL COMERCIO ────────────────────────────────────

  async aceptarPedido(pedidoId, comercioId, tiempoAjustadoMin) {
    const pedido = await this._getPedidoComercio(pedidoId, comercioId);
    if (pedido.estado !== "PENDIENTE") throw new ErrorValidacion("El pedido ya no está en estado PENDIENTE");
    if (new Date() > pedido.expiresAt) throw new ErrorValidacion("El tiempo para aceptar el pedido expiró");
    const actualizado = await prisma.pedidoExpress.update({
      where: { id: pedidoId },
      data: { estado: "ACEPTADO", aceptadoAt: new Date(), tiempoAjustadoMin: tiempoAjustadoMin ?? null },
      include: PEDIDO_INCLUDE,
    });
    notifExpress(pedido.clienteId,
      "✅ Pedido aceptado",
      `Tu pedido ${pedido.codigo} fue aceptado · listo en ~${actualizado.tiempoEstimadoMin ?? pedido.tiempoEstimadoMin} min`,
      "/express/mis-pedidos"
    );
    return actualizado;
  },

  async rechazarPedido(pedidoId, comercioId, motivo) {
    const pedido = await this._getPedidoComercio(pedidoId, comercioId);
    if (!["PENDIENTE", "ACEPTADO"].includes(pedido.estado)) {
      throw new ErrorValidacion("No se puede rechazar un pedido en este estado");
    }
    const actualizado = await prisma.pedidoExpress.update({
      where: { id: pedidoId },
      data: { estado: "RECHAZADO", canceladoAt: new Date(), motivoCancelacion: motivo ?? "Rechazado por el comercio" },
      include: PEDIDO_INCLUDE,
    });
    notifExpress(pedido.clienteId,
      "❌ Pedido rechazado",
      `Tu pedido ${pedido.codigo} no pudo ser atendido${motivo ? `: ${motivo}` : ""}`,
      "/express/mis-pedidos"
    );
    return actualizado;
  },

  async avanzarEstado(pedidoId, comercioId) {
    const pedido = await this._getPedidoComercio(pedidoId, comercioId);
    const FLUJO = {
      ACEPTADO:       { siguiente: "EN_PREPARACION", campo: "preparandoAt",
                        titulo: "👨‍🍳 En preparación", cuerpo: (c) => `Tu pedido ${c} está siendo preparado` },
      EN_PREPARACION: { siguiente: "LISTO",           campo: "listoAt",
                        titulo: "✅ ¡Pedido listo!",   cuerpo: (c) => `Tu pedido ${c} está listo para recoger / envío` },
      LISTO:          { siguiente: "EN_CAMINO",        campo: "enCaminoAt",
                        titulo: "🛵 En camino",         cuerpo: (c) => `Tu pedido ${c} está en camino hacia ti` },
      EN_CAMINO:      { siguiente: "ENTREGADO",        campo: "entregadoAt",
                        titulo: "🎉 Pedido entregado",  cuerpo: (c) => `Tu pedido ${c} fue entregado. ¡Buen provecho!` },
    };
    const paso = FLUJO[pedido.estado];
    if (!paso) throw new ErrorValidacion(`No se puede avanzar desde el estado ${pedido.estado}`);

    const actualizado = await prisma.pedidoExpress.update({
      where: { id: pedidoId },
      data:  { estado: paso.siguiente, [paso.campo]: new Date() },
      include: PEDIDO_INCLUDE,
    });

    notifExpress(pedido.clienteId, paso.titulo, paso.cuerpo(pedido.codigo), "/express/mis-pedidos");

    // Si se entrega en efectivo → acumular deuda de comisión
    if (paso.siguiente === "ENTREGADO" && pedido.metodoPago === "EFECTIVO") {
      await prisma.configExpress.update({
        where: { id: pedido.configExpressId },
        data:  { deudaEfectivoActual: { increment: Number(pedido.comision) } },
      });
    }

    return actualizado;
  },

  // ── LISTADOS ─────────────────────────────────────────────────

  async listarComerciosExpress(municipio) {
    const where = { activo: true };
    if (municipio) where.municipiosEntrega = { has: municipio };
    const configs = await prisma.configExpress.findMany({
      where,
      include: {
        horarios: true,
        comercio: {
          select: { id: true, nombre: true, logoUrl: true, municipio: true,
                    calificacion: true, totalReviews: true, latitud: true, longitud: true },
        },
      },
    });
    // Enriquecer con estado abierto real basado en horario
    return configs.map(cfg => ({
      ...cfg,
      abiertoAhora: cfg.abierto && comercioAbiertoAhora(cfg.horarios),
    }));
  },

  async obtenerMenuComercio(comercioId) {
    const cfg = await prisma.configExpress.findUnique({
      where: { comercioId },
      include: {
        horarios: true,
        secciones: {
          where: { activo: true },
          orderBy: { orden: 'asc' },
        },
        comercio: {
          select: { id: true, nombre: true, logoUrl: true, municipio: true,
                    calificacion: true, totalReviews: true, whatsapp: true },
        },
      },
    });
    if (!cfg || !cfg.activo) return null;
    const productos = await prisma.producto.findMany({
      where: { comercioId, esExpress: true, activo: true, deletedAt: null },
      include: { categoria: { select: { id: true, nombre: true } } },
      orderBy: [{ menuSeccionId: 'asc' }, { nombre: 'asc' }],
    });
    return {
      ...cfg,
      abiertoAhora: cfg.abierto && comercioAbiertoAhora(cfg.horarios),
      productos,
    };
  },

  async listarPedidosComercio(comercioId, estado) {
    const where = { comercioId };
    if (estado) where.estado = estado;
    return prisma.pedidoExpress.findMany({
      where,
      orderBy: { creadoAt: "desc" },
      take: 50,
      include: {
        items: { include: { producto: { select: { nombre: true, fotoUrl: true } } } },
        cliente: { select: { nombre: true, email: true, telefono: true } },
      },
    });
  },

  async listarPedidosCliente(clienteId) {
    return prisma.pedidoExpress.findMany({
      where: { clienteId },
      orderBy: { creadoAt: "desc" },
      take: 20,
      include: {
        items:    { include: { producto: { select: { nombre: true, fotoUrl: true } } } },
        configExpress: { include: { comercio: { select: { nombre: true, logoUrl: true } } } },
        review: { select: { id: true } },
      },
    });
  },

  async obtenerPedido(id) {
    const pedido = await prisma.pedidoExpress.findUnique({
      where: { id },
      include: {
        items:    { include: { producto: { select: { nombre: true, fotoUrl: true, precio: true } } } },
        cliente:  { select: { nombre: true, telefono: true } },
        configExpress: { include: { comercio: { select: { nombre: true, logoUrl: true, municipio: true } } } },
      },
    });
    if (!pedido) throw new ErrorNoEncontrado("Pedido Express no encontrado");
    return pedido;
  },

  // ── ADMIN ────────────────────────────────────────────────────

  async listarDeudasAdmin() {
    return prisma.configExpress.findMany({
      where: { deudaEfectivoActual: { gt: 0 } },
      include: { comercio: { select: { id: true, nombre: true, municipio: true } } },
      orderBy: { deudaEfectivoActual: "desc" },
    });
  },

  async saldarDeudaAdmin(comercioId, monto) {
    const cfg = await prisma.configExpress.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Comercio sin config Express");
    const nuevaDeuda = Math.max(0, Number(cfg.deudaEfectivoActual) - Number(monto));
    return prisma.configExpress.update({
      where: { comercioId },
      data:  { deudaEfectivoActual: nuevaDeuda },
    });
  },

  async actualizarLimiteCreditoAdmin(comercioId, limite) {
    return prisma.configExpress.update({
      where: { comercioId },
      data:  { limiteCreditoEfectivo: limite },
    });
  },

  // ── CRON: cancelar pedidos expirados ─────────────────────────

  async cancelarExpirados() {
    const result = await prisma.pedidoExpress.updateMany({
      where:  { estado: "PENDIENTE", expiresAt: { lt: new Date() } },
      data:   { estado: "CANCELADO", canceladoAt: new Date(), motivoCancelacion: "Tiempo de aceptación expirado" },
    });
    return result.count;
  },

  // ── CUPONES EXPRESS ──────────────────────────────────────────

  async validarCuponExpress(codigo, configExpressId, subtotal, clienteId) {
    const cupon = await prisma.cuponExpress.findFirst({
      where: {
        codigo: codigo.trim().toUpperCase(),
        activo: true,
        fin:   { gte: new Date() },
        inicio: { lte: new Date() },
        OR: [
          { configExpressId: null },
          { configExpressId },
        ],
      },
    });
    if (!cupon) throw new ErrorValidacion("Cupón inválido o expirado");
    if (cupon.usosMaximos && cupon.usosActuales >= cupon.usosMaximos) {
      throw new ErrorValidacion("Este cupón ya alcanzó su límite de usos");
    }
    if (cupon.minimoSubtotal && Number(subtotal) < Number(cupon.minimoSubtotal)) {
      throw new ErrorValidacion(`Subtotal mínimo requerido: $${Number(cupon.minimoSubtotal).toLocaleString("es-CO")}`);
    }
    // Verificar que el cliente no lo haya usado antes
    if (clienteId) {
      const yaUso = await prisma.cuponExpressUso.findFirst({
        where: { cuponExpressId: cupon.id, clienteId },
      });
      if (yaUso) throw new ErrorValidacion("Ya usaste este cupón anteriormente");
    }
    const descuento = cupon.tipo === "PORCENTAJE"
      ? Math.round(Number(subtotal) * Number(cupon.valor) / 100)
      : Math.min(Number(cupon.valor), Number(subtotal));
    return { cupon, descuento, subtotalConDescuento: Number(subtotal) - descuento };
  },

  async listarCuponesExpress(comercioId) {
    const cfg = await prisma.configExpress.findUnique({ where: { comercioId } });
    if (!cfg) return [];
    return prisma.cuponExpress.findMany({
      where: { configExpressId: cfg.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { usos: true } } },
    });
  },

  async crearCuponExpress(comercioId, datos) {
    const cfg = await prisma.configExpress.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorValidacion("Activa primero el módulo Express");
    const { codigo, tipo, valor, minimoSubtotal, usosMaximos, inicio, fin } = datos;
    if (!codigo?.trim()) throw new ErrorValidacion("El código es requerido");
    if (!valor || Number(valor) <= 0) throw new ErrorValidacion("El valor debe ser positivo");
    if (tipo === "PORCENTAJE" && Number(valor) > 100) throw new ErrorValidacion("El porcentaje no puede superar 100");
    return prisma.cuponExpress.create({
      data: {
        codigo: codigo.trim().toUpperCase(),
        tipo: tipo ?? "PORCENTAJE",
        valor: Number(valor),
        minimoSubtotal: minimoSubtotal ? Number(minimoSubtotal) : null,
        usosMaximos: usosMaximos ? Number(usosMaximos) : null,
        activo: true,
        inicio: new Date(inicio),
        fin:    new Date(fin),
        configExpressId: cfg.id,
      },
    });
  },

  async eliminarCuponExpress(comercioId, cuponId) {
    const cfg = await prisma.configExpress.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Config no encontrada");
    const cupon = await prisma.cuponExpress.findFirst({
      where: { id: cuponId, configExpressId: cfg.id },
    });
    if (!cupon) throw new ErrorNoEncontrado("Cupón no encontrado");
    return prisma.cuponExpress.update({ where: { id: cuponId }, data: { activo: false } });
  },

  // ── ESTADÍSTICAS EXPRESS ──────────────────────────────────────

  async estadisticasExpress(comercioId) {
    const hoy = new Date();
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const inicioSemana = new Date(inicioHoy);
    inicioSemana.setDate(inicioHoy.getDate() - 6);
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    const [hoyStats, semanaStats, mesStats, porHora, topProductos, ultimosPedidos] = await Promise.all([
      // Hoy
      prisma.pedidoExpress.aggregate({
        where: { comercioId, estado: "ENTREGADO", entregadoAt: { gte: inicioHoy } },
        _count: { id: true },
        _sum: { total: true, comision: true },
      }),
      // Últimos 7 días
      prisma.pedidoExpress.aggregate({
        where: { comercioId, estado: "ENTREGADO", entregadoAt: { gte: inicioSemana } },
        _count: { id: true },
        _sum: { total: true, comision: true },
      }),
      // Este mes
      prisma.pedidoExpress.aggregate({
        where: { comercioId, estado: "ENTREGADO", entregadoAt: { gte: inicioMes } },
        _count: { id: true },
        _sum: { total: true, comision: true },
      }),
      // Pedidos por hora del día (últimos 30 días)
      prisma.pedidoExpress.findMany({
        where: { comercioId, estado: "ENTREGADO", creadoAt: { gte: new Date(Date.now() - 30 * 86400000) } },
        select: { creadoAt: true },
      }),
      // Top 5 productos más pedidos (últimos 30 días)
      prisma.itemPedidoExpress.groupBy({
        by: ["productoId"],
        where: {
          pedidoExpress: { comercioId, estado: "ENTREGADO", creadoAt: { gte: new Date(Date.now() - 30 * 86400000) } },
        },
        _sum: { cantidad: true },
        _count: { id: true },
        orderBy: { _sum: { cantidad: "desc" } },
        take: 5,
      }),
      // Últimos 10 pedidos de cualquier estado
      prisma.pedidoExpress.findMany({
        where: { comercioId },
        orderBy: { creadoAt: "desc" },
        take: 10,
        select: { id: true, codigo: true, estado: true, total: true, creadoAt: true, modalidad: true },
      }),
    ]);

    // Calcular distribución por hora
    const horaCount = Array(24).fill(0);
    for (const p of porHora) {
      const hora = new Date(p.creadoAt).getUTCHours() - 5; // UTC-5 Colombia
      horaCount[((hora % 24) + 24) % 24]++;
    }

    // Obtener nombres de productos top
    const productoIds = topProductos.map(p => p.productoId);
    const productos = await prisma.producto.findMany({
      where: { id: { in: productoIds } },
      select: { id: true, nombre: true, fotoUrl: true },
    });
    const prodMap = Object.fromEntries(productos.map(p => [p.id, p]));

    return {
      hoy: {
        pedidos: hoyStats._count.id,
        ingresos: Number(hoyStats._sum.total ?? 0),
        comision: Number(hoyStats._sum.comision ?? 0),
      },
      semana: {
        pedidos: semanaStats._count.id,
        ingresos: Number(semanaStats._sum.total ?? 0),
        comision: Number(semanaStats._sum.comision ?? 0),
      },
      mes: {
        pedidos: mesStats._count.id,
        ingresos: Number(mesStats._sum.total ?? 0),
        comision: Number(mesStats._sum.comision ?? 0),
      },
      horasPico: horaCount,
      topProductos: topProductos.map(p => ({
        producto: prodMap[p.productoId] ?? { id: p.productoId, nombre: "Desconocido", fotoUrl: null },
        cantidad: p._sum.cantidad ?? 0,
        pedidos: p._count.id,
      })),
      ultimosPedidos,
    };
  },

  // ── HELPERS ──────────────────────────────────────────────────

  async _getPedidoComercio(pedidoId, comercioId) {
    const pedido = await prisma.pedidoExpress.findFirst({ where: { id: pedidoId, comercioId } });
    if (!pedido) throw new ErrorNoEncontrado("Pedido Express no encontrado");
    return pedido;
  },

  // ── SECCIONES DE MENÚ ────────────────────────────────────────

  async listarSecciones(comercioId) {
    const cfg = await prisma.configExpress.findUnique({ where: { comercioId } });
    if (!cfg) return [];
    return prisma.menuSeccion.findMany({
      where: { configExpressId: cfg.id },
      orderBy: { orden: 'asc' },
    });
  },

  async crearSeccion(comercioId, { nombre, icono, orden }) {
    const cfg = await prisma.configExpress.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorValidacion("Activa primero el módulo Express");
    if (!nombre?.trim()) throw new ErrorValidacion("El nombre es requerido");
    const maxOrden = await prisma.menuSeccion.aggregate({
      where: { configExpressId: cfg.id },
      _max: { orden: true },
    });
    return prisma.menuSeccion.create({
      data: {
        configExpressId: cfg.id,
        nombre: nombre.trim(),
        icono: icono ?? '🍽️',
        orden: orden ?? (maxOrden._max.orden ?? -1) + 1,
      },
    });
  },

  async actualizarSeccion(comercioId, seccionId, { nombre, icono, orden, activo }) {
    const cfg = await prisma.configExpress.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Config no encontrada");
    const seccion = await prisma.menuSeccion.findFirst({
      where: { id: seccionId, configExpressId: cfg.id },
    });
    if (!seccion) throw new ErrorNoEncontrado("Sección no encontrada");
    return prisma.menuSeccion.update({
      where: { id: seccionId },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(icono  !== undefined && { icono }),
        ...(orden  !== undefined && { orden }),
        ...(activo !== undefined && { activo }),
      },
    });
  },

  async eliminarSeccion(comercioId, seccionId) {
    const cfg = await prisma.configExpress.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Config no encontrada");
    const seccion = await prisma.menuSeccion.findFirst({
      where: { id: seccionId, configExpressId: cfg.id },
    });
    if (!seccion) throw new ErrorNoEncontrado("Sección no encontrada");
    await prisma.producto.updateMany({
      where: { menuSeccionId: seccionId },
      data: { menuSeccionId: null },
    });
    await prisma.menuSeccion.delete({ where: { id: seccionId } });
  },

  async asignarSeccionProducto(comercioId, productoId, menuSeccionId) {
    const prod = await prisma.producto.findFirst({
      where: { id: productoId, comercioId },
    });
    if (!prod) throw new ErrorNoEncontrado("Producto no encontrado");
    if (menuSeccionId === null) {
      return prisma.producto.update({ where: { id: productoId }, data: { menuSeccionId: null } });
    }
    const cfg = await prisma.configExpress.findUnique({ where: { comercioId } });
    const sec = cfg && await prisma.menuSeccion.findFirst({
      where: { id: menuSeccionId, configExpressId: cfg.id },
    });
    if (!sec) throw new ErrorNoEncontrado("Sección no encontrada");
    return prisma.producto.update({ where: { id: productoId }, data: { menuSeccionId } });
  },

  // ── VIDEO EXPRESS ─────────────────────────────────────────────

  async subirVideoExpress(comercioId, videoUrl, posterUrl, duracion) {
    const config = await prisma.configExpress.findUnique({ where: { comercioId } });
    if (!config) throw new Error("Config express no encontrada");
    return prisma.configExpress.update({
      where: { comercioId },
      data: { videoUrl, videoPosterUrl: posterUrl },
    });
  },

  async quitarVideoExpress(comercioId) {
    return prisma.configExpress.update({
      where: { comercioId },
      data: { videoUrl: null, videoPosterUrl: null },
    });
  },

  async guardarVideoLinkExpress(comercioId, videoUrl) {
    return prisma.configExpress.update({ where: { comercioId }, data: { videoUrl, videoPosterUrl: null } });
  },
};

module.exports = ExpressService;
