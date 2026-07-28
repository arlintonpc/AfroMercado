import { beforeEach, describe, expect, it } from "vitest";

/**
 * Contrato de Inventario Operativo (Fase 1)
 *
 * El modulo aun no existe. Esta suite define el comportamiento que deberan
 * cumplir InventarioOperativoService y su repositorio cuando se implementen.
 * El mock conserva la forma de las operaciones esperadas y evita depender de
 * Prisma o de una base de datos real.
 *
 * Operaciones previstas:
 * - recibirCompra({ comercioId, productoId, recepcionId, cantidad, costoUnitario })
 * - registrarMovimiento({ comercioId, productoId, tipo, cantidad, motivo })
 * - registrarSalidaVenta({ comercioId, productoId, ventaId, cantidad })
 * - obtenerKardex({ comercioId, productoId })
 */

class ErrorInventario extends Error {}

class InventarioOperativoContractMock {
  constructor() {
    this.productos = new Map();
    this.movimientos = [];
    this.recepciones = new Map();
  }

  registrarProducto({ comercioId, productoId, stock = 0, costoPromedio = 0 }) {
    this.productos.set(`${comercioId}:${productoId}`, {
      comercioId,
      productoId,
      stock,
      costoPromedio,
    });
  }

  #producto(comercioId, productoId) {
    const producto = this.productos.get(`${comercioId}:${productoId}`);
    if (!producto) throw new ErrorInventario("Producto no pertenece al comercio");
    return producto;
  }

  #movimiento({ comercioId, productoId, tipo, cantidad, costoUnitario = null, referencia = null, motivo = null }) {
    const producto = this.#producto(comercioId, productoId);
    const movimiento = {
      comercioId,
      productoId,
      tipo,
      cantidad,
      costoUnitario,
      costoPromedioPosterior: producto.costoPromedio,
      referencia,
      motivo,
      stockPosterior: producto.stock,
    };
    this.movimientos.push(movimiento);
    return movimiento;
  }

  recibirCompra({ comercioId, productoId, recepcionId, cantidad, costoUnitario }) {
    if (!Number.isInteger(cantidad) || cantidad <= 0 || Number(costoUnitario) < 0) {
      throw new ErrorInventario("La recepcion requiere cantidad positiva y costo valido");
    }

    const claveRecepcion = `${comercioId}:${recepcionId}`;
    const recibida = this.recepciones.get(claveRecepcion);
    if (recibida) {
      if (recibida.productoId !== productoId || recibida.cantidad !== cantidad || recibida.costoUnitario !== costoUnitario) {
        throw new ErrorInventario("La recepcion idempotente no coincide con el payload original");
      }
      return { ...recibida, idempotente: true };
    }

    const producto = this.#producto(comercioId, productoId);
    const valorAnterior = producto.stock * producto.costoPromedio;
    const valorRecibido = cantidad * costoUnitario;
    producto.stock += cantidad;
    producto.costoPromedio = (valorAnterior + valorRecibido) / producto.stock;

    const resultado = {
      productoId,
      recepcionId,
      cantidad,
      costoUnitario,
      stockPosterior: producto.stock,
      costoPromedioPosterior: producto.costoPromedio,
    };
    this.recepciones.set(claveRecepcion, resultado);
    this.#movimiento({ comercioId, productoId, tipo: "COMPRA", cantidad, costoUnitario, referencia: recepcionId });
    return { ...resultado, idempotente: false };
  }

  registrarMovimiento({ comercioId, productoId, tipo, cantidad, motivo }) {
    if (!Number.isInteger(cantidad) || cantidad <= 0) throw new ErrorInventario("La cantidad debe ser un entero positivo");
    if (!["MERMA", "AJUSTE_ENTRADA", "AJUSTE_SALIDA"].includes(tipo)) throw new ErrorInventario("Tipo de movimiento no permitido");
    if (!motivo?.trim()) throw new ErrorInventario("El motivo es obligatorio para ajustes y mermas");

    const producto = this.#producto(comercioId, productoId);
    const esSalida = tipo === "MERMA" || tipo === "AJUSTE_SALIDA";
    if (esSalida && producto.stock < cantidad) throw new ErrorInventario("El movimiento dejaria stock negativo");
    producto.stock += esSalida ? -cantidad : cantidad;
    return this.#movimiento({ comercioId, productoId, tipo, cantidad, motivo });
  }

  registrarSalidaVenta({ comercioId, productoId, ventaId, cantidad }) {
    if (!Number.isInteger(cantidad) || cantidad <= 0) throw new ErrorInventario("La cantidad vendida debe ser un entero positivo");
    const producto = this.#producto(comercioId, productoId);
    if (producto.stock < cantidad) throw new ErrorInventario("La venta dejaria stock negativo");
    producto.stock -= cantidad;
    return this.#movimiento({ comercioId, productoId, tipo: "VENTA", cantidad, referencia: ventaId, costoUnitario: producto.costoPromedio });
  }

  obtenerKardex({ comercioId, productoId }) {
    this.#producto(comercioId, productoId);
    return this.movimientos.filter((movimiento) => movimiento.comercioId === comercioId && movimiento.productoId === productoId);
  }
}

const COMERCIO_A = "comercio-a";
const COMERCIO_B = "comercio-b";
const PRODUCTO_COMPARTIDO = 101;

let inventario;

beforeEach(() => {
  inventario = new InventarioOperativoContractMock();
  inventario.registrarProducto({ comercioId: COMERCIO_A, productoId: PRODUCTO_COMPARTIDO, stock: 10, costoPromedio: 1000 });
  inventario.registrarProducto({ comercioId: COMERCIO_B, productoId: PRODUCTO_COMPARTIDO, stock: 3, costoPromedio: 2500 });
});

describe("Contrato de inventario operativo", () => {
  it("aísla el kardex y el stock por comercio aunque el productoId coincida", () => {
    inventario.recibirCompra({ comercioId: COMERCIO_A, productoId: PRODUCTO_COMPARTIDO, recepcionId: "OC-A-1", cantidad: 5, costoUnitario: 2000 });

    expect(inventario.obtenerKardex({ comercioId: COMERCIO_A, productoId: PRODUCTO_COMPARTIDO })).toHaveLength(1);
    expect(inventario.obtenerKardex({ comercioId: COMERCIO_B, productoId: PRODUCTO_COMPARTIDO })).toHaveLength(0);
    expect(inventario.productos.get(`${COMERCIO_A}:${PRODUCTO_COMPARTIDO}`).stock).toBe(15);
    expect(inventario.productos.get(`${COMERCIO_B}:${PRODUCTO_COMPARTIDO}`).stock).toBe(3);
    expect(() => inventario.obtenerKardex({ comercioId: COMERCIO_B, productoId: 999 })).toThrow(ErrorInventario);
  });

  it("hace idempotente una recepcion de compra y rechaza reutilizar su id con otro payload", () => {
    const entrada = { comercioId: COMERCIO_A, productoId: PRODUCTO_COMPARTIDO, recepcionId: "OC-A-2", cantidad: 4, costoUnitario: 1500 };

    expect(inventario.recibirCompra(entrada)).toMatchObject({ idempotente: false, stockPosterior: 14 });
    expect(inventario.recibirCompra(entrada)).toMatchObject({ idempotente: true, stockPosterior: 14 });
    expect(inventario.obtenerKardex({ comercioId: COMERCIO_A, productoId: PRODUCTO_COMPARTIDO })).toHaveLength(1);
    expect(() => inventario.recibirCompra({ ...entrada, cantidad: 5 })).toThrow("no coincide");
  });

  it("nunca permite que una merma o venta deje stock negativo", () => {
    expect(() => inventario.registrarMovimiento({ comercioId: COMERCIO_A, productoId: PRODUCTO_COMPARTIDO, tipo: "MERMA", cantidad: 11, motivo: "Producto danado" })).toThrow("stock negativo");
    expect(() => inventario.registrarSalidaVenta({ comercioId: COMERCIO_A, productoId: PRODUCTO_COMPARTIDO, ventaId: "PED-1", cantidad: 11 })).toThrow("stock negativo");
    expect(inventario.productos.get(`${COMERCIO_A}:${PRODUCTO_COMPARTIDO}`).stock).toBe(10);
  });

  it("calcula costo promedio ponderado al recibir inventario", () => {
    // (10 unidades * 1.000 + 5 unidades * 2.000) / 15 = 1.333,333...
    const recepcion = inventario.recibirCompra({ comercioId: COMERCIO_A, productoId: PRODUCTO_COMPARTIDO, recepcionId: "OC-A-3", cantidad: 5, costoUnitario: 2000 });

    expect(recepcion.costoPromedioPosterior).toBeCloseTo(1333.333333, 5);
    expect(inventario.productos.get(`${COMERCIO_A}:${PRODUCTO_COMPARTIDO}`).costoPromedio).toBeCloseTo(1333.333333, 5);
  });

  it("valoriza existencias con el costo promedio vigente", () => {
    inventario.recibirCompra({ comercioId: COMERCIO_A, productoId: PRODUCTO_COMPARTIDO, recepcionId: "OC-A-VALOR", cantidad: 5, costoUnitario: 2000 });
    const producto = inventario.productos.get(`${COMERCIO_A}:${PRODUCTO_COMPARTIDO}`);

    expect(producto.stock * producto.costoPromedio).toBeCloseTo(20000, 5);
  });

  it("deja trazabilidad para merma y ajustes, con motivo y stock posterior", () => {
    inventario.registrarMovimiento({ comercioId: COMERCIO_A, productoId: PRODUCTO_COMPARTIDO, tipo: "MERMA", cantidad: 2, motivo: "Vencimiento" });
    inventario.registrarMovimiento({ comercioId: COMERCIO_A, productoId: PRODUCTO_COMPARTIDO, tipo: "AJUSTE_ENTRADA", cantidad: 1, motivo: "Conteo fisico" });

    expect(inventario.obtenerKardex({ comercioId: COMERCIO_A, productoId: PRODUCTO_COMPARTIDO })).toEqual([
      expect.objectContaining({ tipo: "MERMA", cantidad: 2, motivo: "Vencimiento", stockPosterior: 8 }),
      expect.objectContaining({ tipo: "AJUSTE_ENTRADA", cantidad: 1, motivo: "Conteo fisico", stockPosterior: 9 }),
    ]);
    expect(() => inventario.registrarMovimiento({ comercioId: COMERCIO_A, productoId: PRODUCTO_COMPARTIDO, tipo: "AJUSTE_SALIDA", cantidad: 1, motivo: "" })).toThrow("motivo");
  });

  it("registra una venta como salida con referencia y costo vigente", () => {
    inventario.recibirCompra({ comercioId: COMERCIO_A, productoId: PRODUCTO_COMPARTIDO, recepcionId: "OC-A-4", cantidad: 10, costoUnitario: 2000 });
    const salida = inventario.registrarSalidaVenta({ comercioId: COMERCIO_A, productoId: PRODUCTO_COMPARTIDO, ventaId: "PED-500", cantidad: 3 });

    expect(salida).toMatchObject({ tipo: "VENTA", cantidad: 3, referencia: "PED-500", stockPosterior: 17 });
    expect(salida.costoUnitario).toBeCloseTo(1500, 5);
    expect(inventario.obtenerKardex({ comercioId: COMERCIO_A, productoId: PRODUCTO_COMPARTIDO })).toHaveLength(2);
  });
});
