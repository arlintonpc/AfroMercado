const crypto = require("crypto");
const prisma = require("../config/prisma");
const { ErrorNoEncontrado, ErrorProhibido, ErrorValidacion } = require("../utils/errores");
const { obtenerProveedorConfigurado } = require("./payments/provider-factory");

const ESTADOS_PAGO_PUBLICIDAD = new Set([
  "PENDIENTE",
  "EN_CHECKOUT",
  "PAGADA",
  "FALLIDA",
  "VENCIDA",
  "ANULADA",
  "CORTESIA",
]);

const ESTADOS_PAGO_ACTIVABLES = new Set(["PAGADA", "CORTESIA"]);
const ESTADOS_APROBADOS = new Set(["APPROVED", "APROBADO", "CONFIRMED", "CONFIRMADO", "PAID", "SUCCESS", "SUCCESSFUL"]);
const ESTADOS_FALLIDOS = new Set(["DECLINED", "REJECTED", "FAILED", "FALLIDO", "ERROR", "CANCELLED", "CANCELED", "EXPIRED", "VOIDED"]);

function fechaExpiracionCheckout() {
  return new Date(Date.now() + 48 * 3600_000);
}

function referenciaBase(solicitudId) {
  return `AFM-AD-${solicitudId}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function normalizarEstadoPago(estado) {
  const valor = String(estado || "").trim().toUpperCase();
  if (!ESTADOS_PAGO_PUBLICIDAD.has(valor)) {
    throw new ErrorValidacion(`Estado de pago publicitario invalido: ${valor}`);
  }
  return valor;
}

function montoSolicitud(solicitud) {
  const monto = Number(solicitud.pagoMontoCOP || solicitud.presupuestoCOP || 0);
  if (!Number.isFinite(monto) || monto <= 0) {
    throw new ErrorValidacion("La solicitud no tiene un monto valido para cobrar.");
  }
  return monto;
}

function obtenerMontoEventoCentavos(evento) {
  const tx = evento?.payload?.data?.transaction || evento?.payload?.transaction || evento?.payload?.data || {};
  const valor = tx.amount_in_cents ?? tx.amountInCents ?? evento?.payload?.amount_in_cents;
  if (valor == null) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function validarMontoEvento(solicitud, evento) {
  const reportado = obtenerMontoEventoCentavos(evento);
  if (reportado == null) return;
  const esperado = Math.round(montoSolicitud(solicitud) * 100);
  if (reportado !== esperado) {
    throw new ErrorValidacion(
      `La pasarela reporto un monto de publicidad distinto al esperado (${reportado} vs ${esperado} centavos).`
    );
  }
}

function pagoActivable(estado) {
  return ESTADOS_PAGO_ACTIVABLES.has(String(estado || "").trim().toUpperCase());
}

function esCheckoutVigente(solicitud) {
  return (
    solicitud.pagoEstado === "EN_CHECKOUT" &&
    solicitud.pagoCheckoutUrl &&
    solicitud.pagoExpiraAt &&
    new Date(solicitud.pagoExpiraAt).getTime() > Date.now()
  );
}

async function cargarSolicitudOwner(usuarioId, solicitudId) {
  const solicitud = await prisma.solicitudPublicidad.findUnique({
    where: { id: Number(solicitudId) },
    include: {
      comercio: {
        include: {
          usuario: { select: { id: true, nombre: true, email: true, telefono: true } },
        },
      },
      producto: { select: { id: true, nombre: true } },
    },
  });
  if (!solicitud) throw new ErrorNoEncontrado("Solicitud de publicidad no encontrada.");
  if (solicitud.comercio?.usuarioId !== usuarioId) {
    throw new ErrorProhibido("Esta solicitud de publicidad no pertenece a tu comercio.");
  }
  return solicitud;
}

const PagoPublicidadService = {
  ESTADOS_PAGO_PUBLICIDAD,
  ESTADOS_PAGO_ACTIVABLES,
  pagoActivable,

  async iniciarCheckout(usuarioId, solicitudId) {
    let solicitud = await cargarSolicitudOwner(usuarioId, solicitudId);
    if (solicitud.estado !== "APROBADA") {
      throw new ErrorValidacion("AfroMedia debe aprobar la solicitud antes de cobrar la pauta.");
    }
    if (pagoActivable(solicitud.pagoEstado)) {
      return {
        solicitud,
        checkoutUrl: solicitud.pagoCheckoutUrl,
        referencia: solicitud.pagoProviderReference || solicitud.pagoReferencia,
        estado: solicitud.pagoEstado,
        proveedor: solicitud.pagoProveedor,
      };
    }
    if (esCheckoutVigente(solicitud)) {
      return {
        solicitud,
        checkoutUrl: solicitud.pagoCheckoutUrl,
        referencia: solicitud.pagoProviderReference || solicitud.pagoReferencia,
        estado: solicitud.pagoEstado,
        proveedor: solicitud.pagoProveedor,
      };
    }

    const { nombre: proveedorNombre, provider } = await obtenerProveedorConfigurado();
    if (typeof provider.crearCheckoutPublicidad !== "function") {
      throw new ErrorValidacion(`El proveedor ${proveedorNombre} no soporta checkout de publicidad.`);
    }

    const pagoReferencia = solicitud.pagoReferencia || referenciaBase(solicitud.id);
    const providerReference = referenciaBase(solicitud.id);
    const expiraAt = fechaExpiracionCheckout();

    solicitud = await prisma.solicitudPublicidad.update({
      where: { id: solicitud.id },
      data: {
        pagoEstado: "EN_CHECKOUT",
        pagoMontoCOP: montoSolicitud(solicitud),
        pagoReferencia,
        pagoProveedor: proveedorNombre,
        pagoProviderReference: providerReference,
        pagoProviderStatus: "CREATED",
        pagoCheckoutUrl: null,
        pagoProviderPaymentId: null,
        pagoProviderPayload: null,
        pagoExpiraAt: expiraAt,
        pagoNotas: "Checkout de pauta creado; esperando confirmacion de pasarela.",
        pagoActualizadoAt: new Date(),
      },
      include: {
        comercio: {
          include: {
            usuario: { select: { id: true, nombre: true, email: true, telefono: true } },
          },
        },
        producto: { select: { id: true, nombre: true } },
      },
    });

    try {
      const checkout = await provider.crearCheckoutPublicidad({
        solicitud,
        comercio: solicitud.comercio,
        usuario: solicitud.comercio?.usuario,
      });

      const actualizada = await prisma.solicitudPublicidad.update({
        where: { id: solicitud.id },
        data: {
          pagoCheckoutUrl: checkout.checkoutUrl || null,
          pagoProviderPaymentId: checkout.providerPaymentId || null,
          pagoProviderStatus: checkout.providerStatus || "CREATED",
          pagoProviderPayload: checkout.payload || null,
          pagoActualizadoAt: new Date(),
        },
        include: {
          comercio: {
            include: {
              usuario: { select: { id: true, nombre: true, email: true, telefono: true } },
            },
          },
          producto: { select: { id: true, nombre: true } },
        },
      });

      return {
        solicitud: actualizada,
        checkoutUrl: actualizada.pagoCheckoutUrl,
        referencia: actualizada.pagoProviderReference || actualizada.pagoReferencia,
        estado: actualizada.pagoEstado,
        proveedor: actualizada.pagoProveedor,
      };
    } catch (e) {
      await prisma.solicitudPublicidad.update({
        where: { id: solicitud.id },
        data: {
          pagoEstado: "FALLIDA",
          pagoProviderStatus: "ERROR",
          pagoNotas: e.message,
          pagoActualizadoAt: new Date(),
        },
      });
      throw e;
    }
  },

  async actualizarAdmin(adminId, solicitudId, { estado, notas }) {
    const estadoPago = normalizarEstadoPago(estado);
    const solicitud = await prisma.solicitudPublicidad.findUnique({ where: { id: Number(solicitudId) } });
    if (!solicitud) throw new ErrorNoEncontrado("Solicitud de publicidad no encontrada.");

    const data = {
      pagoEstado: estadoPago,
      pagoNotas: notas || null,
      pagoActualizadoPor: adminId,
      pagoActualizadoAt: new Date(),
    };

    if (!solicitud.pagoReferencia) data.pagoReferencia = referenciaBase(solicitud.id);
    if (estadoPago === "PAGADA" || estadoPago === "CORTESIA") {
      data.pagoConfirmadoAt = new Date();
      data.pagoProviderStatus = estadoPago === "CORTESIA" ? "COURTESY_ADMIN" : "APPROVED_ADMIN";
    }
    if (["PENDIENTE", "EN_CHECKOUT", "FALLIDA", "VENCIDA", "ANULADA"].includes(estadoPago)) {
      data.pagoConfirmadoAt = null;
    }

    return prisma.solicitudPublicidad.update({
      where: { id: solicitud.id },
      data,
    });
  },

  async procesarWebhook(proveedorNombre, evento) {
    const criterios = [
      evento.providerPaymentId ? { pagoProviderPaymentId: evento.providerPaymentId } : undefined,
      evento.providerReference ? { pagoProviderReference: evento.providerReference } : undefined,
      evento.providerReference ? { pagoReferencia: evento.providerReference } : undefined,
    ].filter(Boolean);

    if (criterios.length === 0) return null;

    let solicitud = await prisma.solicitudPublicidad.findFirst({
      where: {
        pagoProveedor: proveedorNombre,
        OR: criterios,
      },
    });
    if (!solicitud) return null;

    if (evento.providerPaymentId && !solicitud.pagoProviderPaymentId) {
      try {
        solicitud = await prisma.solicitudPublicidad.update({
          where: { id: solicitud.id },
          data: { pagoProviderPaymentId: evento.providerPaymentId },
        });
      } catch (e) {
        if (e?.code !== "P2002") throw e;
      }
    }

    const estado = String(evento.estado || "").trim().toUpperCase();
    if (ESTADOS_APROBADOS.has(estado)) {
      validarMontoEvento(solicitud, evento);
      return prisma.solicitudPublicidad.update({
        where: { id: solicitud.id },
        data: {
          pagoEstado: "PAGADA",
          pagoProviderStatus: estado || "APPROVED",
          pagoProviderPayload: evento.payload || {},
          pagoConfirmadoAt: new Date(),
          pagoNotas: evento.tipo ? `Pago de pauta confirmado por webhook ${evento.tipo}` : "Pago de pauta confirmado por pasarela.",
          pagoActualizadoAt: new Date(),
        },
      });
    }

    if (ESTADOS_FALLIDOS.has(estado)) {
      return prisma.solicitudPublicidad.update({
        where: { id: solicitud.id },
        data: {
          pagoEstado: estado === "EXPIRED" ? "VENCIDA" : "FALLIDA",
          pagoProviderStatus: estado || "FAILED",
          pagoProviderPayload: evento.payload || {},
          pagoNotas: `Pasarela reporto estado ${estado || "FALLIDO"}.`,
          pagoActualizadoAt: new Date(),
        },
      });
    }

    return prisma.solicitudPublicidad.update({
      where: { id: solicitud.id },
      data: {
        pagoEstado: "EN_CHECKOUT",
        pagoProviderStatus: estado || "PENDING",
        pagoProviderPayload: evento.payload || {},
        pagoActualizadoAt: new Date(),
      },
    });
  },
};

module.exports = PagoPublicidadService;
