// Suite Vitest — CarritoService.
// Misma técnica de mocking que el resto de la suite nueva: mutar las
// propiedades de los repositorios ANTES de requerir el servicio bajo prueba.
// Corre con: npm run test:vitest

import { describe, it, expect, beforeEach } from "vitest";

const CarritoRepository = require("../src/repositories/carrito.repository");
const ProductoRepository = require("../src/repositories/producto.repository");

const CarritoService = require("../src/services/carrito.service");
const { ErrorValidacion, ErrorNoEncontrado } = require("../src/utils/errores");

function comercioComprableFake(overrides = {}) {
  return {
    activo: true,
    verificado: true,
    estadoRegistro: "APROBADO",
    fotoDocumentoUrl: "doc-frente.jpg",
    fotoDocumentoReversoUrl: "doc-reverso.jpg",
    cuentaDispersion: { estado: "VERIFICADA" },
    nombre: "Finca Baudó",
    municipio: "Quibdó",
    totalVentas: 12,
    calificacion: 4.8,
    ...overrides,
  };
}

function productoFake(overrides = {}) {
  return {
    id: 1,
    nombre: "Borojó fresco",
    precio: 20000,
    unidad: "KG",
    stock: 10,
    stockReservado: 2,
    activo: true,
    deletedAt: null,
    diasAlistamientoMin: 1,
    diasAlistamientoMax: 3,
    alcance: "NACIONAL",
    ofertas: [],
    fotoUrl: null,
    comercio: comercioComprableFake(),
    ...overrides,
  };
}

function carritoItemCrudoFake(producto, cantidad, precioAlAgregar) {
  return {
    productoId: producto.id,
    cantidad,
    precioAlAgregar,
    producto,
  };
}

let ultimoCarritoGuardado = null;

beforeEach(() => {
  ultimoCarritoGuardado = null;
  ProductoRepository.buscarPublicoPorId = async () => productoFake();
  CarritoRepository.obtenerCarrito = async () => [];
  CarritoRepository.agregarItem = async (usuarioId, productoId, cantidad, precioFinal) => {
    ultimoCarritoGuardado = { productoId, cantidad, precioFinal };
  };
  CarritoRepository.actualizarCantidad = async (usuarioId, productoId, cantidad, precioFinal) => {
    ultimoCarritoGuardado = { productoId, cantidad, precioFinal };
  };
  CarritoRepository.eliminarItem = async () => {};
  CarritoRepository.vaciarCarrito = async () => {};
});

describe("CarritoService.agregar — reglas de negocio", () => {
  it("rechaza agregar un producto de un comercio sin cuenta de dispersión verificada (contacto directo)", async () => {
    ProductoRepository.buscarPublicoPorId = async () =>
      productoFake({ comercio: comercioComprableFake({ cuentaDispersion: { estado: "PENDIENTE" } }) });

    await expect(CarritoService.agregar("comprador-1", "1", 1)).rejects.toThrow(ErrorValidacion);
    expect(ultimoCarritoGuardado).toBeNull();
  });

  it("rechaza agregar si el stock disponible es insuficiente", async () => {
    ProductoRepository.buscarPublicoPorId = async () => productoFake({ stock: 5, stockReservado: 5 }); // 0 disponible

    await expect(CarritoService.agregar("comprador-1", "1", 1)).rejects.toThrow(ErrorValidacion);
    expect(ultimoCarritoGuardado).toBeNull();
  });

  it("rechaza agregar un producto inactivo o inexistente", async () => {
    ProductoRepository.buscarPublicoPorId = async () => null;

    await expect(CarritoService.agregar("comprador-1", "1", 1)).rejects.toThrow(ErrorNoEncontrado);
  });

  it("agrega correctamente cuando el producto es comprable y hay stock", async () => {
    await CarritoService.agregar("comprador-1", "1", 2);

    expect(ultimoCarritoGuardado).not.toBeNull();
    expect(ultimoCarritoGuardado.cantidad).toBe(2);
    expect(ultimoCarritoGuardado.precioFinal).toBe(20000);
  });
});

describe("CarritoService.actualizarCantidad — reglas de negocio", () => {
  it("rechaza actualizar a una cantidad que excede el stock disponible", async () => {
    ProductoRepository.buscarPublicoPorId = async () => productoFake({ stock: 3, stockReservado: 1 }); // 2 disponibles

    await expect(CarritoService.actualizarCantidad("comprador-1", "1", 5)).rejects.toThrow(ErrorValidacion);
  });
});

describe("CarritoService.obtener — construcción de totales", () => {
  it("calcula el subtotal usando el precio base cuando no hay oferta vigente", async () => {
    const producto = productoFake();
    CarritoRepository.obtenerCarrito = async () => [carritoItemCrudoFake(producto, 3, 20000)];

    const carrito = await CarritoService.obtener("comprador-1");

    expect(carrito.cantidadTotal).toBe(3);
    expect(carrito.subtotal).toBe(60000);
  });

  it("calcula el subtotal usando el precio de oferta cuando hay una oferta vigente", async () => {
    const ahora = new Date();
    const producto = productoFake({
      ofertas: [
        {
          id: 1,
          tipo: "PORCENTAJE",
          valor: 20,
          activa: true,
          inicio: new Date(ahora.getTime() - 86400000),
          fin: new Date(ahora.getTime() + 86400000),
          stockLimite: null,
          stockUsado: 0,
        },
      ],
    });
    CarritoRepository.obtenerCarrito = async () => [carritoItemCrudoFake(producto, 2, 20000)];

    const carrito = await CarritoService.obtener("comprador-1");

    // 20000 con 20% de descuento = 16000 por unidad x 2 = 32000
    expect(carrito.subtotal).toBe(32000);
    expect(carrito.items[0].alertaPrecio).toBe(true); // el precio cambió desde que se agregó (20000 -> 16000)
  });
});
