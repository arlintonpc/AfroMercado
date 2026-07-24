// Suite Vitest — FacturacionService.emitirParaReferencia().
// Misma técnica de mocking que el resto de la suite nueva: mutar las
// propiedades de los módulos compartidos ANTES de requerir el servicio.
// Corre con: npm run test:vitest

import { describe, it, expect, beforeEach } from "vitest";

const prisma = require("../src/config/prisma");
const providerFactory = require("../src/services/facturacion/facturacion.provider-factory");

// Proveedor fake — configurable por test via `resultadoEmitir` / `debeFallar`.
// OJO: `emitirFactura`/`anularFactura` se definen UNA sola vez y leen las
// variables de estado en cada llamada — no reasignar estas funciones dentro
// de un test individual, o el override queda "pegado" en los tests siguientes
// (beforeEach no restaura funciones reasignadas, solo las variables de estado).
let resultadoEmitir = { estado: "ENVIADA", cufe: "cufe-123", numeroFactura: "F-1" };
let debeFallar = false;
let llamadasAlProveedor = 0;
const proveedorFake = {
  async emitirFactura() {
    llamadasAlProveedor += 1;
    if (debeFallar) throw new Error("Proveedor no disponible");
    return resultadoEmitir;
  },
  async anularFactura() {
    return { ok: true };
  },
};
providerFactory.obtenerProveedorConfigurado = async () => ({ nombre: "NINGUNO", provider: proveedorFake });

const FacturacionService = require("../src/services/facturacion.service");
const { ErrorValidacion, ErrorNoEncontrado } = require("../src/utils/errores");

let facturasDB = new Map();
let nextFacturaId = 1;

function subPedidoFake(overrides = {}) {
  return {
    id: 10,
    comercioId: 5,
    subtotal: 100000,
    iva: 0,
    pedido: { compradorId: "comprador-1" },
    ...overrides,
  };
}

beforeEach(() => {
  facturasDB = new Map();
  nextFacturaId = 1;
  resultadoEmitir = { estado: "ENVIADA", cufe: "cufe-123", numeroFactura: "F-1" };
  debeFallar = false;
  llamadasAlProveedor = 0;

  prisma.subPedido = { findUnique: async () => subPedidoFake() };
  prisma.facturaElectronica = {
    findUnique: async ({ where }) => {
      if (where.id !== undefined) {
        return [...facturasDB.values()].find((f) => f.id === where.id) ?? null;
      }
      const { moduloOrigen, referenciaId } = where.moduloOrigen_referenciaId;
      return facturasDB.get(`${moduloOrigen}:${referenciaId}`) ?? null;
    },
    create: async ({ data }) => {
      const factura = { id: nextFacturaId++, intentosFallidos: 0, ...data };
      facturasDB.set(`${factura.moduloOrigen}:${factura.referenciaId}`, factura);
      return factura;
    },
    update: async ({ where, data }) => {
      const factura = [...facturasDB.values()].find((f) => f.id === where.id);
      // Simula Prisma `{ increment: N }` — leer el valor numérico ANTES de
      // Object.assign, que si no sobrescribe intentosFallidos con el objeto
      // {increment} crudo en vez de sumarlo.
      const valorAnterior = factura.intentosFallidos || 0;
      const esIncremento = data.intentosFallidos && typeof data.intentosFallidos === "object";
      Object.assign(factura, data);
      if (esIncremento) {
        factura.intentosFallidos = valorAnterior + data.intentosFallidos.increment;
      }
      return factura;
    },
  };
});

describe("FacturacionService.emitirParaReferencia — validaciones", () => {
  it("rechaza un moduloOrigen que no está en el enum válido", async () => {
    await expect(FacturacionService.emitirParaReferencia("NO_EXISTE", 1)).rejects.toThrow(ErrorValidacion);
  });

  it("CULTURA sin comercio asociado no aplica facturación", async () => {
    prisma.reservaCultural = {
      findUnique: async () => ({ id: 1, total: 50000, clienteId: "u1", evento: { comercioId: null } }),
    };
    await expect(FacturacionService.emitirParaReferencia("CULTURA", 1)).rejects.toThrow(ErrorValidacion);
  });
});

describe("FacturacionService.emitirParaReferencia — idempotencia", () => {
  it("no vuelve a emitir si ya existe una factura ACEPTADA para la misma referencia", async () => {
    facturasDB.set("PEDIDO:10", { id: 99, moduloOrigen: "PEDIDO", referenciaId: 10, estado: "ACEPTADA" });

    const resultado = await FacturacionService.emitirParaReferencia("PEDIDO", 10);

    expect(resultado.id).toBe(99);
    expect(llamadasAlProveedor).toBe(0);
  });
});

describe("FacturacionService.emitirParaReferencia — emisión real (PEDIDO)", () => {
  it("crea la factura, llama al proveedor y guarda el resultado", async () => {
    const factura = await FacturacionService.emitirParaReferencia("PEDIDO", 10);

    expect(factura.estado).toBe("ENVIADA");
    expect(factura.cufe).toBe("cufe-123");
    expect(factura.comercioId).toBe(5);
    expect(factura.total).toBe(100000);
  });

  it("si el proveedor falla, marca ERROR y programa el próximo reintento con backoff", async () => {
    debeFallar = true;

    const factura = await FacturacionService.emitirParaReferencia("PEDIDO", 10);

    expect(factura.estado).toBe("ERROR");
    expect(factura.intentosFallidos).toBe(1);
    expect(factura.errorMensaje).toContain("Proveedor no disponible");
    expect(factura.proximoReintentoAt).toBeInstanceOf(Date);
  });
});
