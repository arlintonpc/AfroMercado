// ============================================================
//  Servicio de Facturación electrónica (Fase 1.2)
//  Emite una FacturaElectronica por referencia (SubPedido para "PEDIDO",
//  la reserva/pedido propio para los demás módulos) a través del proveedor
//  configurado (hoy solo "NINGUNO" — ver facturacion.provider-factory.js).
//  Nunca bloquea ni revierte un pago: siempre se llama fire-and-forget.
// ============================================================
const prisma = require("../config/prisma");
const { obtenerProveedorConfigurado } = require("./facturacion/facturacion.provider-factory");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");

const MAX_INTENTOS = 5;
const BACKOFF_MINUTOS = [5, 15, 30, 60, 120];

// Cada resolver devuelve { comercioId, compradorId, subtotal, ivaTotal, total }
// para la referencia dada, o lanza ErrorNoEncontrado si no existe/no aplica.
const RESOLVERS = {
  async PEDIDO(referenciaId) {
    const subPedido = await prisma.subPedido.findUnique({
      where: { id: referenciaId },
      include: { pedido: { select: { compradorId: true } } },
    });
    if (!subPedido) throw new ErrorNoEncontrado("SubPedido no encontrado");
    const subtotal = Number(subPedido.subtotal);
    const ivaTotal = Number(subPedido.iva || 0);
    return {
      comercioId: subPedido.comercioId,
      compradorId: subPedido.pedido.compradorId,
      subtotal,
      ivaTotal,
      total: subtotal + ivaTotal,
    };
  },

  // Los 5 módulos de abajo no tienen campo de IVA propio todavía (Fase 1.1 solo
  // lo cableó en Pedido) — ivaTotal queda en 0 hasta que se extienda IVA a estos
  // módulos. Tampoco pasan por pago-digital.service.js (ese solo existe para
  // Pedido/Wompi) — aquí el "momento de venta" es la creación de la reserva.

  async EXPRESS(referenciaId) {
    const pedido = await prisma.pedidoExpress.findUnique({ where: { id: referenciaId } });
    if (!pedido) throw new ErrorNoEncontrado("Pedido Express no encontrado");
    const total = Number(pedido.total);
    return { comercioId: pedido.comercioId, compradorId: pedido.clienteId, subtotal: total, ivaTotal: 0, total };
  },

  async HOTEL(referenciaId) {
    const reserva = await prisma.reservaHotel.findUnique({
      where: { id: referenciaId },
      include: { configHotel: { select: { comercioId: true } } },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva de hotel no encontrada");
    const total = Number(reserva.total);
    return { comercioId: reserva.configHotel.comercioId, compradorId: reserva.clienteId, subtotal: total, ivaTotal: 0, total };
  },

  async TOUR(referenciaId) {
    const reserva = await prisma.reservaTour.findUnique({
      where: { id: referenciaId },
      include: { configTour: { select: { comercioId: true } } },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva de tour no encontrada");
    const total = Number(reserva.total);
    return { comercioId: reserva.configTour.comercioId, compradorId: reserva.clienteId, subtotal: total, ivaTotal: 0, total };
  },

  async TRANSPORTE(referenciaId) {
    const reserva = await prisma.reservaTransporte.findUnique({
      where: { id: referenciaId },
      include: { ruta: { include: { configTransporte: { select: { comercioId: true } } } } },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva de transporte no encontrada");
    const total = Number(reserva.total);
    return { comercioId: reserva.ruta.configTransporte.comercioId, compradorId: reserva.clienteId, subtotal: total, ivaTotal: 0, total };
  },

  async CULTURA(referenciaId) {
    const reserva = await prisma.reservaCultural.findUnique({
      where: { id: referenciaId },
      include: { evento: { select: { comercioId: true } } },
    });
    if (!reserva) throw new ErrorNoEncontrado("Reserva cultural no encontrada");
    // EventoCultural.comercioId es nullable (un evento puede organizarlo una
    // institución sin comercio registrado) — sin comercio no hay a quién
    // facturarle, se omite en vez de violar la FK de FacturaElectronica.
    if (!reserva.evento.comercioId) {
      throw new ErrorValidacion("Este evento no tiene comercio asociado; no aplica facturación");
    }
    const total = Number(reserva.total);
    return { comercioId: reserva.evento.comercioId, compradorId: reserva.clienteId, subtotal: total, ivaTotal: 0, total };
  },
};

const MODULOS_VALIDOS = ["PEDIDO", "EXPRESS", "HOTEL", "TOUR", "TRANSPORTE", "CULTURA"];

function proximoBackoffMinutos(intentosFallidos) {
  return BACKOFF_MINUTOS[Math.min(intentosFallidos, BACKOFF_MINUTOS.length - 1)];
}

const FacturacionService = {
  /**
   * Emite (o reintenta) la factura de una referencia. Idempotente: si ya existe
   * una FacturaElectronica para (moduloOrigen, referenciaId) en un estado
   * terminal (ACEPTADA/OMITIDA/ANULADA), no hace nada.
   */
  async emitirParaReferencia(moduloOrigen, referenciaId) {
    if (!MODULOS_VALIDOS.includes(moduloOrigen)) {
      throw new ErrorValidacion(`moduloOrigen inválido: ${moduloOrigen}`);
    }
    const resolver = RESOLVERS[moduloOrigen];
    if (!resolver) {
      // Módulo válido en el enum pero sin resolver implementado todavía.
      throw new ErrorValidacion(`Facturación para "${moduloOrigen}" aún no está implementada`);
    }

    const existente = await prisma.facturaElectronica.findUnique({
      where: { moduloOrigen_referenciaId: { moduloOrigen, referenciaId } },
    });
    if (existente && ["ACEPTADA", "OMITIDA", "ANULADA"].includes(existente.estado)) {
      return existente;
    }

    const datos = await resolver(referenciaId);
    const { nombre: proveedorNombre, provider } = await obtenerProveedorConfigurado();

    const factura = existente
      ? await prisma.facturaElectronica.update({
          where: { id: existente.id },
          data: { proveedor: proveedorNombre, estado: "PENDIENTE" },
        })
      : await prisma.facturaElectronica.create({
          data: {
            moduloOrigen,
            referenciaId,
            comercioId: datos.comercioId,
            compradorId: datos.compradorId,
            proveedor: proveedorNombre,
            estado: "PENDIENTE",
            subtotal: datos.subtotal,
            ivaTotal: datos.ivaTotal,
            total: datos.total,
          },
        });

    try {
      const resultado = await provider.emitirFactura({
        factura,
        comercioId: datos.comercioId,
        compradorId: datos.compradorId,
        subtotal: datos.subtotal,
        ivaTotal: datos.ivaTotal,
        total: datos.total,
      });
      return prisma.facturaElectronica.update({
        where: { id: factura.id },
        data: {
          estado: resultado.estado || (resultado.omitido ? "OMITIDA" : "ENVIADA"),
          cufe: resultado.cufe ?? null,
          numeroFactura: resultado.numeroFactura ?? null,
          pdfUrl: resultado.pdfUrl ?? null,
          xmlUrl: resultado.xmlUrl ?? null,
          providerFacturaId: resultado.providerFacturaId ?? null,
          providerPayload: resultado.providerPayload ?? null,
          errorMensaje: null,
        },
      });
    } catch (e) {
      return prisma.facturaElectronica.update({
        where: { id: factura.id },
        data: {
          estado: "ERROR",
          errorMensaje: e.message,
          intentosFallidos: { increment: 1 },
          proximoReintentoAt: new Date(Date.now() + proximoBackoffMinutos(factura.intentosFallidos) * 60 * 1000),
        },
      });
    }
  },

  async reintentarPendientes() {
    const ahora = new Date();
    const pendientes = await prisma.facturaElectronica.findMany({
      where: {
        estado: "ERROR",
        intentosFallidos: { lt: MAX_INTENTOS },
        OR: [{ proximoReintentoAt: null }, { proximoReintentoAt: { lte: ahora } }],
      },
      select: { moduloOrigen: true, referenciaId: true },
    });
    for (const f of pendientes) {
      await this.emitirParaReferencia(f.moduloOrigen, f.referenciaId).catch((e) =>
        console.error(`[FACTURACION] reintento fallido ${f.moduloOrigen}#${f.referenciaId}:`, e.message)
      );
    }
    return pendientes.length;
  },

  async consultar(moduloOrigen, referenciaId) {
    const factura = await prisma.facturaElectronica.findUnique({
      where: { moduloOrigen_referenciaId: { moduloOrigen, referenciaId } },
    });
    if (!factura) throw new ErrorNoEncontrado("Factura no encontrada");
    return factura;
  },

  async listarAdmin({ estado, moduloOrigen, comercioId } = {}) {
    return prisma.facturaElectronica.findMany({
      where: {
        ...(estado ? { estado } : {}),
        ...(moduloOrigen ? { moduloOrigen } : {}),
        ...(comercioId ? { comercioId: Number(comercioId) } : {}),
      },
      include: {
        comercio: { select: { id: true, nombre: true } },
        comprador: { select: { id: true, nombre: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  },

  async anular(adminId, facturaId, motivo) {
    const factura = await prisma.facturaElectronica.findUnique({ where: { id: Number(facturaId) } });
    if (!factura) throw new ErrorNoEncontrado("Factura no encontrada");
    if (!["ENVIADA", "ACEPTADA"].includes(factura.estado)) {
      throw new ErrorValidacion(`No se puede anular una factura en estado "${factura.estado}"`);
    }
    const { provider } = await obtenerProveedorConfigurado(factura.proveedor);
    await provider.anularFactura(factura.providerFacturaId, motivo).catch((e) => {
      throw new ErrorValidacion(`El proveedor rechazó la anulación: ${e.message}`);
    });
    return prisma.facturaElectronica.update({
      where: { id: factura.id },
      data: { estado: "ANULADA", anuladaPor: adminId, anuladaAt: new Date(), motivoAnulacion: motivo || null },
    });
  },

  /** Llamado desde disputa.service.js al aprobar un reembolso — no bloquea la resolución si falla. */
  async anularPorReembolso(moduloOrigen, referenciaId, motivo) {
    const factura = await prisma.facturaElectronica.findUnique({
      where: { moduloOrigen_referenciaId: { moduloOrigen, referenciaId } },
    });
    if (!factura || !["ENVIADA", "ACEPTADA"].includes(factura.estado)) return null;
    const { provider } = await obtenerProveedorConfigurado(factura.proveedor);
    await provider.anularFactura(factura.providerFacturaId, motivo);
    return prisma.facturaElectronica.update({
      where: { id: factura.id },
      data: { estado: "ANULADA", motivoAnulacion: motivo || null, anuladaAt: new Date() },
    });
  },
};

module.exports = FacturacionService;
