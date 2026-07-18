const prisma = require("../config/prisma");
const config = require("../config");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");
const { diaSemanaEnum, festivosAnio } = require("../utils/festivos-colombia");
const { enviarPushAUsuario } = require("../utils/push");
const sseManager = require("../utils/sse-manager");
const AlianzaService = require("./alianza.service");
const FacturacionService = require("./facturacion.service");
const {
  buscarCuponVertical, yaUsadoPorCliente, calcularDescuento,
  intentarAlianza, registrarUsoVertical, mapearCuponVertical,
} = require("../utils/cupon-vertical");

const DIAS_ORDEN = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO','FESTIVO'];

function ahoraEnColombia() {
  // Colombia = UTC-5 fijo (no cambia horario de verano)
  const utcMs = Date.now();
  return new Date(utcMs - 5 * 60 * 60 * 1000);
}

// Convierte un instante arbitrario (Date real, no ajustado) a la hora de pared en Colombia.
function fechaEnColombia(fecha) {
  return new Date(fecha.getTime() - 5 * 60 * 60 * 1000);
}

// `momento` es opcional: instante real (Date) a validar; por defecto usa "ahora".
function horaActualEnRango(apertura, cierre, momento) {
  if (apertura === '00:00' && cierre === '23:59') return true; // 24 horas
  const ref = momento ? fechaEnColombia(momento) : ahoraEnColombia();
  const hhmm = `${String(ref.getUTCHours()).padStart(2,'0')}:${String(ref.getUTCMinutes()).padStart(2,'0')}`;
  return hhmm >= apertura && hhmm < cierre;
}

// `momento` es opcional: instante real (Date) a validar; por defecto usa "ahora".
function comercioAbiertoAhora(horarios, momento) {
  if (!horarios || horarios.length === 0) return false;
  const ref = momento ? fechaEnColombia(momento) : ahoraEnColombia();
  const diaEnum = diaSemanaEnum(ref);
  const horario = horarios.find(h => h.dia === diaEnum);
  if (!horario || !horario.abierto) return false;
  return horaActualEnRango(horario.apertura, horario.cierre, momento);
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

const TIMEOUT_ACEPTACION_MIN = 3;

// Misma cascada que pedido.service.js usa para Marketplace: override por
// comercio (ComisionComercio vigente) > comisión global configurada en admin
// (Config["comision_global"]) > default de config/env.
async function resolverTasaComision(comercioId) {
  const ahora = new Date();
  const [override, configGlobal] = await Promise.all([
    prisma.comisionComercio.findFirst({
      where: { comercioId, desde: { lte: ahora }, OR: [{ hasta: null }, { hasta: { gt: ahora } }] },
      orderBy: { desde: "desc" },
    }),
    prisma.config.findUnique({ where: { clave: "comision_global" } }),
  ]);
  if (override) return Number(override.tasa);
  if (configGlobal) return parseFloat(configGlobal.valor);
  return config.comisionPorcentaje;
}

function generarCodigo() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `EX-${ts}-${rnd}`;
}

function grupoBibliotecaParaMenu(asignacion) {
  const grupo = asignacion.grupo;
  return {
    id: -asignacion.id,
    productoId: asignacion.productoId,
    nombre: grupo.nombre,
    minimo: asignacion.minimoOverride ?? grupo.minimo,
    maximo: asignacion.maximoOverride ?? grupo.maximo,
    requerido: asignacion.requeridoOverride ?? grupo.requerido,
    orden: asignacion.orden ?? grupo.orden,
    activo: asignacion.activo && grupo.activo,
    origen: "BIBLIOTECA",
    grupoBibliotecaId: grupo.id,
    items: (grupo.items || []).map((item) => ({
      id: -item.id,
      grupoComplementoId: -asignacion.id,
      nombre: item.nombre,
      icono: item.icono,
      imagenUrl: item.imagenUrl,
      precio: item.precio,
      disponible: item.disponible,
      orden: item.orden,
      origen: "BIBLIOTECA",
      itemBibliotecaId: item.id,
    })),
  };
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
    const { activo, tiempoPrepMinutos, municipiosEntrega, modalidades, costoEnvioBase, tipoEntregaDomicilio, horarios } = datos;
    const cfg = await prisma.configExpress.upsert({
      where:  { comercioId },
      update: { activo, tiempoPrepMinutos, municipiosEntrega, modalidades, costoEnvioBase, tipoEntregaDomicilio, updatedAt: new Date() },
      create: { comercioId, activo: activo ?? false,
                tiempoPrepMinutos: tiempoPrepMinutos ?? 20,
                municipiosEntrega: municipiosEntrega ?? [],
                modalidades: modalidades ?? ["RECOGER"],
                costoEnvioBase: costoEnvioBase ?? 3000,
                tipoEntregaDomicilio: tipoEntregaDomicilio ?? "PROPIO" },
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

  async crearPedido({ clienteId, comercioId, modalidad, metodoPago, items, notaCliente, direccionTexto, municipioEntrega, codigoCupon, fechaProgramada }) {
    const cfg = await prisma.configExpress.findUnique({
      where: { comercioId },
      include: { horarios: true },
    });
    if (!cfg) throw new ErrorNoEncontrado("Este comercio no tiene servicio Express");
    if (!cfg.activo) throw new ErrorValidacion("El servicio Express de este comercio no está activo");

    // Pedido programado: valida que la hora elegida caiga en un horario de apertura válido.
    // Pedido inmediato (fechaProgramada null/ausente): se comporta igual que siempre.
    let fechaProgramadaDate = null;
    if (fechaProgramada) {
      fechaProgramadaDate = new Date(fechaProgramada);
      if (isNaN(fechaProgramadaDate.getTime())) {
        throw new ErrorValidacion("fechaProgramada inválida");
      }
      if (fechaProgramadaDate.getTime() < Date.now()) {
        throw new ErrorValidacion("La fecha programada debe ser en el futuro");
      }
      if (!comercioAbiertoAhora(cfg.horarios, fechaProgramadaDate)) {
        throw new ErrorValidacion("La hora programada está fuera del horario de apertura del comercio");
      }
    } else {
      // Verificar horario automático + override manual de abierto
      const abiertoAhora = cfg.abierto && comercioAbiertoAhora(cfg.horarios);
      if (!abiertoAhora) throw new ErrorValidacion("El comercio está cerrado en este momento");
    }

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
      const precioBase = Number(prod.precio);
      const precioExtras = item.complementos ? item.complementos.reduce((s, c) => s + Number(c.precio), 0) : 0;
      const precioUnitario = precioBase + precioExtras;
      const sub = precioUnitario * item.cantidad;
      subtotal += sub;
      return {
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario,
        subtotal: sub,
        nota: item.nota ?? null,
        ...(item.complementos?.length ? { complementos: item.complementos } : {}),
      };
    });

    // Aplicar cupón si viene
    let montoDescuento = 0;
    let cuponAplicado = null;
    let descuentoEsAlianza = false;
    if (codigoCupon) {
      const validacion = await this.validarCuponExpress(codigoCupon, cfg.id, subtotal, clienteId, comercioId);
      montoDescuento = validacion.descuento;
      cuponAplicado = validacion.cupon;
      descuentoEsAlianza = !!validacion.esAlianza;
    }

    const costoEnvio = modalidad === "DOMICILIO" ? Number(cfg.costoEnvioBase) : 0;
    const tasaComision = await resolverTasaComision(comercioId);
    const comision   = Math.round((subtotal - montoDescuento) * tasaComision);
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
        fechaProgramada: fechaProgramadaDate,
        tiempoEstimadoMin: cfg.tiempoPrepMinutos + (modalidad === "DOMICILIO" ? 15 : 0),
        expiresAt,
        items: { create: itemsData },
      },
      include: { items: { include: { producto: { select: { nombre: true } } } } },
    });

    // Registrar uso del cupón (solo cupones propios; una alianza no tiene fila
    // CuponVertical que actualizar — su "un uso" ya lo garantiza AlianzaSocio)
    if (cuponAplicado && !descuentoEsAlianza) {
      await registrarUsoVertical(prisma, {
        cuponId: cuponAplicado.id, clienteId,
        tipoEntidad: "CONFIG_EXPRESS", entidadId: pedido.id,
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

    FacturacionService.emitirParaReferencia("EXPRESS", pedido.id).catch((e) =>
      console.error(`[FACTURACION] emisión fallida para PedidoExpress #${pedido.id}, quedará en reintento:`, e.message)
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

    // Fase 5 (Anexo B): si este pedido ya tiene una Entrega (modo PLATAFORMA
    // o activada puntualmente), LISTO→EN_CAMINO deja de ser del comerciante —
    // la controla el repartidor asignado vía /repartidor/entregas/:id/estado.
    if (pedido.estado === "LISTO") {
      const entregaExistente = await prisma.entrega.findUnique({ where: { pedidoExpressId: pedidoId } });
      if (entregaExistente) {
        throw new ErrorValidacion("Este pedido tiene un repartidor de la plataforma asignado; el estado lo actualiza él, no el comercio");
      }
    }

    const actualizado = await prisma.pedidoExpress.update({
      where: { id: pedidoId },
      data:  { estado: paso.siguiente, [paso.campo]: new Date() },
      include: PEDIDO_INCLUDE,
    });

    notifExpress(pedido.clienteId, paso.titulo, paso.cuerpo(pedido.codigo), "/express/mis-pedidos");

    // Fase 5: al quedar LISTO, si el restaurante usa repartidor de la
    // plataforma (modo PLATAFORMA) y el pedido es a domicilio, se crea la
    // Entrega y entra al pool compartido — mismo disparador que Marketplace
    // (SubPedido → LISTO en comercio.controller.js).
    if (paso.siguiente === "LISTO" && pedido.modalidad === "DOMICILIO") {
      const cfg = await prisma.configExpress.findUnique({
        where: { id: pedido.configExpressId },
        select: { tipoEntregaDomicilio: true },
      });
      if (cfg?.tipoEntregaDomicilio === "PLATAFORMA") {
        await this._crearEntregaExpress(pedido);
      }
    }

    // Si se entrega en efectivo → acumular deuda de comisión
    if (paso.siguiente === "ENTREGADO" && pedido.metodoPago === "EFECTIVO") {
      await prisma.configExpress.update({
        where: { id: pedido.configExpressId },
        data:  { deudaEfectivoActual: { increment: Number(pedido.comision) } },
      });
    }

    return actualizado;
  },

  async _crearEntregaExpress(pedido) {
    const existente = await prisma.entrega.findUnique({ where: { pedidoExpressId: pedido.id } });
    if (existente) return existente;
    return prisma.entrega.create({
      data: {
        pedidoExpressId: pedido.id,
        direccion: pedido.direccionTexto || pedido.municipioEntrega || "Sin dirección registrada",
        estado: "ASIGNADA",
      },
    });
  },

  // Válvula de escape (Fase 5): un restaurante en modo PROPIO puede, para un
  // pedido puntual que su domiciliario no puede cubrir, pasarlo al pool de
  // repartidores de la plataforma sin cambiar su configuración general.
  async activarRepartidorPlataforma(pedidoId, comercioId) {
    const pedido = await this._getPedidoComercio(pedidoId, comercioId);
    if (pedido.modalidad !== "DOMICILIO") {
      throw new ErrorValidacion("Solo los pedidos a domicilio necesitan repartidor");
    }
    if (["PENDIENTE", "ENTREGADO", "CANCELADO", "RECHAZADO"].includes(pedido.estado)) {
      throw new ErrorValidacion("Este pedido no puede pasar a repartidor de la plataforma en su estado actual");
    }
    const existente = await prisma.entrega.findUnique({ where: { pedidoExpressId: pedidoId } });
    if (existente) throw new ErrorValidacion("Este pedido ya tiene un repartidor de la plataforma asignado");
    return this._crearEntregaExpress(pedido);
  },

  // ── LISTADOS ─────────────────────────────────────────────────

  // Las reseñas de Express (ReviewExpress) nunca tocan Comercio.calificacion/
  // totalReviews (ese campo compartido lo actualiza Hotel y quedaría pisado
  // o vacío para comercios que solo venden por Express). Se calcula aparte,
  // directo desde ReviewExpress, y se sobreescribe en la respuesta.
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
    // Una foto real de plato > logo del comercio como imagen hero de la tarjeta.
    const platos = await prisma.producto.findMany({
      where: { comercioId: { in: configs.map(c => c.comercioId) }, esExpress: true, activo: true, deletedAt: null, fotoUrl: { not: null } },
      select: { comercioId: true, fotoUrl: true },
      orderBy: { createdAt: "desc" },
    });
    const fotoPorComercio = new Map();
    for (const p of platos) if (!fotoPorComercio.has(p.comercioId)) fotoPorComercio.set(p.comercioId, p.fotoUrl);
    const ahora = new Date();
    const cupones = await prisma.cuponVertical.findMany({
      where: { tipoEntidad: "CONFIG_EXPRESS", entidadId: { in: configs.map(c => c.id) }, activo: true, inicio: { lte: ahora }, fin: { gte: ahora } },
      select: { entidadId: true },
    });
    const conCupon = new Set(cupones.map(c => c.entidadId));
    // Enriquecer con estado abierto real basado en horario
    return configs.map(cfg => ({
      ...cfg,
      abiertoAhora: cfg.abierto && comercioAbiertoAhora(cfg.horarios),
      fotoPlato: fotoPorComercio.get(cfg.comercioId) ?? null,
      tieneCupon: conCupon.has(cfg.id),
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
      include: {
        categoria: { select: { id: true, nombre: true } },
        gruposComplemento: {
          where: { activo: true },
          orderBy: { orden: 'asc' },
          include: {
            items: { where: { disponible: true }, orderBy: { orden: 'asc' } },
          },
        },
        gruposComplementoAsignados: {
          where: { activo: true, grupo: { activo: true } },
          orderBy: { orden: 'asc' },
          include: {
            grupo: {
              include: {
                items: { where: { disponible: true }, orderBy: { orden: 'asc' } },
              },
            },
          },
        },
      },
      orderBy: [{ menuSeccionId: 'asc' }, { nombre: 'asc' }],
    });
    const productosConComplementos = productos.map((producto) => {
      const vinculados = (producto.gruposComplementoAsignados || []).map(grupoBibliotecaParaMenu);
      const { gruposComplementoAsignados, ...resto } = producto;
      return {
        ...resto,
        gruposComplemento: [...(producto.gruposComplemento || []), ...vinculados]
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)),
      };
    });
    return {
      ...cfg,
      abiertoAhora: cfg.abierto && comercioAbiertoAhora(cfg.horarios),
      productos: productosConComplementos,
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
        entrega: { select: { id: true } }, // Fase 5: si existe, el repartidor de la plataforma ya controla el estado
      },
    });
  },

  async listarPedidosCliente(clienteId) {
    const pedidos = await prisma.pedidoExpress.findMany({
      where: { clienteId },
      orderBy: { creadoAt: "desc" },
      take: 20,
      include: {
        items:    { include: { producto: { select: { nombre: true, fotoUrl: true } } } },
        configExpress: { include: { comercio: { select: { nombre: true, logoUrl: true } } } },
      },
    });
    // Resena (Fase 3) no tiene relación directa a PedidoExpress (entidadId
    // no es FK real) — se resuelve con una sola consulta por lote.
    if (pedidos.length === 0) return pedidos;
    const resenas = await prisma.resena.findMany({
      where: { tipoEntidad: "PEDIDO_EXPRESS", entidadId: { in: pedidos.map(p => p.id) }, autorId: clienteId },
      select: { id: true, entidadId: true },
    });
    const resenaPorPedido = new Map(resenas.map(r => [r.entidadId, r]));
    return pedidos.map(p => ({ ...p, review: resenaPorPedido.get(p.id) ?? null }));
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

  // ── FAVORITOS ─────────────────────────────────────────────────

  async toggleFavorito(usuarioId, configExpressId) {
    const existe = await prisma.favorito.findUnique({
      where: { usuarioId_tipoEntidad_entidadId: { usuarioId, tipoEntidad: "CONFIG_EXPRESS", entidadId: configExpressId } },
    });
    if (existe) {
      await prisma.favorito.delete({ where: { id: existe.id } });
      return { favorito: false };
    } else {
      await prisma.favorito.create({ data: { usuarioId, tipoEntidad: "CONFIG_EXPRESS", entidadId: configExpressId } });
      return { favorito: true };
    }
  },

  async misFavoritosExpress(usuarioId) {
    const favs = await prisma.favorito.findMany({
      where: { usuarioId, tipoEntidad: "CONFIG_EXPRESS" },
      orderBy: { createdAt: "desc" },
    });
    if (favs.length === 0) return [];
    const configs = await prisma.configExpress.findMany({
      where: { id: { in: favs.map(f => f.entidadId) } },
      include: {
        horarios: true,
        comercio: {
          select: { id: true, nombre: true, logoUrl: true, municipio: true,
                    calificacion: true, totalReviews: true, latitud: true, longitud: true },
        },
      },
    });
    const porId = new Map(configs.map(c => [c.id, c]));
    const ordenados = favs.map(f => porId.get(f.entidadId)).filter(Boolean);
    const platos = ordenados.length ? await prisma.producto.findMany({
      where: { comercioId: { in: ordenados.map(c => c.comercioId) }, esExpress: true, activo: true, deletedAt: null, fotoUrl: { not: null } },
      select: { comercioId: true, fotoUrl: true },
      orderBy: { createdAt: "desc" },
    }) : [];
    const fotoPorComercio = new Map();
    for (const p of platos) if (!fotoPorComercio.has(p.comercioId)) fotoPorComercio.set(p.comercioId, p.fotoUrl);
    return ordenados.map(c => ({
      ...c,
      abiertoAhora: c.abierto && comercioAbiertoAhora(c.horarios),
      fotoPlato: fotoPorComercio.get(c.comercioId) ?? null,
    }));
  },

  async esFavoritoExpress(usuarioId, configExpressId) {
    const existe = await prisma.favorito.findUnique({
      where: { usuarioId_tipoEntidad_entidadId: { usuarioId, tipoEntidad: "CONFIG_EXPRESS", entidadId: configExpressId } },
    });
    return { favorito: !!existe };
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

  async validarCuponExpress(codigo, configExpressId, subtotal, clienteId, comercioId) {
    const cupon = await buscarCuponVertical(prisma, { codigo, tipoEntidad: "CONFIG_EXPRESS", entidadId: configExpressId });
    if (!cupon) {
      const alianza = await intentarAlianza(comercioId, codigo, "EXPRESS", subtotal);
      if (alianza) {
        return {
          cupon: { codigo: alianza.codigo },
          descuento: alianza.descuento,
          subtotalConDescuento: Number(subtotal) - alianza.descuento,
          esAlianza: true,
        };
      }
      throw new ErrorValidacion("Cupón inválido o expirado");
    }
    if (cupon.usosMaximos && cupon.usosActuales >= cupon.usosMaximos) {
      throw new ErrorValidacion("Este cupón ya alcanzó su límite de usos");
    }
    if (cupon.minimoAplicable && Number(subtotal) < Number(cupon.minimoAplicable)) {
      throw new ErrorValidacion(`Subtotal mínimo requerido: $${Number(cupon.minimoAplicable).toLocaleString("es-CO")}`);
    }
    if (await yaUsadoPorCliente(prisma, cupon.id, clienteId)) {
      throw new ErrorValidacion("Ya usaste este cupón anteriormente");
    }
    const descuento = calcularDescuento(cupon, subtotal);
    return { cupon, descuento, subtotalConDescuento: Number(subtotal) - descuento };
  },

  async listarCuponesExpress(comercioId) {
    const cfg = await prisma.configExpress.findUnique({ where: { comercioId } });
    if (!cfg) return [];
    const cupones = await prisma.cuponVertical.findMany({
      where: { tipoEntidad: "CONFIG_EXPRESS", entidadId: cfg.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { usos: true } } },
    });
    return cupones.map((c) => mapearCuponVertical(c, "minimoSubtotal", "configExpressId", { _count: c._count }));
  },

  async crearCuponExpress(comercioId, datos) {
    const cfg = await prisma.configExpress.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorValidacion("Activa primero el módulo Express");
    const { codigo, tipo, valor, minimoSubtotal, usosMaximos, inicio, fin } = datos;
    if (!codigo?.trim()) throw new ErrorValidacion("El código es requerido");
    if (!valor || Number(valor) <= 0) throw new ErrorValidacion("El valor debe ser positivo");
    if (tipo === "PORCENTAJE" && Number(valor) > 100) throw new ErrorValidacion("El porcentaje no puede superar 100");
    const cupon = await prisma.cuponVertical.create({
      data: {
        codigo: codigo.trim().toUpperCase(),
        tipoEntidad: "CONFIG_EXPRESS",
        tipo: tipo ?? "PORCENTAJE",
        valor: Number(valor),
        minimoAplicable: minimoSubtotal ? Number(minimoSubtotal) : null,
        usosMaximos: usosMaximos ? Number(usosMaximos) : null,
        activo: true,
        inicio: new Date(inicio),
        fin:    new Date(fin),
        entidadId: cfg.id,
      },
    });
    return mapearCuponVertical(cupon, "minimoSubtotal", "configExpressId");
  },

  async eliminarCuponExpress(comercioId, cuponId) {
    const cfg = await prisma.configExpress.findUnique({ where: { comercioId } });
    if (!cfg) throw new ErrorNoEncontrado("Config no encontrada");
    const cupon = await prisma.cuponVertical.findFirst({
      where: { id: cuponId, tipoEntidad: "CONFIG_EXPRESS", entidadId: cfg.id },
    });
    if (!cupon) throw new ErrorNoEncontrado("Cupón no encontrado");
    return prisma.cuponVertical.update({ where: { id: cuponId }, data: { activo: false } });
  },

  // ── ESTADÍSTICAS EXPRESS ──────────────────────────────────────

  async estadisticasExpress(comercioId, { desde, hasta } = {}) {
    const hoy = new Date();
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const inicioSemana = new Date(inicioHoy);
    inicioSemana.setDate(inicioHoy.getDate() - 6);
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const hace30dias = new Date(Date.now() - 30 * 86400000);

    const [hoyStats, semanaStats, mesStats, porHora, topProductos, ultimosPedidos, itemsComplementos] = await Promise.all([
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
      // Items con complementos (últimos 30 días) — para agregar top complementos en JS
      prisma.itemPedidoExpress.findMany({
        where: {
          pedidoExpress: { comercioId, estado: "ENTREGADO", creadoAt: { gte: hace30dias } },
        },
        select: { complementos: true, cantidad: true },
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

    const topComplementos = this._agregarTopComplementos(itemsComplementos);

    const resultado = {
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
      topComplementos,
      ultimosPedidos,
    };

    // Rango de fechas puntual (opcional, para consultas contables)
    if (desde && hasta) {
      const inicioRango = new Date(`${desde}T00:00:00-05:00`);
      const finRango = new Date(`${hasta}T23:59:59-05:00`);

      const [rangoStats, rangoTopProductos, rangoItemsComplementos] = await Promise.all([
        prisma.pedidoExpress.aggregate({
          where: { comercioId, estado: "ENTREGADO", entregadoAt: { gte: inicioRango, lte: finRango } },
          _count: { id: true },
          _sum: { total: true, comision: true },
        }),
        prisma.itemPedidoExpress.groupBy({
          by: ["productoId"],
          where: {
            pedidoExpress: { comercioId, estado: "ENTREGADO", entregadoAt: { gte: inicioRango, lte: finRango } },
          },
          _sum: { cantidad: true },
          _count: { id: true },
          orderBy: { _sum: { cantidad: "desc" } },
          take: 5,
        }),
        prisma.itemPedidoExpress.findMany({
          where: {
            pedidoExpress: { comercioId, estado: "ENTREGADO", entregadoAt: { gte: inicioRango, lte: finRango } },
          },
          select: { complementos: true, cantidad: true },
        }),
      ]);

      const rangoProductoIds = rangoTopProductos.map(p => p.productoId);
      const rangoProductos = await prisma.producto.findMany({
        where: { id: { in: rangoProductoIds } },
        select: { id: true, nombre: true, fotoUrl: true },
      });
      const rangoProdMap = Object.fromEntries(rangoProductos.map(p => [p.id, p]));

      resultado.rango = {
        pedidos: rangoStats._count.id,
        ingresos: Number(rangoStats._sum.total ?? 0),
        comision: Number(rangoStats._sum.comision ?? 0),
        topProductos: rangoTopProductos.map(p => ({
          producto: rangoProdMap[p.productoId] ?? { id: p.productoId, nombre: "Desconocido", fotoUrl: null },
          cantidad: p._sum.cantidad ?? 0,
          pedidos: p._count.id,
        })),
        topComplementos: this._agregarTopComplementos(rangoItemsComplementos),
        desde,
        hasta,
      };
    }

    return resultado;
  },

  // Suma cantidades por nombre de complemento a partir de filas { complementos, cantidad } y devuelve el top 5
  _agregarTopComplementos(items) {
    const acumulado = {};
    for (const item of items) {
      if (!Array.isArray(item.complementos)) continue;
      for (const c of item.complementos) {
        if (!c || !c.nombre) continue;
        acumulado[c.nombre] = (acumulado[c.nombre] ?? 0) + item.cantidad;
      }
    }
    return Object.entries(acumulado)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);
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

  async crearSeccion(comercioId, { nombre, icono, orden, vistaCompacta }) {
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
        vistaCompacta: !!vistaCompacta,
      },
    });
  },

  async actualizarSeccion(comercioId, seccionId, { nombre, icono, orden, activo, vistaCompacta }) {
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
        ...(vistaCompacta !== undefined && { vistaCompacta: !!vistaCompacta }),
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

  // ── COMPLEMENTOS ──────────────────────────────────────────────

  async listarBibliotecaComplementos(comercioId, productoId) {
    const prod = await prisma.producto.findFirst({ where: { id: productoId, comercioId } });
    if (!prod) throw new ErrorNoEncontrado("Producto no encontrado");

    const [grupos, asignaciones] = await Promise.all([
      prisma.grupoComplementoBiblioteca.findMany({
        where: { comercioId },
        orderBy: [{ orden: "asc" }, { nombre: "asc" }],
        include: { items: { orderBy: { orden: "asc" } } },
      }),
      prisma.productoGrupoComplemento.findMany({
        where: { productoId },
        orderBy: { orden: "asc" },
        include: { grupo: { include: { items: { orderBy: { orden: "asc" } } } } },
      }),
    ]);

    return { grupos, asignaciones };
  },

  async crearGrupoBiblioteca(comercioId, { nombre, minimo, maximo, requerido, orden }) {
    if (!nombre?.trim()) throw new ErrorValidacion("El nombre del grupo es requerido");
    try {
      return await prisma.grupoComplementoBiblioteca.create({
        data: {
          comercioId,
          nombre: nombre.trim(),
          minimo: minimo ?? 0,
          maximo: maximo ?? 1,
          requerido: requerido ?? false,
          orden: orden ?? 0,
        },
        include: { items: { orderBy: { orden: "asc" } } },
      });
    } catch (err) {
      if (err.code === "P2002") throw new ErrorValidacion("Ya existe un grupo con ese nombre en tu biblioteca");
      throw err;
    }
  },

  async actualizarGrupoBiblioteca(comercioId, grupoId, datos) {
    const grupo = await prisma.grupoComplementoBiblioteca.findFirst({ where: { id: grupoId, comercioId } });
    if (!grupo) throw new ErrorNoEncontrado("Grupo de biblioteca no encontrado");
    const { nombre, minimo, maximo, requerido, orden, activo } = datos;
    try {
      return await prisma.grupoComplementoBiblioteca.update({
        where: { id: grupoId },
        data: {
          ...(nombre !== undefined && { nombre: nombre.trim() }),
          ...(minimo !== undefined && { minimo }),
          ...(maximo !== undefined && { maximo }),
          ...(requerido !== undefined && { requerido }),
          ...(orden !== undefined && { orden }),
          ...(activo !== undefined && { activo }),
        },
        include: { items: { orderBy: { orden: "asc" } } },
      });
    } catch (err) {
      if (err.code === "P2002") throw new ErrorValidacion("Ya existe un grupo con ese nombre en tu biblioteca");
      throw err;
    }
  },

  async eliminarGrupoBiblioteca(comercioId, grupoId) {
    const grupo = await prisma.grupoComplementoBiblioteca.findFirst({ where: { id: grupoId, comercioId } });
    if (!grupo) throw new ErrorNoEncontrado("Grupo de biblioteca no encontrado");
    await prisma.grupoComplementoBiblioteca.delete({ where: { id: grupoId } });
  },

  async crearItemBiblioteca(comercioId, grupoId, { nombre, icono, precio, disponible, orden }) {
    if (!nombre?.trim()) throw new ErrorValidacion("El nombre del item es requerido");
    const grupo = await prisma.grupoComplementoBiblioteca.findFirst({ where: { id: grupoId, comercioId } });
    if (!grupo) throw new ErrorNoEncontrado("Grupo de biblioteca no encontrado");
    return prisma.itemComplementoBiblioteca.create({
      data: {
        grupoBibliotecaId: grupoId,
        nombre: nombre.trim(),
        icono: icono ?? null,
        precio: precio ?? 0,
        disponible: disponible ?? true,
        orden: orden ?? 0,
      },
    });
  },

  async actualizarItemBiblioteca(comercioId, itemId, datos) {
    const item = await prisma.itemComplementoBiblioteca.findFirst({
      where: { id: itemId },
      include: { grupo: { select: { comercioId: true } } },
    });
    if (!item || item.grupo.comercioId !== comercioId) throw new ErrorNoEncontrado("Item de biblioteca no encontrado");
    const { nombre, icono, precio, disponible, orden } = datos;
    return prisma.itemComplementoBiblioteca.update({
      where: { id: itemId },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(icono !== undefined && { icono }),
        ...(precio !== undefined && { precio }),
        ...(disponible !== undefined && { disponible }),
        ...(orden !== undefined && { orden }),
      },
    });
  },

  async eliminarItemBiblioteca(comercioId, itemId) {
    const item = await prisma.itemComplementoBiblioteca.findFirst({
      where: { id: itemId },
      include: { grupo: { select: { comercioId: true } } },
    });
    if (!item || item.grupo.comercioId !== comercioId) throw new ErrorNoEncontrado("Item de biblioteca no encontrado");
    await prisma.itemComplementoBiblioteca.delete({ where: { id: itemId } });
  },

  async vincularGrupoBibliotecaProducto(comercioId, productoId, grupoId, datos = {}) {
    const [prod, grupo] = await Promise.all([
      prisma.producto.findFirst({ where: { id: productoId, comercioId } }),
      prisma.grupoComplementoBiblioteca.findFirst({ where: { id: grupoId, comercioId } }),
    ]);
    if (!prod) throw new ErrorNoEncontrado("Producto no encontrado");
    if (!grupo) throw new ErrorNoEncontrado("Grupo de biblioteca no encontrado");

    return prisma.productoGrupoComplemento.upsert({
      where: { productoId_grupoBibliotecaId: { productoId, grupoBibliotecaId: grupoId } },
      update: {
        activo: true,
        ...(datos.minimoOverride !== undefined && { minimoOverride: datos.minimoOverride }),
        ...(datos.maximoOverride !== undefined && { maximoOverride: datos.maximoOverride }),
        ...(datos.requeridoOverride !== undefined && { requeridoOverride: datos.requeridoOverride }),
        ...(datos.orden !== undefined && { orden: datos.orden }),
      },
      create: {
        productoId,
        grupoBibliotecaId: grupoId,
        minimoOverride: datos.minimoOverride ?? null,
        maximoOverride: datos.maximoOverride ?? null,
        requeridoOverride: datos.requeridoOverride ?? null,
        orden: datos.orden ?? grupo.orden ?? 0,
      },
      include: { grupo: { include: { items: { orderBy: { orden: "asc" } } } } },
    });
  },

  async desvincularGrupoBibliotecaProducto(comercioId, productoId, grupoId) {
    const [prod, grupo] = await Promise.all([
      prisma.producto.findFirst({ where: { id: productoId, comercioId } }),
      prisma.grupoComplementoBiblioteca.findFirst({ where: { id: grupoId, comercioId } }),
    ]);
    if (!prod) throw new ErrorNoEncontrado("Producto no encontrado");
    if (!grupo) throw new ErrorNoEncontrado("Grupo de biblioteca no encontrado");
    await prisma.productoGrupoComplemento.deleteMany({
      where: { productoId, grupoBibliotecaId: grupoId },
    });
  },

  async listarComplementos(comercioId, productoId) {
    const prod = await prisma.producto.findFirst({ where: { id: productoId, comercioId } });
    if (!prod) throw new ErrorNoEncontrado("Producto no encontrado");
    return prisma.grupoComplemento.findMany({
      where: { productoId },
      include: { items: { orderBy: { orden: 'asc' } } },
      orderBy: { orden: 'asc' },
    });
  },

  async crearGrupoComplemento(comercioId, productoId, { nombre, minimo, maximo, requerido, orden }) {
    const prod = await prisma.producto.findFirst({ where: { id: productoId, comercioId } });
    if (!prod) throw new ErrorNoEncontrado("Producto no encontrado");
    return prisma.grupoComplemento.create({
      data: {
        productoId,
        nombre: nombre.trim(),
        minimo:   minimo   ?? 0,
        maximo:   maximo   ?? 1,
        requerido: requerido ?? false,
        orden:    orden    ?? 0,
      },
      include: { items: true },
    });
  },

  async actualizarGrupoComplemento(comercioId, grupoId, datos) {
    const grupo = await prisma.grupoComplemento.findFirst({
      where: { id: grupoId },
      include: { producto: { select: { comercioId: true } } },
    });
    if (!grupo || grupo.producto.comercioId !== comercioId) throw new ErrorNoEncontrado("Grupo no encontrado");
    const { nombre, minimo, maximo, requerido, orden, activo } = datos;
    return prisma.grupoComplemento.update({
      where: { id: grupoId },
      data: {
        ...(nombre    !== undefined && { nombre: nombre.trim() }),
        ...(minimo    !== undefined && { minimo }),
        ...(maximo    !== undefined && { maximo }),
        ...(requerido !== undefined && { requerido }),
        ...(orden     !== undefined && { orden }),
        ...(activo    !== undefined && { activo }),
      },
      include: { items: { orderBy: { orden: 'asc' } } },
    });
  },

  async eliminarGrupoComplemento(comercioId, grupoId) {
    const grupo = await prisma.grupoComplemento.findFirst({
      where: { id: grupoId },
      include: { producto: { select: { comercioId: true } } },
    });
    if (!grupo || grupo.producto.comercioId !== comercioId) throw new ErrorNoEncontrado("Grupo no encontrado");
    await prisma.grupoComplemento.delete({ where: { id: grupoId } });
  },

  async crearItemComplemento(comercioId, grupoId, { nombre, icono, precio, disponible, orden }) {
    const grupo = await prisma.grupoComplemento.findFirst({
      where: { id: grupoId },
      include: { producto: { select: { comercioId: true } } },
    });
    if (!grupo || grupo.producto.comercioId !== comercioId) throw new ErrorNoEncontrado("Grupo no encontrado");
    return prisma.itemComplemento.create({
      data: {
        grupoComplementoId: grupoId,
        nombre: nombre.trim(),
        icono:      icono      ?? null,
        precio:     precio     ?? 0,
        disponible: disponible ?? true,
        orden:      orden      ?? 0,
      },
    });
  },

  async actualizarItemComplemento(comercioId, itemId, datos) {
    const item = await prisma.itemComplemento.findFirst({
      where: { id: itemId },
      include: { grupo: { include: { producto: { select: { comercioId: true } } } } },
    });
    if (!item || item.grupo.producto.comercioId !== comercioId) throw new ErrorNoEncontrado("Item no encontrado");
    const { nombre, icono, precio, disponible, orden } = datos;
    return prisma.itemComplemento.update({
      where: { id: itemId },
      data: {
        ...(nombre     !== undefined && { nombre: nombre.trim() }),
        ...(icono      !== undefined && { icono }),
        ...(precio     !== undefined && { precio }),
        ...(disponible !== undefined && { disponible }),
        ...(orden      !== undefined && { orden }),
      },
    });
  },

  async copiarGrupoATodosLosProductos(comercioId, grupoId) {
    // Cargar el grupo origen con sus ítems
    const grupoOrigen = await prisma.grupoComplemento.findFirst({
      where: { id: grupoId },
      include: {
        items: true,
        producto: { select: { comercioId: true, id: true } },
      },
    });
    if (!grupoOrigen || grupoOrigen.producto.comercioId !== comercioId) throw new ErrorNoEncontrado("Grupo no encontrado");

    // Todos los productos Express activos del comercio (excepto el que ya lo tiene)
    const productos = await prisma.producto.findMany({
      where: { comercioId, esExpress: true, activo: true, deletedAt: null, id: { not: grupoOrigen.productoId } },
      select: { id: true },
    });

    let creados = 0;
    for (const prod of productos) {
      // Verificar que no exista ya un grupo con el mismo nombre en ese producto
      const existe = await prisma.grupoComplemento.findFirst({
        where: { productoId: prod.id, nombre: grupoOrigen.nombre },
      });
      if (existe) continue;
      const nuevoGrupo = await prisma.grupoComplemento.create({
        data: {
          productoId: prod.id,
          nombre:    grupoOrigen.nombre,
          minimo:    grupoOrigen.minimo,
          maximo:    grupoOrigen.maximo,
          requerido: grupoOrigen.requerido,
          orden:     grupoOrigen.orden,
          activo:    grupoOrigen.activo,
        },
      });
      if (grupoOrigen.items.length) {
        await prisma.itemComplemento.createMany({
          data: grupoOrigen.items.map(i => ({
            grupoComplementoId: nuevoGrupo.id,
            nombre:     i.nombre,
            icono:      i.icono,
            imagenUrl:  i.imagenUrl ?? null,
            precio:     i.precio,
            disponible: i.disponible,
            orden:      i.orden,
          })),
        });
      }
      creados++;
    }
    return { productosActualizados: creados };
  },

  async eliminarItemComplemento(comercioId, itemId) {
    const item = await prisma.itemComplemento.findFirst({
      where: { id: itemId },
      include: { grupo: { include: { producto: { select: { comercioId: true } } } } },
    });
    if (!item || item.grupo.producto.comercioId !== comercioId) throw new ErrorNoEncontrado("Item no encontrado");
    await prisma.itemComplemento.delete({ where: { id: itemId } });
  },
};

module.exports = ExpressService;
