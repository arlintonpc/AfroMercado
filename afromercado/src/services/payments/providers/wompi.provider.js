const crypto = require("crypto");
const { ErrorValidacion } = require("../../../utils/errores");
const { descifrarNumeroCuenta } = require("../../../utils/cuentas-dispersion");
const ConfigRepository = require("../../../repositories/config.repository");

const CHECKOUT_URL = "https://checkout.wompi.co/p/";
const PAYOUTS_API_URL = "https://api.payouts.wompi.co/v1";

const BANK_ID_FALLBACK = {
  BANCO_BOGOTA: "1001",
  BANCO_POPULAR: "1002",
  BANCOLOMBIA: "1007",
  BBVA: "1013",
  SCOTIABANK_COLPATRIA: "1019",
  BANCO_OCCIDENTE: "1023",
  BANCO_CAJA_SOCIAL: "1032",
  BANCO_AGRARIO: "1040",
  DAVIVIENDA: "1051",
  BANCO_AV_VILLAS: "1052",
  BANCO_W: "1053",
  BANCO_PICHINCHA: "1060",
  BANCO_FALABELLA: "1062",
  LULO_BANK: "1070",
  NEQUI: "1507",
  DAVIPLATA: "1551",
  NU: "1809",
};

const TIPOS_DOCUMENTO_PAYOUTS = new Set(["CC", "CE", "NIT"]);

function configKey(nombre) {
  return `pagos.wompi.${nombre}`;
}

async function env(nombre, alternativo = null) {
  const desdeEntorno = process.env[nombre] || (alternativo ? process.env[alternativo] : "");
  if (desdeEntorno) return String(desdeEntorno).trim();

  const claves = [configKey(nombre), alternativo ? configKey(alternativo) : null].filter(Boolean);
  const guardadas = await ConfigRepository.obtenerVarios(claves);
  const valor = guardadas[configKey(nombre)] || (alternativo ? guardadas[configKey(alternativo)] : "");
  return String(valor || "").trim();
}

async function requerido(nombre, alternativo = null) {
  const valor = await env(nombre, alternativo);
  if (!valor) {
    throw new ErrorValidacion(`Wompi requiere configurar ${nombre}${alternativo ? ` o ${alternativo}` : ""}`);
  }
  return valor;
}

function sha256(valor) {
  return crypto.createHash("sha256").update(String(valor), "utf8").digest("hex");
}

function compararHashSeguro(a, b) {
  const uno = Buffer.from(String(a || "").toLowerCase(), "utf8");
  const dos = Buffer.from(String(b || "").toLowerCase(), "utf8");
  return uno.length === dos.length && crypto.timingSafeEqual(uno, dos);
}

function frontendUrl() {
  return (process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || "http://localhost:3002").replace(/\/$/, "");
}

async function payoutsApiUrl() {
  return await env("WOMPI_PAYOUTS_API_URL") || PAYOUTS_API_URL;
}

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();
}

function parseJsonSeguro(valor) {
  if (!valor) return null;
  try {
    return JSON.parse(valor);
  } catch {
    throw new ErrorValidacion("WOMPI_PAYOUT_BANK_MAP debe ser un JSON valido");
  }
}

function montoEnCentavos(valor) {
  const centavos = Math.round(Number(valor || 0) * 100);
  if (!Number.isFinite(centavos) || centavos <= 0) {
    throw new ErrorValidacion("El monto de Wompi debe ser mayor a cero");
  }
  return centavos;
}

function limpiarIdempotency(valor) {
  return String(valor || "")
    .replace(/[^A-Za-z0-9-]/g, "-")
    .slice(0, 64);
}

async function firmaIntegridad({ reference, amountInCents, currency, expirationTime }) {
  const secreto = await requerido("WOMPI_INTEGRITY_SECRET", "WOMPI_SIGNATURE_SECRET");
  const partes = [reference, amountInCents, currency];
  if (expirationTime) partes.push(expirationTime);
  partes.push(secreto);
  return sha256(partes.join(""));
}

async function checkoutConfig() {
  return {
    publicKey: await requerido("WOMPI_PUBLIC_KEY"),
    checkoutUrl: await env("WOMPI_CHECKOUT_URL") || CHECKOUT_URL,
  };
}

async function payoutsConfig() {
  return {
    apiUrl: (await payoutsApiUrl()).replace(/\/$/, ""),
    apiKey: await requerido("WOMPI_PAYOUTS_API_KEY"),
    userPrincipalId: await requerido("WOMPI_PAYOUTS_USER_PRINCIPAL_ID"),
    accountId: await requerido("WOMPI_PAYOUTS_ACCOUNT_ID"),
    paymentType: await env("WOMPI_PAYOUTS_PAYMENT_TYPE") || "PROVIDERS",
  };
}

async function eventoConfig() {
  return {
    secret: await requerido("WOMPI_EVENTS_SECRET"),
  };
}

function obtenerValorPorRuta(objeto, ruta) {
  return String(ruta || "")
    .split(".")
    .reduce((actual, parte) => (actual == null ? undefined : actual[parte]), objeto);
}

async function validarFirmaEventoWompi(body, headers = {}) {
  const { secret } = await eventoConfig();
  const firmaRecibida =
    headers["x-event-checksum"] ||
    headers["X-Event-Checksum"] ||
    body?.signature?.checksum;

  const propiedades = Array.isArray(body?.signature?.properties)
    ? body.signature.properties
    : [];

  if (!firmaRecibida || propiedades.length === 0 || body?.timestamp == null) {
    throw new ErrorValidacion("Evento Wompi sin firma, propiedades o timestamp");
  }

  const valores = propiedades.map((propiedad) => {
    const valor = obtenerValorPorRuta(body.data || {}, propiedad);
    if (valor == null) {
      throw new ErrorValidacion(`Evento Wompi no contiene la propiedad firmada ${propiedad}`);
    }
    return String(valor);
  });

  const firmaCalculada = sha256(`${valores.join("")}${body.timestamp}${secret}`);
  if (!compararHashSeguro(firmaCalculada, firmaRecibida)) {
    throw new ErrorValidacion("Firma de evento Wompi invalida");
  }

  return firmaRecibida;
}

async function requestPayouts(path, { method = "GET", body, idempotencyKey } = {}) {
  const config = await payoutsConfig();
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": config.apiKey,
    "user-principal-id": config.userPrincipalId,
  };
  if (idempotencyKey) headers["idempotency-key"] = limpiarIdempotency(idempotencyKey);

  const respuesta = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const texto = await respuesta.text();
  let data = null;
  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    data = { raw: texto };
  }

  if (!respuesta.ok) {
    const detalle = data?.error?.message || data?.message || data?.error || respuesta.statusText;
    throw new ErrorValidacion(`Wompi Payouts rechazo la solicitud (${respuesta.status}): ${detalle}`);
  }

  return data || {};
}

async function buscarBancoEnApi(cuenta) {
  try {
    const respuesta = await requestPayouts("/banks");
    const bancos = Array.isArray(respuesta)
      ? respuesta
      : respuesta.data || respuesta.banks || respuesta.items || [];
    const objetivoCodigo = normalizarTexto(cuenta.bancoCodigo);
    const objetivoNombre = normalizarTexto(cuenta.bancoNombre);
    const banco = bancos.find((item) => {
      const nombre = normalizarTexto(item.name || item.nombre || item.bankName);
      const codigo = normalizarTexto(item.code || item.codigo || item.id);
      return codigo === objetivoCodigo || nombre === objetivoNombre || nombre.includes(objetivoNombre);
    });
    return banco?.id || banco?.bankId || banco?.code || null;
  } catch {
    return null;
  }
}

async function resolverBankId(cuenta) {
  if (cuenta.providerBankId) return cuenta.providerBankId;

  const mapa = parseJsonSeguro(await env("WOMPI_PAYOUT_BANK_MAP"));
  if (mapa?.[cuenta.bancoCodigo]) return String(mapa[cuenta.bancoCodigo]);

  const desdeApi = await buscarBancoEnApi(cuenta);
  if (desdeApi) return String(desdeApi);

  const fallback = BANK_ID_FALLBACK[cuenta.bancoCodigo];
  if (fallback) return fallback;

  throw new ErrorValidacion(
    `No se encontro bankId Wompi para ${cuenta.bancoNombre}. Configura WOMPI_PAYOUT_BANK_MAP.`
  );
}

async function tipoCuentaPayouts(tipoCuenta) {
  if (tipoCuenta === "CORRIENTE") return "CORRIENTE";
  if (tipoCuenta === "AHORROS") return "AHORROS";
  if (tipoCuenta === "BILLETERA_DIGITAL") return await env("WOMPI_WALLET_ACCOUNT_TYPE") || "AHORROS";
  throw new ErrorValidacion("Tipo de cuenta no soportado por Wompi Payouts");
}

function validarDocumentoPayouts(tipoDocumento) {
  if (!TIPOS_DOCUMENTO_PAYOUTS.has(tipoDocumento)) {
    throw new ErrorValidacion(
      `Wompi Payouts solo soporta CC, CE o NIT para dispersion. Documento recibido: ${tipoDocumento}`
    );
  }
}

function estadoDispersion(status) {
  const estado = String(status || "").trim().toUpperCase();
  if (["APPROVED", "CONFIRMED", "PAID", "SUCCESSFUL", "TOTAL_PAYMENT"].includes(estado)) {
    return "CONFIRMADA";
  }
  if (["REJECTED", "FAILED", "ERROR", "CANCELLED", "NOT_APPROVED"].includes(estado)) {
    return "FALLIDA";
  }
  if (["PENDING_APPROVAL", "PROGRAMMED", "SCHEDULED"].includes(estado)) {
    return "PROGRAMADA";
  }
  return "ENVIADA";
}

function obtenerTransaction(body) {
  return body?.data?.transaction || body?.transaction || body?.data || {};
}

function referenciaDispersion(dispersion) {
  return limpiarIdempotency(`AFM-DISP-${dispersion.id}`);
}

const WompiPaymentProvider = {
  nombre: "WOMPI",

  async registrarBeneficiario({ comercio, cuenta }) {
    await payoutsConfig();
    validarDocumentoPayouts(cuenta.tipoDocumento);

    const providerBankId = await resolverBankId(cuenta);
    const hash = sha256([
      comercio.id,
      cuenta.bancoCodigo,
      providerBankId,
      cuenta.tipoCuenta,
      cuenta.tipoDocumento,
      cuenta.numeroDocumento,
      cuenta.numeroCuenta,
    ].join(":")).slice(0, 24);

    return {
      providerRecipientId: `wompi_dest_${hash}`,
      providerBankId,
      estado: "VERIFICADA",
      payload: {
        modo: "wompi_payouts",
        providerBankId,
        bancoCodigo: cuenta.bancoCodigo,
        bancoNombre: cuenta.bancoNombre,
        validacion: "estructural_api_payouts",
      },
    };
  },

  async crearCheckout({ pago, pedido }) {
    const config = await checkoutConfig();
    const currency = pago.moneda || "COP";
    const amountInCents = montoEnCentavos(pago.monto);
    const reference = pago.providerReference;
    const expirationTime = pago.expiraAt ? new Date(pago.expiraAt).toISOString() : null;
    const signature = await firmaIntegridad({ reference, amountInCents, currency, expirationTime });

    const params = new URLSearchParams({
      "public-key": config.publicKey,
      currency,
      "amount-in-cents": String(amountInCents),
      reference,
      "signature:integrity": signature,
      "redirect-url": `${frontendUrl()}/pedido/${pedido.id}/pago?provider=wompi&reference=${encodeURIComponent(reference)}`,
    });

    if (expirationTime) params.set("expiration-time", expirationTime);
    if (pedido.comprador?.email) params.set("customer-data:email", pedido.comprador.email);
    if (pedido.comprador?.nombre) params.set("customer-data:full-name", pedido.comprador.nombre);
    if (pedido.comprador?.telefono) params.set("customer-data:phone-number", pedido.comprador.telefono);

    return {
      providerPaymentId: null,
      checkoutUrl: `${config.checkoutUrl}?${params.toString()}`,
      providerStatus: "CREATED",
      payload: {
        modo: "wompi_web_checkout",
        amountInCents,
        currency,
        reference,
        expirationTime,
      },
    };
  },

  async crearCheckoutPublicidad({ solicitud, comercio, usuario }) {
    const config = await checkoutConfig();
    const currency = "COP";
    const amountInCents = montoEnCentavos(solicitud.pagoMontoCOP || solicitud.presupuestoCOP);
    const reference = solicitud.pagoProviderReference || solicitud.pagoReferencia;
    const expirationTime = solicitud.pagoExpiraAt ? new Date(solicitud.pagoExpiraAt).toISOString() : null;
    const signature = await firmaIntegridad({ reference, amountInCents, currency, expirationTime });

    const params = new URLSearchParams({
      "public-key": config.publicKey,
      currency,
      "amount-in-cents": String(amountInCents),
      reference,
      "signature:integrity": signature,
      "redirect-url": `${frontendUrl()}/comerciante/publicidad?pago=wompi&reference=${encodeURIComponent(reference)}&solicitud=${solicitud.id}`,
    });

    if (expirationTime) params.set("expiration-time", expirationTime);
    if (usuario?.email) params.set("customer-data:email", usuario.email);
    if (usuario?.nombre || comercio?.nombre) params.set("customer-data:full-name", usuario?.nombre || comercio.nombre);
    if (usuario?.telefono || comercio?.whatsapp) params.set("customer-data:phone-number", usuario?.telefono || comercio.whatsapp);

    return {
      providerPaymentId: null,
      checkoutUrl: `${config.checkoutUrl}?${params.toString()}`,
      providerStatus: "CREATED",
      payload: {
        modo: "wompi_web_checkout_publicidad",
        solicitudId: solicitud.id,
        amountInCents,
        currency,
        reference,
        expirationTime,
      },
    };
  },

  async interpretarWebhook({ body, headers }) {
    const firma = await validarFirmaEventoWompi(body, headers);
    const transaction = obtenerTransaction(body);

    return {
      eventoId:
        body?.id ||
        [
          body?.event || body?.type || "wompi.event",
          transaction?.id || transaction?.reference || "sin-transaccion",
          body?.timestamp || Date.now(),
          transaction?.status || body?.status || "sin-estado",
        ].join(":"),
      tipo: body?.event || body?.type || "transaction.updated",
      estado: transaction?.status || body?.status || null,
      providerPaymentId: transaction?.id || transaction?.transactionId || null,
      providerReference: transaction?.reference || body?.reference || null,
      payload: body || {},
      firma,
    };
  },

  async dispersar({ pago, dispersiones }) {
    const config = await payoutsConfig();
    const reference = limpiarIdempotency(`AFM-PAYOUT-${pago.id}`);

    const transactions = [];
    for (const dispersion of dispersiones) {
      const cuenta = dispersion.cuentaDispersion;
      if (!cuenta?.numeroCuentaCifrado) {
        throw new ErrorValidacion(
          `La cuenta del comercio ${dispersion.comercioId} debe registrarse nuevamente para dispersion real`
        );
      }
      validarDocumentoPayouts(cuenta.tipoDocumento);
      if (!cuenta.providerBankId) {
        throw new ErrorValidacion(
          `La cuenta del comercio ${dispersion.comercioId} no tiene providerBankId Wompi`
        );
      }

      transactions.push({
        legalIdType: cuenta.tipoDocumento,
        legalId: cuenta.numeroDocumento,
        bankId: cuenta.providerBankId,
        accountType: await tipoCuentaPayouts(cuenta.tipoCuenta),
        accountNumber: descifrarNumeroCuenta(cuenta.numeroCuentaCifrado),
        name: cuenta.titularNombre,
        email: cuenta.emailNotificacion || `comercio-${cuenta.comercioId}@afromercado.co`,
        amount: montoEnCentavos(dispersion.montoNeto),
        reference: referenciaDispersion(dispersion),
      });
    }

    const respuesta = await requestPayouts("/payouts", {
      method: "POST",
      idempotencyKey: reference,
      body: {
        reference,
        accountId: config.accountId,
        paymentType: config.paymentType,
        transactions,
      },
    });

    const lote = respuesta.data || respuesta;
    const batchId = lote.id || lote.batchId || lote.reference || reference;
    const transaccionesRespuesta = lote.transactions || respuesta.transactions || [];
    const porReferencia = new Map(
      transaccionesRespuesta.map((tx) => [tx.reference || tx.customReference, tx])
    );

    return dispersiones.map((dispersion) => {
      const ref = referenciaDispersion(dispersion);
      const tx = porReferencia.get(ref) || {};
      const providerStatus = tx.status || lote.status || respuesta.status || "PENDING";
      return {
        id: dispersion.id,
        estado: estadoDispersion(providerStatus),
        providerTransferId: tx.id || tx.transactionId || `${batchId}:${dispersion.id}`,
        providerStatus,
        errorMensaje: tx.errorMessage || tx.error || null,
      };
    });
  },
};

module.exports = WompiPaymentProvider;
