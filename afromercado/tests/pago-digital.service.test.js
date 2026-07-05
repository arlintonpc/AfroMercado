// Pruebas unitarias del servicio de Pagos Digitales (pasarela)
// Ejecutar con: node tests/pago-digital.service.test.js

// ── Mocks ────────────────────────────────────────────────────────────────────
// pago-digital.service.js llama a Prisma DIRECTAMENTE (no usa un repository
// intermedio), así que sobrescribimos las propiedades del cliente Prisma
// cacheado ANTES de requerir el servicio (Node cachea módulos por referencia,
// por lo que el servicio ve estos mocks al hacer su propio require interno).

const prisma = require("../src/config/prisma");
const VisibilidadRepository = require("../src/repositories/visibilidad.repository");
const NotificacionService = require("../src/services/notificacion.service");
const providerFactory = require("../src/services/payments/provider-factory");
const PagoPublicidadService = require("../src/services/pago-publicidad.service");

// ── Estado mutable de los mocks (se reconfigura por test) ───────────────────
let mockPago = null; // registro que "vive" en la tabla Pago
let ejecutarDispersionesLlamadas = 0;
let dispersionesActualizadas = [];
let pedidoActualizado = null;
let subPedidoUpdateManyLlamadas = 0;
let comercioUpdateLlamadas = [];
let executeRawLlamadas = []; // strings del template tag ejecutado (para distinguir UPDATE stock vs UPDATE oferta)
let pagoEventosCreados = [];
let pagoEventoActualizado = null;
let forzarP2002EnPagoEventoCreate = false;
let visibilidadLlamadas = 0;

function clonarPago(base) {
  return JSON.parse(JSON.stringify(base));
}

// `tx.$executeRaw` es una template tag: se invoca como
// tx.$executeRaw`UPDATE ... ${valor} ...`. Node la llama con
// (strings, ...valores). Registramos el SQL armado y devolvemos 1 fila
// afectada por defecto (se puede forzar 0 para simular "sin stock").
let filasAfectadasExecuteRaw = 1;
function crearExecuteRawMock() {
  return async (strings, ...valores) => {
    const sql = strings.join("?");
    executeRawLlamadas.push({ sql, valores });
    return filasAfectadasExecuteRaw;
  };
}

// `tx.$queryRaw` — usado por confirmarPedidoPorPago() para el UPDATE...RETURNING
// del stock (Fase 5.3, alertas de stock bajo). Mismo control que $executeRaw
// (filasAfectadasExecuteRaw): 0 simula "sin stock" (RETURNING sin filas), 1+
// simula éxito devolviendo una fila con stock por encima de stockMinimo (así
// el "camino feliz" no dispara notificación de stock bajo salvo que un test
// la pida explícitamente sobrescribiendo prisma.$queryRaw).
function crearQueryRawMock() {
  return async (strings, ...valores) => {
    const sql = strings.join("?");
    executeRawLlamadas.push({ sql, valores, esQueryRaw: true });
    if (filasAfectadasExecuteRaw === 0) return [];
    return [{ id: 0, nombre: "Producto mock", comercioId: 42, stock: 100, stockMinimo: 0, stockBajoNotificadoAt: null }];
  };
}

// `prisma.$transaction(fn)` — el service SIEMPRE lo llama con una función,
// nunca con un array ni con opciones de isolationLevel (confirmado leyendo
// pago-digital.service.js: las 3 apariciones son `prisma.$transaction(async (tx) => {...})`).
// El mock más simple es pasar el mismo objeto prisma mockeado como "tx".
prisma.$transaction = async (fn) => fn(prisma);
prisma.$executeRaw = crearExecuteRawMock();
prisma.$queryRaw = crearQueryRawMock();

prisma.pago = {
  findUnique: async ({ where, include }) => {
    if (!mockPago) return null;
    if (where.id !== mockPago.id) return null;
    const pago = clonarPago(mockPago);
    // ejecutarDispersiones() pide include: { dispersiones: { where: {...} } }.
    // No modelamos una tabla PagoDispersion separada en este mock: el pago
    // base no trae dispersiones pendientes, así que devolvemos [] (el test
    // de "camino feliz" verifica el resto de efectos de confirmarPago(),
    // no la dispersión en sí, que se cubre indirectamente por dispersarLlamadas).
    if (include?.dispersiones) pago.dispersiones = mockPago.dispersiones || [];
    return pago;
  },
  update: async ({ where, data }) => {
    if (!mockPago || where.id !== mockPago.id) throw new Error("pago no encontrado en mock");
    mockPago = { ...mockPago, ...data };
    return clonarPago(mockPago);
  },
  findFirst: async ({ where }) => {
    if (!mockPago) return null;
    if (where.proveedor && where.proveedor !== mockPago.proveedor) return null;
    const criterios = where.OR || [];
    const coincide = criterios.some((criterio) => {
      if (criterio.providerPaymentId) return criterio.providerPaymentId === mockPago.providerPaymentId;
      if (criterio.providerReference) return criterio.providerReference === mockPago.providerReference;
      return false;
    });
    return coincide ? clonarPago(mockPago) : null;
  },
};

prisma.pedido = {
  findUnique: async () => null,
  update: async ({ where, data }) => {
    pedidoActualizado = { id: where.id, ...data };
    return pedidoActualizado;
  },
};

prisma.subPedido = {
  updateMany: async () => {
    subPedidoUpdateManyLlamadas++;
    return { count: 1 };
  },
};

prisma.comercio = {
  update: async ({ where, data }) => {
    comercioUpdateLlamadas.push({ where, data });
    return { id: where.id, ...data };
  },
};

prisma.pagoDispersion = {
  updateMany: async () => ({ count: 1 }),
  update: async ({ where, data }) => {
    const actualizado = { id: where.id, ...data };
    dispersionesActualizadas.push(actualizado);
    return actualizado;
  },
};

prisma.pagoEvento = {
  create: async ({ data }) => {
    if (forzarP2002EnPagoEventoCreate) {
      const err = new Error("Unique constraint failed on eventoId");
      err.code = "P2002";
      throw err;
    }
    const registro = { id: pagoEventosCreados.length + 1, ...data };
    pagoEventosCreados.push(registro);
    return registro;
  },
  update: async ({ where, data }) => {
    pagoEventoActualizado = { id: where.id, ...data };
    return pagoEventoActualizado;
  },
};

VisibilidadRepository.atribuirPedidoConfirmado = async () => {
  visibilidadLlamadas++;
};

NotificacionService.pagoAprobado = async () => {};

PagoPublicidadService.procesarWebhook = async () => null;

// Mock del proveedor de pagos: evitamos depender del provider real de
// sandbox/wompi. Controlamos "obtenerProveedor" para inspeccionar
// exactamente qué dispersiones se piden y devolver resultados controlados.
let dispersarResultado = [];
let dispersarLlamadas = 0;
const proveedorFake = {
  nombre: "SANDBOX",
  async dispersar({ dispersiones }) {
    dispersarLlamadas++;
    return dispersarResultado.length
      ? dispersarResultado
      : dispersiones.map((d) => ({ id: d.id, estado: "CONFIRMADA", providerTransferId: `tr_${d.id}` }));
  },
  async interpretarWebhook() {
    throw new Error("interpretarWebhook no debería usarse: el test mockea el evento directamente");
  },
};
providerFactory.obtenerProveedor = () => proveedorFake;
providerFactory.normalizarProveedor = (nombre) => String(nombre || "SANDBOX").toUpperCase();

// Ahora sí cargamos el servicio (ya ve los mocks anteriores en memoria)
const PagoDigitalService = require("../src/services/pago-digital.service");
const { ErrorNoEncontrado, ErrorValidacion } = require("../src/utils/errores");

// ── Utilidades de reporte ────────────────────────────────────────────────────
let pasadas = 0;
let fallidas = 0;

function esperar(descripcion, real, esperado) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (ok) {
    pasadas++;
    console.log(`  ✓ ${descripcion}`);
  } else {
    fallidas++;
    console.log(`  ✗ ${descripcion}`);
    console.log(`      esperado: ${JSON.stringify(esperado)}`);
    console.log(`      recibido: ${JSON.stringify(real)}`);
  }
}

async function esperarRejection(descripcion, promesa, TipoError) {
  try {
    await promesa;
    fallidas++;
    console.log(`  ✗ ${descripcion} (no lanzó error)`);
  } catch (e) {
    if (e instanceof TipoError) {
      pasadas++;
      console.log(`  ✓ ${descripcion}`);
    } else {
      fallidas++;
      console.log(`  ✗ ${descripcion} (lanzó ${e.constructor.name}, esperaba ${TipoError.name}: ${e.message})`);
    }
  }
}

// ── Datos base reutilizables ─────────────────────────────────────────────────
// Un pago con un pedido de un solo subpedido, un solo item.
function pagoBase(overrides = {}) {
  return {
    id: 501,
    pedidoId: 9001,
    monto: 24000,
    metodo: "PASARELA",
    estado: "PENDIENTE",
    proveedor: "SANDBOX",
    moneda: "COP",
    providerPaymentId: null,
    providerReference: "PED-9001-1720000000000",
    providerStatus: "CREATED",
    providerPayload: null,
    confirmadoAt: null,
    verificadoAt: null,
    notas: null,
    pedido: {
      id: 9001,
      compradorId: "user-1",
      estado: "VERIFICANDO_PAGO",
      comprador: { id: "user-1", nombre: "Compradora Test", email: "c@test.com", telefono: "3000000000" },
      subPedidos: [
        {
          id: 7001,
          comercioId: 42,
          comercio: { id: 42, nombre: "Tienda AfroTest" },
          items: [{ id: 1, productoId: 111, cantidad: 3, ofertaId: null }],
        },
      ],
    },
    ...overrides,
  };
}

function resetMocksComunes() {
  ejecutarDispersionesLlamadas = 0;
  dispersionesActualizadas = [];
  pedidoActualizado = null;
  subPedidoUpdateManyLlamadas = 0;
  comercioUpdateLlamadas = [];
  executeRawLlamadas = [];
  pagoEventosCreados = [];
  pagoEventoActualizado = null;
  forzarP2002EnPagoEventoCreate = false;
  visibilidadLlamadas = 0;
  filasAfectadasExecuteRaw = 1;
  dispersarResultado = [];
  dispersarLlamadas = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 1 — confirmarPago() es idempotente
// ─────────────────────────────────────────────────────────────────────────────
async function runConfirmarPagoIdempotenteTests() {
  console.log("\nPruebas: PagoDigitalService.confirmarPago() — idempotencia\n");

  // 1. Pago ya CONFIRMADO: no debe re-ejecutar dispersión ni duplicar efectos
  resetMocksComunes();
  mockPago = pagoBase({ estado: "CONFIRMADO", confirmadoAt: new Date("2026-01-01").toISOString() });

  const resultado = await PagoDigitalService.confirmarPago(mockPago.id, { estado: "APPROVED" });

  esperar("Pago ya confirmado: retorna el pago sin cambiar su estado", resultado.estado, "CONFIRMADO");
  esperar("Pago ya confirmado: NO llama al proveedor de dispersión", dispersarLlamadas, 0);
  esperar("Pago ya confirmado: NO marca subpedidos como CONFIRMADO de nuevo", subPedidoUpdateManyLlamadas, 0);
  esperar("Pago ya confirmado: NO descuenta stock de nuevo (sin $executeRaw)", executeRawLlamadas.length, 0);
  esperar("Pago ya confirmado: NO incrementa totalVentas del comercio de nuevo", comercioUpdateLlamadas.length, 0);
  esperar("Pago ya confirmado: NO vuelve a atribuir visibilidad", visibilidadLlamadas, 0);

  // 2. Camino feliz (control): un pago PENDIENTE sí se confirma y sí dispersa,
  // para asegurarnos de que el test anterior distingue "no hace nada" de
  // "el mock no estaba conectado".
  resetMocksComunes();
  mockPago = pagoBase({ estado: "PENDIENTE" });

  const resultado2 = await PagoDigitalService.confirmarPago(mockPago.id, { estado: "APPROVED", tipo: "webhook.test" });

  esperar("Pago PENDIENTE: pasa a estado CONFIRMADO", resultado2.estado, "CONFIRMADO");
  esperar("Pago PENDIENTE: SÍ marca el subpedido como CONFIRMADO", subPedidoUpdateManyLlamadas, 1);
  esperar("Pago PENDIENTE: SÍ descuenta stock (1 UPDATE Producto por item)", executeRawLlamadas.length, 1);
  esperar("Pago PENDIENTE: SÍ incrementa totalVentas del comercio", comercioUpdateLlamadas.length, 1);
  esperar("Pago PENDIENTE: SÍ atribuye visibilidad del pedido confirmado", visibilidadLlamadas, 1);

  // 3. Segunda llamada sobre el mismo pago (ya CONFIRMADO tras la #2): debe
  // comportarse igual que el caso 1 — sin duplicar efectos.
  const efectosAntesSegundaLlamada = {
    subPedido: subPedidoUpdateManyLlamadas,
    executeRaw: executeRawLlamadas.length,
    comercio: comercioUpdateLlamadas.length,
    visibilidad: visibilidadLlamadas,
  };
  const resultado3 = await PagoDigitalService.confirmarPago(mockPago.id, { estado: "APPROVED" });
  esperar("Segunda llamada sobre pago ya confirmado: sigue en CONFIRMADO", resultado3.estado, "CONFIRMADO");
  esperar(
    "Segunda llamada sobre pago ya confirmado: no repite ningún efecto de negocio",
    {
      subPedido: subPedidoUpdateManyLlamadas,
      executeRaw: executeRawLlamadas.length,
      comercio: comercioUpdateLlamadas.length,
      visibilidad: visibilidadLlamadas,
    },
    efectosAntesSegundaLlamada
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 2 — confirmarPago() estados no confirmables
// ─────────────────────────────────────────────────────────────────────────────
async function runConfirmarPagoEstadosTests() {
  console.log("\nPruebas: PagoDigitalService.confirmarPago() — validaciones de estado\n");

  resetMocksComunes();
  mockPago = null;
  await esperarRejection(
    "Rechaza confirmar un pago inexistente",
    PagoDigitalService.confirmarPago(99999, { estado: "APPROVED" }),
    ErrorNoEncontrado
  );

  resetMocksComunes();
  mockPago = pagoBase({ estado: "FALLIDO" });
  await esperarRejection(
    "Rechaza confirmar un pago en estado no confirmable (FALLIDO)",
    PagoDigitalService.confirmarPago(mockPago.id, { estado: "APPROVED" }),
    ErrorValidacion
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 3 — fallarPago() libera el stock reservado
// ─────────────────────────────────────────────────────────────────────────────
async function runFallarPagoTests() {
  console.log("\nPruebas: PagoDigitalService.fallarPago() — libera stock reservado\n");

  // Pedido con dos subpedidos y un item con oferta, para comprobar que se
  // libera "stockReservado" de Producto y "stockUsado" de Oferta.
  resetMocksComunes();
  mockPago = {
    id: 601,
    estado: "VERIFICANDO",
    pedido: {
      id: 9002,
      subPedidos: [
        { id: 7002, items: [{ id: 1, productoId: 111, cantidad: 2, ofertaId: null }] },
        { id: 7003, items: [{ id: 2, productoId: 222, cantidad: 1, ofertaId: 55 }] },
      ],
    },
  };

  const resultado = await PagoDigitalService.fallarPago(mockPago.id, "Rechazado por la pasarela de prueba");

  esperar("fallarPago(): el pago queda en estado FALLIDO", resultado.estado, "FALLIDO");
  esperar("fallarPago(): el pedido pasa a PAGO_FALLIDO", pedidoActualizado?.estado, "PAGO_FALLIDO");
  esperar(
    "fallarPago(): libera stockReservado + stockUsado (3 UPDATE: 2 Producto + 1 Oferta)",
    executeRawLlamadas.length,
    3
  );
  esperar(
    "fallarPago(): el UPDATE de Producto usa GREATEST(...) para no bajar de cero",
    executeRawLlamadas.some((l) => l.sql.includes('UPDATE "Producto"') && l.sql.includes("GREATEST")),
    true
  );
  esperar(
    "fallarPago(): el UPDATE de Oferta libera stockUsado del item con oferta",
    executeRawLlamadas.some((l) => l.sql.includes('UPDATE "Oferta"') && l.sql.includes("stockUsado")),
    true
  );

  // Idempotencia de fallarPago(): si ya está CONFIRMADO o FALLIDO, retorna
  // temprano sin volver a liberar stock (según el código: `if (["CONFIRMADO","FALLIDO"].includes(pago.estado)) return pago;`)
  resetMocksComunes();
  mockPago = {
    id: 602,
    estado: "FALLIDO",
    pedido: { id: 9003, subPedidos: [{ id: 7004, items: [{ id: 3, productoId: 333, cantidad: 5, ofertaId: null }] }] },
  };
  await PagoDigitalService.fallarPago(mockPago.id, "Segundo intento de fallo");
  esperar("fallarPago() sobre un pago ya FALLIDO no libera stock de nuevo", executeRawLlamadas.length, 0);

  resetMocksComunes();
  mockPago = null;
  await esperarRejection(
    "fallarPago() rechaza un pago inexistente",
    PagoDigitalService.fallarPago(88888, "motivo cualquiera"),
    ErrorNoEncontrado
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 4 — procesarWebhook(): monto reportado no coincide
// ─────────────────────────────────────────────────────────────────────────────
async function runWebhookMontoTests() {
  console.log("\nPruebas: PagoDigitalService.procesarWebhook() — validación de monto\n");

  // pago.monto = 24000 → esperado en centavos = 2400000
  resetMocksComunes();
  mockPago = pagoBase({ estado: "PENDIENTE", monto: 24000 });
  providerFactory.__eventoInterpretado = null;
  proveedorFake.interpretarWebhook = async () => ({
    eventoId: "evt-monto-distinto",
    tipo: "payment.status.changed",
    estado: "APPROVED",
    providerPaymentId: null,
    providerReference: mockPago.providerReference,
    payload: { data: { transaction: { amount_in_cents: 1000000 } } }, // 10.000 COP, distinto de 24.000
    firma: null,
  });

  await esperarRejection(
    "Rechaza el webhook cuando el monto reportado no coincide con el esperado",
    PagoDigitalService.procesarWebhook("SANDBOX", { body: {}, headers: {}, rawBody: "" }),
    ErrorValidacion
  );
  esperar(
    "Monto no coincide: el pago NO se marca como CONFIRMADO",
    mockPago.estado,
    "PENDIENTE"
  );
  esperar(
    "Monto no coincide: se registra el error en el PagoEvento antes de relanzar",
    pagoEventoActualizado?.errorMensaje != null,
    true
  );

  // Camino feliz de control: mismo monto exacto → sí confirma.
  resetMocksComunes();
  mockPago = pagoBase({ estado: "PENDIENTE", monto: 24000 });
  proveedorFake.interpretarWebhook = async () => ({
    eventoId: "evt-monto-correcto",
    tipo: "payment.status.changed",
    estado: "APPROVED",
    providerPaymentId: "pay_ok_123",
    providerReference: mockPago.providerReference,
    payload: { data: { transaction: { amount_in_cents: 2400000 } } }, // exactamente 24.000 COP
    firma: null,
  });

  const resultadoOk = await PagoDigitalService.procesarWebhook("SANDBOX", { body: {}, headers: {}, rawBody: "" });
  esperar("Monto correcto: el webhook se procesa OK", resultadoOk, { ok: true, recibido: true, procesado: true });
  esperar("Monto correcto: el pago sí queda CONFIRMADO", mockPago.estado, "CONFIRMADO");
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 5 — procesarWebhook(): evento duplicado
// ─────────────────────────────────────────────────────────────────────────────
async function runWebhookDuplicadoTests() {
  console.log("\nPruebas: PagoDigitalService.procesarWebhook() — evento duplicado\n");

  // Simulamos que la restricción única de PagoEvento (eventoId/proveedor)
  // ya existe para este evento: prisma.pagoEvento.create lanza P2002.
  resetMocksComunes();
  mockPago = pagoBase({ estado: "PENDIENTE" });
  forzarP2002EnPagoEventoCreate = true;
  proveedorFake.interpretarWebhook = async () => ({
    eventoId: "evt-repetido",
    tipo: "payment.status.changed",
    estado: "APPROVED",
    providerPaymentId: null,
    providerReference: mockPago.providerReference,
    payload: { data: { transaction: { amount_in_cents: 2400000 } } },
    firma: null,
  });

  let resultado;
  let lanzo = false;
  try {
    resultado = await PagoDigitalService.procesarWebhook("SANDBOX", { body: {}, headers: {}, rawBody: "" });
  } catch (e) {
    lanzo = true;
  }

  esperar("Evento duplicado: no lanza excepción (P2002 se maneja sin explotar)", lanzo, false);
  esperar("Evento duplicado: responde { ok: true, duplicado: true }", resultado, { ok: true, duplicado: true });
  esperar("Evento duplicado: el pago NO se toca (sigue PENDIENTE)", mockPago.estado, "PENDIENTE");
  esperar("Evento duplicado: no se dispara ninguna dispersión", dispersarLlamadas, 0);
}

// ── Ejecución ─────────────────────────────────────────────────────────────────
(async () => {
  try {
    await runConfirmarPagoIdempotenteTests();
    await runConfirmarPagoEstadosTests();
    await runFallarPagoTests();
    await runWebhookMontoTests();
    await runWebhookDuplicadoTests();
  } catch (err) {
    console.error("\nError inesperado en la suite de pruebas:", err);
    process.exit(1);
  }

  console.log(`\nResultado: ${pasadas} pasadas, ${fallidas} fallidas\n`);
  process.exit(fallidas > 0 ? 1 : 0);
})();
