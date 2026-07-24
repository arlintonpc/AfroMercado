// Suite Vitest — checkout de Pedido (marketplace general).
// Sigue la misma técnica de mocking que tests/hotel.service.test.js:
// se mutan las propiedades de los módulos compartidos (prisma, repositorios)
// ANTES de requerir el servicio bajo prueba, para que este vea los mocks al
// hacer su propio require. Ver esa nota en hotel.service.test.js para el detalle.
//
// Corre con: npm run test:vitest (aislado de los tests legacy vía vitest.config.js)

import { describe, it, expect, beforeEach } from "vitest";

const prisma = require("../src/config/prisma");
const ConfigRepository = require("../src/repositories/config.repository");
const CarritoRepository = require("../src/repositories/carrito.repository");
const PedidoRepository = require("../src/repositories/pedido.repository");
const ConfigFiscalRepository = require("../src/repositories/config-fiscal.repository");
const NotificacionService = require("../src/services/notificacion.service");

// ── Mocks de infraestructura compartida ─────────────────────────────────────
prisma.$transaction = async (fn) => fn(prisma);
prisma.carritoItem = { deleteMany: async () => ({ count: 0 }) };
prisma.tarifaEnvio = { findMany: async () => [{ pesoMaxKg: 1000, precio: 8000, activa: true }] };

ConfigRepository.obtener = async () => null; // Reglas cae a sus valores por defecto
ConfigRepository.obtenerVarios = async () => ({});
ConfigFiscalRepository.buscarPorComercioIds = async () => new Map();
NotificacionService.checkoutCompletado = async () => {};

// Cola de resultados para prisma.$executeRaw — cada test la configura antes de llamar checkout().
// Se distingue la sentencia de reserva de stock ("stockReservado") de la de oferta ("stockUsado")
// inspeccionando los fragmentos literales del template tag.
let resultadoReservaStock = 1;
prisma.$executeRaw = (strings) => {
  const sql = strings.join("");
  if (sql.includes('"stockReservado"')) return Promise.resolve(resultadoReservaStock);
  if (sql.includes('"stockUsado"')) return Promise.resolve(1);
  return Promise.resolve(1);
};

// Requerido DESPUÉS de fijar los mocks de arriba, para que sus `require()` internos
// (ConfigRepository, etc.) vean ya las versiones mockeadas.
const PedidoService = require("../src/services/pedido.service");
const { ErrorValidacion } = require("../src/utils/errores");

function productoFake(overrides = {}) {
  return {
    id: 1,
    comercioId: 10,
    nombre: "Borojó fresco",
    precio: 20000,
    stock: 5,
    stockReservado: 4,
    pesoKg: 1,
    ofertas: [],
    comercio: { id: 10, usuarioId: "comerciante-1" },
    ...overrides,
  };
}

function carritoFake(producto, cantidad = 1) {
  return [
    {
      productoId: producto.id,
      cantidad,
      precioAlAgregar: producto.precio,
      producto,
    },
  ];
}

const DATOS_ENTREGA = { direccionTexto: "Calle 1, Quibdó", departamento: "Chocó" };

beforeEach(() => {
  resultadoReservaStock = 1;
  prisma.comercio = { findFirst: async () => null }; // por defecto: comprador no es dueño de la tienda
  prisma.comisionComercio = { findMany: async () => [] };
  prisma.config = { findUnique: async () => null };
  CarritoRepository.obtenerCarrito = async () => carritoFake(productoFake());
  PedidoRepository.crear = async (datos) => ({ id: 999, ...datos });
});

describe("PedidoService.checkout — reserva atómica de stock", () => {
  it("rechaza el pedido si la fila de stock ya fue tomada por otro comprador (0 filas afectadas)", async () => {
    resultadoReservaStock = 0; // simula que otro comprador ganó la carrera por el stock
    let pedidoRepositoryLlamado = false;
    PedidoRepository.crear = async (datos) => {
      pedidoRepositoryLlamado = true;
      return { id: 999, ...datos };
    };

    await expect(PedidoService.checkout("comprador-1", DATOS_ENTREGA)).rejects.toThrow(ErrorValidacion);
    expect(pedidoRepositoryLlamado).toBe(false);
  });

  it("confirma el pedido cuando la reserva de stock sí afecta una fila", async () => {
    resultadoReservaStock = 1;

    const resultado = await PedidoService.checkout("comprador-1", DATOS_ENTREGA);

    expect(resultado.pedido.id).toBe(999);
    expect(resultado.instruccionesPago.total).toBeGreaterThan(0);
  });
});

describe("PedidoService.checkout — reglas de negocio básicas", () => {
  it("rechaza comprar productos de tu propia tienda", async () => {
    prisma.comercio = { findFirst: async () => ({ id: 10 }) }; // el comprador SÍ es dueño de ese comercio

    await expect(PedidoService.checkout("comerciante-1", DATOS_ENTREGA)).rejects.toThrow(ErrorValidacion);
  });

  it("rechaza el checkout con el carrito vacío", async () => {
    CarritoRepository.obtenerCarrito = async () => [];

    await expect(PedidoService.checkout("comprador-1", DATOS_ENTREGA)).rejects.toThrow(ErrorValidacion);
  });

  it("rechaza el checkout sin dirección de entrega", async () => {
    await expect(PedidoService.checkout("comprador-1", { departamento: "Chocó" })).rejects.toThrow(
      ErrorValidacion
    );
  });
});
