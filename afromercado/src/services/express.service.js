const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");
const { diaSemanaEnum, festivosAnio } = require("../utils/festivos-colombia");

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
    return cfg;
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

  async crearPedido({ clienteId, comercioId, modalidad, metodoPago, items, notaCliente, direccionTexto, municipioEntrega }) {
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

    const costoEnvio = modalidad === "DOMICILIO" ? Number(cfg.costoEnvioBase) : 0;
    const comision   = Math.round(subtotal * TASA_COMISION);
    const total      = subtotal + costoEnvio;
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

    return pedido;
  },

  // ── ACCIONES DEL COMERCIO ────────────────────────────────────

  async aceptarPedido(pedidoId, comercioId, tiempoAjustadoMin) {
    const pedido = await this._getPedidoComercio(pedidoId, comercioId);
    if (pedido.estado !== "PENDIENTE") throw new ErrorValidacion("El pedido ya no está en estado PENDIENTE");
    if (new Date() > pedido.expiresAt) throw new ErrorValidacion("El tiempo para aceptar el pedido expiró");
    return prisma.pedidoExpress.update({
      where: { id: pedidoId },
      data: { estado: "ACEPTADO", aceptadoAt: new Date(), tiempoAjustadoMin: tiempoAjustadoMin ?? null },
      include: { items: true },
    });
  },

  async rechazarPedido(pedidoId, comercioId, motivo) {
    const pedido = await this._getPedidoComercio(pedidoId, comercioId);
    if (!["PENDIENTE", "ACEPTADO"].includes(pedido.estado)) {
      throw new ErrorValidacion("No se puede rechazar un pedido en este estado");
    }
    return prisma.pedidoExpress.update({
      where: { id: pedidoId },
      data: { estado: "RECHAZADO", canceladoAt: new Date(), motivoCancelacion: motivo ?? "Rechazado por el comercio" },
    });
  },

  async avanzarEstado(pedidoId, comercioId) {
    const pedido = await this._getPedidoComercio(pedidoId, comercioId);
    const FLUJO = {
      ACEPTADO:      { siguiente: "EN_PREPARACION", campo: "preparandoAt" },
      EN_PREPARACION: { siguiente: "LISTO",           campo: "listoAt" },
      LISTO:          { siguiente: "EN_CAMINO",        campo: "enCaminoAt" },
      EN_CAMINO:      { siguiente: "ENTREGADO",        campo: "entregadoAt" },
    };
    const paso = FLUJO[pedido.estado];
    if (!paso) throw new ErrorValidacion(`No se puede avanzar desde el estado ${pedido.estado}`);

    const actualizado = await prisma.pedidoExpress.update({
      where: { id: pedidoId },
      data:  { estado: paso.siguiente, [paso.campo]: new Date() },
    });

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
                    calificacion: true, totalReviews: true },
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
      orderBy: [{ categoriaId: "asc" }, { nombre: "asc" }],
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
        cliente: { select: { nombre: true, telefono: true } },
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

  // ── HELPERS ──────────────────────────────────────────────────

  async _getPedidoComercio(pedidoId, comercioId) {
    const pedido = await prisma.pedidoExpress.findFirst({ where: { id: pedidoId, comercioId } });
    if (!pedido) throw new ErrorNoEncontrado("Pedido Express no encontrado");
    return pedido;
  },
};

module.exports = ExpressService;
