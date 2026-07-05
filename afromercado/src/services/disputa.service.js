// ============================================================
//  Servicio de Disputas — reclamos post-compra (Fase 1: reporte + mediación)
//
//  IMPORTANTE: un reembolso aprobado aquí NUNCA revierte el pago en Wompi
//  (la dispersión al comercio ya ocurrió y no existe capacidad de reversa
//  en wompi.provider.js). El monto aprobado se descuenta de la siguiente
//  Liquidacion del comercio (ver liquidacion.controller.js), y la
//  devolución real al comprador es un paso manual que el admin marca con
//  marcarTransferido().
// ============================================================
const prisma = require("../config/prisma");
const ComercioRepository = require("../repositories/comercio.repository");
const ConfigRepository = require("../repositories/config.repository");
const { ErrorValidacion, ErrorNoEncontrado, ErrorProhibido } = require("../utils/errores");
const NotificacionService = require("./notificacion.service");
const FacturacionService = require("./facturacion.service");

const MODULOS_VALIDOS = ["PEDIDO", "EXPRESS", "HOTEL", "TOUR", "TRANSPORTE"];
const ESTADOS_RESOLVIBLES = ["ABIERTA", "RESPONDIDA_COMERCIO"];
const VENTANA_REPORTE_HORAS_DEFAULT = 72;
const VENTANA_RESPUESTA_HORAS_DEFAULT = 48;
const TASA_COMISION_DEFAULT = 0.10; // fallback si un módulo no guarda su propia comisión (ver Transporte)

async function horasDesdeConfig(clave, porDefecto) {
  const valor = await ConfigRepository.obtener(clave);
  const num = Number(valor);
  return Number.isFinite(num) && num > 0 ? num : porDefecto;
}

/**
 * Resuelve comercioId, compradorId "esperado" (dueño real de la referencia) y los
 * montos snapshot (bruto/neto) para cualquiera de los 5 módulos. Es el único lugar
 * que conoce el detalle de cada módulo — cualquier módulo nuevo se agrega aquí.
 *
 * OJO: para moduloOrigen "PEDIDO", referenciaId es SubPedido.id, NO Pedido.id,
 * porque un Pedido puede tener varios SubPedido (uno por comercio).
 */
async function resolverReferencia(moduloOrigen, referenciaId) {
  if (moduloOrigen === "PEDIDO") {
    const subPedido = await prisma.subPedido.findUnique({
      where: { id: referenciaId },
      include: { pedido: { select: { compradorId: true } } },
    });
    if (!subPedido) throw new ErrorNoEncontrado("Subpedido no encontrado");
    if (subPedido.estado !== "ENTREGADO") {
      throw new ErrorValidacion("Solo puedes reportar un problema sobre un pedido ya entregado");
    }
    return {
      comercioId: subPedido.comercioId,
      compradorIdEsperado: subPedido.pedido.compradorId,
      montoOriginal: Number(subPedido.subtotal),
      montoNetoOriginal: Number(subPedido.neto),
      fechaEventoTerminal: subPedido.updatedAt,
    };
  }

  if (moduloOrigen === "EXPRESS") {
    const pedido = await prisma.pedidoExpress.findUnique({ where: { id: referenciaId } });
    if (!pedido) throw new ErrorNoEncontrado("Pedido Express no encontrado");
    if (pedido.estado !== "ENTREGADO") {
      throw new ErrorValidacion("Solo puedes reportar un problema sobre un pedido ya entregado");
    }
    const bruto = Number(pedido.subtotal);
    const comision = Number(pedido.comision ?? 0);
    return {
      comercioId: pedido.comercioId,
      compradorIdEsperado: pedido.clienteId,
      montoOriginal: bruto,
      montoNetoOriginal: bruto - comision,
      fechaEventoTerminal: pedido.entregadoAt ?? pedido.updatedAt,
    };
  }

  if (moduloOrigen === "HOTEL") {
    const reserva = await prisma.reservaHotel.findUnique({
      where: { id: referenciaId },
      include: { configHotel: { select: { comercioId: true } } },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva de hotel no encontrada");
    if (reserva.estado !== "CHECKOUT") {
      throw new ErrorValidacion("Solo puedes reportar un problema sobre una estadía ya finalizada (checkout)");
    }
    const bruto = Number(reserva.total);
    const comision = Number(reserva.comision ?? bruto * TASA_COMISION_DEFAULT);
    return {
      comercioId: reserva.configHotel.comercioId,
      compradorIdEsperado: reserva.clienteId,
      montoOriginal: bruto,
      montoNetoOriginal: bruto - comision,
      fechaEventoTerminal: reserva.updatedAt,
    };
  }

  if (moduloOrigen === "TOUR") {
    const reserva = await prisma.reservaTour.findUnique({
      where: { id: referenciaId },
      include: { configTour: { select: { comercioId: true } } },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva de tour no encontrada");
    if (reserva.estado !== "COMPLETADA") {
      throw new ErrorValidacion("Solo puedes reportar un problema sobre un tour ya completado");
    }
    const bruto = Number(reserva.total);
    const comision = Number(reserva.comision ?? bruto * TASA_COMISION_DEFAULT);
    return {
      comercioId: reserva.configTour.comercioId,
      compradorIdEsperado: reserva.clienteId,
      montoOriginal: bruto,
      montoNetoOriginal: bruto - comision,
      fechaEventoTerminal: reserva.updatedAt,
    };
  }

  if (moduloOrigen === "TRANSPORTE") {
    const reserva = await prisma.reservaTransporte.findUnique({
      where: { id: referenciaId },
      include: { ruta: { include: { configTransporte: { select: { comercioId: true } } } } },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva de transporte no encontrada");
    if (reserva.estado !== "COMPLETADA") {
      throw new ErrorValidacion("Solo puedes reportar un problema sobre un viaje ya completado");
    }
    // ReservaTransporte no guarda su propia comisión/tasa (a diferencia de los
    // demás módulos) — se resuelve contra la comisión vigente del comercio en
    // ComisionComercio, con fallback a la tasa por defecto de la plataforma.
    const bruto = Number(reserva.total);
    const comercioId = reserva.ruta.configTransporte.comercioId;
    const comisionVigente = await prisma.comisionComercio.findFirst({
      where: {
        comercioId,
        desde: { lte: reserva.creadoAt },
        OR: [{ hasta: null }, { hasta: { gte: reserva.creadoAt } }],
      },
      orderBy: { desde: "desc" },
    });
    const tasa = comisionVigente ? Number(comisionVigente.tasa) : TASA_COMISION_DEFAULT;
    return {
      comercioId,
      compradorIdEsperado: reserva.clienteId,
      montoOriginal: bruto,
      montoNetoOriginal: bruto - bruto * tasa,
      fechaEventoTerminal: reserva.updatedAt,
    };
  }

  throw new ErrorValidacion(`Módulo inválido. Opciones: ${MODULOS_VALIDOS.join(", ")}`);
}

const DisputaService = {
  async crear(usuarioId, { moduloOrigen, referenciaId, motivo, descripcion, evidenciaUrls, montoReembolsoSolicitado }) {
    if (!MODULOS_VALIDOS.includes(moduloOrigen)) {
      throw new ErrorValidacion(`Módulo inválido. Opciones: ${MODULOS_VALIDOS.join(", ")}`);
    }
    if (!descripcion || !descripcion.trim()) {
      throw new ErrorValidacion("Describe el problema para poder revisarlo.");
    }

    const info = await resolverReferencia(moduloOrigen, Number(referenciaId));
    if (info.compradorIdEsperado !== usuarioId) {
      throw new ErrorProhibido("Esta compra no pertenece a tu cuenta.");
    }

    const ventanaHoras = await horasDesdeConfig("DISPUTA_VENTANA_HORAS", VENTANA_REPORTE_HORAS_DEFAULT);
    const limiteMs = new Date(info.fechaEventoTerminal).getTime() + ventanaHoras * 3600_000;
    if (Date.now() > limiteMs) {
      throw new ErrorValidacion(`Ya pasó el plazo de ${ventanaHoras} horas para reportar un problema sobre esta compra.`);
    }

    const abiertaExistente = await prisma.disputa.findFirst({
      where: {
        moduloOrigen,
        referenciaId: Number(referenciaId),
        estado: { notIn: ["RESUELTA_RECHAZADA", "RESUELTA_REEMBOLSO_TOTAL", "RESUELTA_REEMBOLSO_PARCIAL", "CERRADA_SIN_RESPUESTA"] },
      },
    });
    if (abiertaExistente) {
      throw new ErrorValidacion("Ya tienes un reclamo en curso sobre esta compra.");
    }

    const disputa = await prisma.disputa.create({
      data: {
        moduloOrigen,
        referenciaId: Number(referenciaId),
        compradorId: usuarioId,
        comercioId: info.comercioId,
        motivo,
        descripcion: descripcion.trim(),
        evidenciaUrls: Array.isArray(evidenciaUrls) ? evidenciaUrls : [],
        montoOriginal: info.montoOriginal,
        montoNetoOriginal: info.montoNetoOriginal,
        montoReembolsoSolicitado: montoReembolsoSolicitado !== undefined ? Number(montoReembolsoSolicitado) : null,
      },
    });

    NotificacionService.disputaCreada({ disputa }).catch((e) => console.error("[DISPUTA] notificar creación:", e.message));

    return disputa;
  },

  async responderComercio(usuarioId, disputaId, { respuesta, evidenciaUrls }) {
    if (!respuesta || !respuesta.trim()) {
      throw new ErrorValidacion("Escribe tu respuesta antes de enviarla.");
    }
    const comercio = await ComercioRepository.buscarPorUsuarioId(usuarioId);
    if (!comercio) throw new ErrorNoEncontrado("No tienes un comercio registrado");

    const disputa = await prisma.disputa.findUnique({ where: { id: Number(disputaId) } });
    if (!disputa || disputa.comercioId !== comercio.id) {
      throw new ErrorNoEncontrado("Reclamo no encontrado");
    }

    const { count } = await prisma.disputa.updateMany({
      where: { id: disputa.id, estado: "ABIERTA" },
      data: {
        respuestaComercio: respuesta.trim(),
        respuestaComercioUrls: Array.isArray(evidenciaUrls) ? evidenciaUrls : [],
        respondidoPor: usuarioId,
        respondidoAt: new Date(),
        estado: "RESPONDIDA_COMERCIO",
      },
    });
    if (count !== 1) {
      throw new ErrorValidacion("Este reclamo ya no admite respuesta (ya fue resuelto o ya respondiste antes).");
    }

    const actualizada = await prisma.disputa.findUnique({ where: { id: disputa.id } });
    NotificacionService.disputaRespondidaComercio({ disputa: actualizada }).catch((e) => console.error("[DISPUTA] notificar respuesta:", e.message));
    return actualizada;
  },

  async resolver(adminId, disputaId, { accion, motivo, montoReembolsoAprobado }) {
    const ACCIONES = ["RECHAZAR", "APROBAR_TOTAL", "APROBAR_PARCIAL"];
    if (!ACCIONES.includes(accion)) {
      throw new ErrorValidacion(`Acción inválida. Opciones: ${ACCIONES.join(", ")}`);
    }

    const disputa = await prisma.disputa.findUnique({ where: { id: Number(disputaId) } });
    if (!disputa) throw new ErrorNoEncontrado("Reclamo no encontrado");
    if (!ESTADOS_RESOLVIBLES.includes(disputa.estado)) {
      throw new ErrorValidacion("Este reclamo ya fue resuelto.");
    }

    let nuevoEstado;
    let montoAprobado = null;
    let montoDescuento = null;

    if (accion === "RECHAZAR") {
      nuevoEstado = "RESUELTA_RECHAZADA";
    } else {
      const bruto = Number(disputa.montoOriginal);
      montoAprobado = accion === "APROBAR_TOTAL" ? bruto : Number(montoReembolsoAprobado);
      if (!Number.isFinite(montoAprobado) || montoAprobado <= 0 || montoAprobado > bruto) {
        throw new ErrorValidacion(`El monto de reembolso debe ser mayor a 0 y no superar $${bruto}.`);
      }
      // Descuento proporcional al neto: el comercio solo devuelve la parte que
      // efectivamente recibió (bruto menos la comisión ya cobrada por la plataforma).
      const tasaNeta = Number(disputa.montoNetoOriginal) / bruto;
      montoDescuento = Math.round(montoAprobado * tasaNeta * 100) / 100;
      nuevoEstado = accion === "APROBAR_TOTAL" ? "RESUELTA_REEMBOLSO_TOTAL" : "RESUELTA_REEMBOLSO_PARCIAL";
    }

    const { count } = await prisma.disputa.updateMany({
      where: { id: disputa.id, estado: { in: ESTADOS_RESOLVIBLES } },
      data: {
        estado: nuevoEstado,
        resolucion: motivo?.trim() || null,
        montoReembolsoAprobado: montoAprobado,
        montoDescuentoComercio: montoDescuento,
        resueltoPor: adminId,
        resueltoAt: new Date(),
      },
    });
    if (count !== 1) {
      throw new ErrorValidacion("Este reclamo ya fue resuelto por otro administrador.");
    }

    await prisma.accionModeracion.create({
      data: {
        adminId,
        targetId: disputa.id,
        targetTipo: "DISPUTA",
        accion: `RESOLVER_${nuevoEstado}`,
        motivo: motivo?.trim() || null,
      },
    });

    const actualizada = await prisma.disputa.findUnique({ where: { id: disputa.id } });
    NotificacionService.disputaResuelta({ disputa: actualizada }).catch((e) => console.error("[DISPUTA] notificar resolución:", e.message));

    if (nuevoEstado === "RESUELTA_REEMBOLSO_TOTAL" || nuevoEstado === "RESUELTA_REEMBOLSO_PARCIAL") {
      FacturacionService.anularPorReembolso(disputa.moduloOrigen, disputa.referenciaId, `Reembolso aprobado — reclamo #${disputa.id}`)
        .catch((e) => console.error("[DISPUTA] no se pudo anular la factura tras el reembolso:", e.message));
    }

    return actualizada;
  },

  async marcarTransferido(adminId, disputaId) {
    const disputa = await prisma.disputa.findUnique({ where: { id: Number(disputaId) } });
    if (!disputa) throw new ErrorNoEncontrado("Reclamo no encontrado");
    if (!["RESUELTA_REEMBOLSO_TOTAL", "RESUELTA_REEMBOLSO_PARCIAL"].includes(disputa.estado)) {
      throw new ErrorValidacion("Este reclamo no tiene un reembolso aprobado para transferir.");
    }
    return prisma.disputa.update({
      where: { id: disputa.id },
      data: { reembolsoTransferidoAt: new Date(), reembolsoTransferidoPor: adminId },
    });
  },

  async listarPorComprador(usuarioId) {
    return prisma.disputa.findMany({
      where: { compradorId: usuarioId },
      orderBy: { createdAt: "desc" },
      include: { comercio: { select: { id: true, nombre: true } } },
    });
  },

  async listarPorComercio(usuarioId) {
    const comercio = await ComercioRepository.buscarPorUsuarioId(usuarioId);
    if (!comercio) throw new ErrorNoEncontrado("No tienes un comercio registrado");
    return prisma.disputa.findMany({
      where: { comercioId: comercio.id },
      orderBy: { createdAt: "desc" },
      include: { comprador: { select: { id: true, nombre: true } } },
    });
  },

  async listarAdmin({ estado, comercioId, moduloOrigen } = {}) {
    return prisma.disputa.findMany({
      where: {
        ...(estado && { estado }),
        ...(comercioId && { comercioId: Number(comercioId) }),
        ...(moduloOrigen && { moduloOrigen }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        comercio: { select: { id: true, nombre: true } },
        comprador: { select: { id: true, nombre: true, email: true } },
      },
    });
  },

  async obtenerDetalle(disputaId, usuario) {
    const disputa = await prisma.disputa.findUnique({
      where: { id: Number(disputaId) },
      include: {
        comercio: { select: { id: true, nombre: true, usuarioId: true } },
        comprador: { select: { id: true, nombre: true, email: true } },
      },
    });
    if (!disputa) throw new ErrorNoEncontrado("Reclamo no encontrado");

    const esComprador = disputa.compradorId === usuario.id;
    const esComercio = disputa.comercio.usuarioId === usuario.id;
    const esAdmin = usuario.rol === "ADMIN";
    if (!esComprador && !esComercio && !esAdmin) {
      throw new ErrorProhibido("No tienes acceso a este reclamo.");
    }
    return disputa;
  },
};

module.exports = DisputaService;
