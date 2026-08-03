import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const crypto = require("crypto");
const { cifrarNumeroCuenta } = require("../src/utils/cuentas-dispersion");

// wompi.provider.js lee configuración vía ConfigRepository (Prisma → DB real).
// Se simula ANTES de requerir el provider para que el test quede aislado y no
// dependa de conectividad a la base de datos, siguiendo la convención del
// resto de la suite (mutar el módulo antes de requerir el servicio probado).
const ConfigRepository = require("../src/repositories/config.repository");
ConfigRepository.obtenerVarios = vi.fn(async () => ({}));

const WompiPaymentProvider = require(
  "../src/services/payments/providers/wompi.provider"
);

const VARIABLES = [
  "WOMPI_PUBLIC_KEY",
  "WOMPI_INTEGRITY_SECRET",
  "WOMPI_SIGNATURE_SECRET",
  "WOMPI_CHECKOUT_URL",
  "FRONTEND_URL",
  "WOMPI_PAYOUTS_API_KEY",
  "WOMPI_PAYOUTS_USER_PRINCIPAL_ID",
  "WOMPI_PAYOUTS_ACCOUNT_ID",
  "WOMPI_PAYOUTS_API_URL",
];
const anteriores = Object.fromEntries(
  VARIABLES.map((nombre) => [nombre, process.env[nombre]])
);
const fetchOriginal = global.fetch;

function dispersion(overrides = {}) {
  return {
    id: 701,
    comercioId: 91,
    montoNeto: 25000,
    intentosFallidos: 0,
    cuentaDispersion: {
      comercioId: 91,
      numeroCuentaCifrado: cifrarNumeroCuenta("1234567890"),
      tipoDocumento: "CC",
      numeroDocumento: "12345678",
      providerBankId: "1007",
      tipoCuenta: "AHORROS",
      titularNombre: "Comerciante QA",
      emailNotificacion: "comerciante@example.test",
    },
    ...overrides,
  };
}

beforeEach(() => {
  process.env.WOMPI_PUBLIC_KEY = "pub_test_checkout_qa";
  process.env.WOMPI_INTEGRITY_SECRET = "test_integrity_checkout_qa";
  process.env.FRONTEND_URL = "https://shop.example.test";
  process.env.WOMPI_PAYOUTS_API_KEY = "wompi-payout-key";
  process.env.WOMPI_PAYOUTS_USER_PRINCIPAL_ID = "principal-qa";
  process.env.WOMPI_PAYOUTS_ACCOUNT_ID = "account-qa";
  process.env.WOMPI_PAYOUTS_API_URL = "https://payouts.example.test/v1";
});

afterEach(() => {
  global.fetch = fetchOriginal;
  for (const nombre of VARIABLES) {
    if (anteriores[nombre] == null) delete process.env[nombre];
    else process.env[nombre] = anteriores[nombre];
  }
});

describe("Wompi - idempotencia de dispersion", () => {
  it("repite la misma clave para el mismo intento y cambia al siguiente", async () => {
    const solicitudes = [];
    global.fetch = vi.fn(async (_url, opciones) => {
      const body = JSON.parse(opciones.body);
      solicitudes.push({
        idempotencyKey: opciones.headers["idempotency-key"],
        body,
      });
      return {
        ok: true,
        text: async () => JSON.stringify({
          data: {
            id: body.reference,
            status: "APPROVED",
            transactions: body.transactions.map((tx) => ({
              id: `transfer-${tx.reference}`,
              reference: tx.reference,
              status: "APPROVED",
            })),
          },
        }),
      };
    });

    const pago = { id: 501 };
    await WompiPaymentProvider.dispersar({
      pago,
      dispersiones: [dispersion()],
    });
    await WompiPaymentProvider.dispersar({
      pago,
      dispersiones: [dispersion()],
    });
    await WompiPaymentProvider.dispersar({
      pago,
      dispersiones: [dispersion({ intentosFallidos: 1 })],
    });

    expect(solicitudes[0].idempotencyKey).toBe(solicitudes[1].idempotencyKey);
    expect(solicitudes[0].body).toEqual(solicitudes[1].body);
    expect(solicitudes[2].idempotencyKey).not.toBe(solicitudes[0].idempotencyKey);
    expect(solicitudes[0].body.transactions[0].reference).toMatch(/-A1$/);
    expect(solicitudes[2].body.transactions[0].reference).toMatch(/-A2$/);
  });

  it("marca como incierto un fallo de red para impedir un reenvio ciego", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("socket cerrado");
    });

    await expect(
      WompiPaymentProvider.dispersar({
        pago: { id: 502 },
        dispersiones: [dispersion()],
      })
    ).rejects.toMatchObject({
      envioIncierto: true,
      message: expect.stringMatching(/confirmar si Wompi recibio/i),
    });
  });

  it("marca como inciertos los errores 5xx y los fallos al leer la respuesta", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () => JSON.stringify({ message: "temporal" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => {
          throw new Error("respuesta truncada");
        },
      });

    await expect(
      WompiPaymentProvider.dispersar({
        pago: { id: 503 },
        dispersiones: [dispersion()],
      })
    ).rejects.toMatchObject({ envioIncierto: true });

    await expect(
      WompiPaymentProvider.dispersar({
        pago: { id: 504 },
        dispersiones: [dispersion()],
      })
    ).rejects.toMatchObject({ envioIncierto: true });
  });
});

function firmaEsperada({ reference, amountInCents, currency, expirationTime }) {
  const valores = [reference, amountInCents, currency];
  if (expirationTime) valores.push(expirationTime);
  valores.push(process.env.WOMPI_INTEGRITY_SECRET);
  return crypto.createHash("sha256").update(valores.join(""), "utf8").digest("hex");
}

describe("Wompi - firma de integridad del Web Checkout", () => {
  it("firma exactamente los parametros enviados cuando no hay expiracion", async () => {
    const resultado = await WompiPaymentProvider.crearCheckout({
      pago: {
        monto: 1234.56,
        moneda: "COP",
        providerReference: "PED-QA-SIN-EXPIRACION",
        expiraAt: null,
      },
      pedido: { id: 9001, comprador: {} },
    });
    const url = new URL(resultado.checkoutUrl);
    const reference = url.searchParams.get("reference");
    const amountInCents = url.searchParams.get("amount-in-cents");
    const currency = url.searchParams.get("currency");

    expect(url.searchParams.get("signature:integrity")).toBe(
      firmaEsperada({ reference, amountInCents, currency })
    );
    expect(url.searchParams.has("expiration-time")).toBe(false);
  });

  it("incluye la expiracion en la URL y en la firma con el mismo ISO8601", async () => {
    const expirationTime = "2026-08-01T20:30:00.000Z";
    const resultado = await WompiPaymentProvider.crearCheckout({
      pago: {
        monto: 45000,
        moneda: "COP",
        providerReference: "PED-QA-CON-EXPIRACION",
        expiraAt: expirationTime,
      },
      pedido: { id: 9002, comprador: {} },
    });
    const url = new URL(resultado.checkoutUrl);
    const reference = url.searchParams.get("reference");
    const amountInCents = url.searchParams.get("amount-in-cents");
    const currency = url.searchParams.get("currency");

    expect(url.searchParams.get("expiration-time")).toBe(expirationTime);
    expect(url.searchParams.get("signature:integrity")).toBe(
      firmaEsperada({ reference, amountInCents, currency, expirationTime })
    );
    expect(resultado.payload.expirationTime).toBe(expirationTime);
  });

  it("rechaza mezclar llave publica de prueba con secreto productivo", async () => {
    process.env.WOMPI_INTEGRITY_SECRET = "prod_integrity_checkout_qa";

    await expect(
      WompiPaymentProvider.crearCheckout({
        pago: {
          monto: 1000,
          moneda: "COP",
          providerReference: "PED-QA-AMBIENTES-MIXTOS",
        },
        pedido: { id: 9003, comprador: {} },
      })
    ).rejects.toThrow(/mismo ambiente/i);
  });
});
