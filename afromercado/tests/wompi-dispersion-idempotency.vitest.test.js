import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cifrarNumeroCuenta } = require("../src/utils/cuentas-dispersion");
const WompiPaymentProvider = require(
  "../src/services/payments/providers/wompi.provider"
);

const VARIABLES = [
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
