function frontendUrl() {
  return (process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || "http://localhost:3002").replace(/\/$/, "");
}

function crearId(prefijo) {
  return `${prefijo}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const SandboxPaymentProvider = {
  nombre: "SANDBOX",

  async registrarBeneficiario({ comercio, cuenta }) {
    return {
      providerRecipientId: crearId(`sandbox_recipient_${comercio.id}`),
      estado: "VERIFICADA",
      payload: {
        bancoCodigo: cuenta.bancoCodigo,
        tipoCuenta: cuenta.tipoCuenta,
        modo: "sandbox",
      },
    };
  },

  async crearCheckout({ pago, pedido, dispersiones }) {
    const providerPaymentId = crearId(`sandbox_pay_${pago.id}`);
    return {
      providerPaymentId,
      checkoutUrl: `${frontendUrl()}/pedido/${pedido.id}?pago=sandbox&payment=${providerPaymentId}`,
      providerStatus: "CREATED",
      payload: {
        modo: "sandbox",
        dispersiones: dispersiones.map((d) => ({
          subPedidoId: d.subPedidoId,
          comercioId: d.comercioId,
          montoNeto: Number(d.montoNeto),
        })),
      },
    };
  },

  async crearCheckoutPublicidad({ solicitud }) {
    const providerPaymentId = crearId(`sandbox_ad_${solicitud.id}`);
    const reference = solicitud.pagoProviderReference || solicitud.pagoReferencia;
    return {
      providerPaymentId,
      checkoutUrl: `${frontendUrl()}/comerciante/publicidad?pago=sandbox&solicitud=${solicitud.id}&reference=${encodeURIComponent(reference || "")}`,
      providerStatus: "CREATED",
      payload: {
        modo: "sandbox_publicidad",
        solicitudId: solicitud.id,
        reference,
        montoCOP: Number(solicitud.pagoMontoCOP || solicitud.presupuestoCOP || 0),
      },
    };
  },

  async interpretarWebhook({ body }) {
    return {
      eventoId: body?.eventId || body?.id || crearId("sandbox_event"),
      tipo: body?.type || "payment.status.changed",
      estado: body?.estado || body?.status || "APPROVED",
      providerPaymentId: body?.providerPaymentId || body?.paymentId || null,
      providerReference: body?.providerReference || body?.reference || null,
      payload: body || {},
      firma: null,
    };
  },

  async dispersar({ pago, dispersiones }) {
    return dispersiones.map((dispersion) => ({
      id: dispersion.id,
      estado: "CONFIRMADA",
      providerTransferId: crearId(`sandbox_transfer_${dispersion.id}`),
      providerStatus: "CONFIRMED",
      payload: {
        pagoId: pago.id,
        modo: "sandbox",
      },
    }));
  },
};

module.exports = SandboxPaymentProvider;
