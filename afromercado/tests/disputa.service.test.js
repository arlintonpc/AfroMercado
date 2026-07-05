// Pruebas unitarias del servicio de Disputas
// Ejecutar con: node tests/disputa.service.test.js

// ── Mocks ────────────────────────────────────────────────────────────────────
// DisputaService llama a `prisma` DIRECTAMENTE para el modelo Disputa (no tiene
// repository propio), pero SÍ usa ComercioRepository y ConfigRepository para
// otras cosas. Sobreescribimos ambos ANTES de requerir el servicio.

const prisma = require("../src/config/prisma");
const ComercioRepository = require("../src/repositories/comercio.repository");
const ConfigRepository = require("../src/repositories/config.repository");
const NotificacionService = require("../src/services/notificacion.service");

// Estado mutable de los mocks (se puede sobreescribir por test)
let mockConfigVentana = null; // null => usa el default de la constante
let mockSubPedido = null;
let mockDisputaExistente = null;
let disputaCreadaData = null;
let mockDisputa = null;
let mockUpdateManyCount = 1;
let updateManyDataRecibida = null;

ConfigRepository.obtener = async (clave) => {
  if (clave === "DISPUTA_VENTANA_HORAS") return mockConfigVentana;
  return null;
};

prisma.subPedido = {
  findUnique: async () => mockSubPedido,
};

prisma.disputa = {
  findFirst: async () => mockDisputaExistente,
  findUnique: async () => mockDisputa,
  create: async (args) => {
    disputaCreadaData = args.data;
    return { id: "disputa-nueva", estado: "ABIERTA", ...args.data };
  },
  updateMany: async (args) => {
    updateManyDataRecibida = args.data;
    return { count: mockUpdateManyCount };
  },
};

prisma.accionModeracion = {
  create: async () => ({ id: "accion-1" }),
};

// Notificaciones son "fire and forget" (.catch()) en el service — las
// neutralizamos para que la suite no dependa de prisma.comercio/prisma.notificacion.
NotificacionService.disputaCreada = async () => {};
NotificacionService.disputaRespondidaComercio = async () => {};
NotificacionService.disputaResuelta = async () => {};

// Ahora sí cargamos el servicio (ya ve los mocks en memoria)
const DisputaService = require("../src/services/disputa.service");
const { ErrorValidacion, ErrorNoEncontrado, ErrorProhibido } = require("../src/utils/errores");

// ── Utilidades de reporte ─────────────────────────────────────────────────────
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

// ── Datos base ────────────────────────────────────────────────────────────────
// Un SubPedido ENTREGADO hace 10 horas: dentro de la ventana default de 72h
const HORA_MS = 3600_000;
function subPedidoEntregadoHaceHoras(horas) {
  return {
    id: 1,
    comercioId: "comercio-1",
    subtotal: "24000",
    neto: "21600",
    estado: "ENTREGADO",
    updatedAt: new Date(Date.now() - horas * HORA_MS),
    pedido: { compradorId: "cliente-1" },
  };
}

const datosDisputaValidos = {
  moduloOrigen: "PEDIDO",
  referenciaId: 1,
  motivo: "PRODUCTO_DEFECTUOSO",
  descripcion: "El producto llegó dañado",
  evidenciaUrls: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 1 — crear(): ventana de horas para reportar
// ─────────────────────────────────────────────────────────────────────────────
async function runVentanaReporteTests() {
  console.log("\nPruebas: DisputaService.crear() — ventana de reporte\n");

  // 1. Dentro de la ventana default (72h): acepta
  mockConfigVentana = null; // ConfigRepository.obtener devuelve null => usa default
  mockSubPedido = subPedidoEntregadoHaceHoras(10);
  mockDisputaExistente = null;
  disputaCreadaData = null;
  const disputa = await DisputaService.crear("cliente-1", datosDisputaValidos);
  esperar(
    "Acepta reporte dentro de la ventana default de 72 horas",
    disputaCreadaData !== null && disputa.id === "disputa-nueva",
    true
  );

  // 2. Fuera de la ventana default (72h): rechaza
  mockSubPedido = subPedidoEntregadoHaceHoras(100);
  mockDisputaExistente = null;
  disputaCreadaData = null;
  await esperarRejection(
    "Rechaza reporte fuera de la ventana default de 72 horas",
    DisputaService.crear("cliente-1", datosDisputaValidos),
    ErrorValidacion
  );
  esperar("No crea disputa cuando se rechaza por ventana vencida", disputaCreadaData, null);

  // 3. Ventana configurable vía Config (24h): dentro de esa ventana, acepta
  mockConfigVentana = "24";
  mockSubPedido = subPedidoEntregadoHaceHoras(10);
  mockDisputaExistente = null;
  disputaCreadaData = null;
  await DisputaService.crear("cliente-1", datosDisputaValidos);
  esperar(
    "Acepta reporte dentro de una ventana configurada de 24 horas",
    disputaCreadaData !== null,
    true
  );

  // 4. Ventana configurable vía Config (24h): fuera de esa ventana, rechaza
  mockConfigVentana = "24";
  mockSubPedido = subPedidoEntregadoHaceHoras(30);
  mockDisputaExistente = null;
  disputaCreadaData = null;
  await esperarRejection(
    "Rechaza reporte fuera de una ventana configurada de 24 horas",
    DisputaService.crear("cliente-1", datosDisputaValidos),
    ErrorValidacion
  );

  mockConfigVentana = null; // restaurar default para el resto de la suite
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 2 — crear(): no permite una segunda disputa abierta sobre la misma referencia
// ─────────────────────────────────────────────────────────────────────────────
async function runDisputaDuplicadaTests() {
  console.log("\nPruebas: DisputaService.crear() — disputa duplicada\n");

  // 1. Rechaza si ya existe una disputa en estado no-terminal (ABIERTA) sobre la misma referencia
  mockSubPedido = subPedidoEntregadoHaceHoras(5);
  mockDisputaExistente = { id: "disputa-previa", estado: "ABIERTA" };
  disputaCreadaData = null;
  await esperarRejection(
    "Rechaza segunda disputa mientras la primera sigue ABIERTA",
    DisputaService.crear("cliente-1", datosDisputaValidos),
    ErrorValidacion
  );
  esperar("No crea una segunda disputa cuando ya hay una en curso", disputaCreadaData, null);

  // 2. Rechaza también si la existente está RESPONDIDA_COMERCIO (no-terminal)
  mockDisputaExistente = { id: "disputa-previa", estado: "RESPONDIDA_COMERCIO" };
  disputaCreadaData = null;
  await esperarRejection(
    "Rechaza segunda disputa mientras la primera está RESPONDIDA_COMERCIO",
    DisputaService.crear("cliente-1", datosDisputaValidos),
    ErrorValidacion
  );

  // 3. Acepta si la disputa previa ya está en un estado terminal (mock retorna null,
  //    simulando que el findFirst con notIn de estados terminales no la encontró)
  mockDisputaExistente = null;
  disputaCreadaData = null;
  const disputa = await DisputaService.crear("cliente-1", datosDisputaValidos);
  esperar(
    "Acepta nueva disputa si la anterior ya fue resuelta (estado terminal)",
    disputaCreadaData !== null && disputa.id === "disputa-nueva",
    true
  );

  // 4. Rechaza si la referencia no pertenece al comprador
  mockDisputaExistente = null;
  disputaCreadaData = null;
  await esperarRejection(
    "Rechaza si la compra no pertenece al usuario que reporta",
    DisputaService.crear("otro-cliente", datosDisputaValidos),
    ErrorProhibido
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 3 — resolver(): cálculo de montoDescuentoComercio proporcional al neto
// ─────────────────────────────────────────────────────────────────────────────
async function runResolverCalculoTests() {
  console.log("\nPruebas: DisputaService.resolver() — cálculo de montoDescuentoComercio\n");

  // Disputa base: bruto 24000, neto 21600 (comisión 10% ya descontada)
  const disputaBase = {
    id: 1,
    estado: "ABIERTA",
    montoOriginal: "24000",
    montoNetoOriginal: "21600",
  };

  // 1. Aprobación TOTAL: descuento = montoNetoOriginal completo (proporción 1:1 sobre el bruto total)
  mockDisputa = { ...disputaBase };
  mockUpdateManyCount = 1;
  updateManyDataRecibida = null;
  await DisputaService.resolver("admin-1", 1, { accion: "APROBAR_TOTAL", motivo: "Procede" });
  esperar(
    "APROBAR_TOTAL: montoReembolsoAprobado == montoOriginal completo",
    Number(updateManyDataRecibida.montoReembolsoAprobado),
    24000
  );
  esperar(
    "APROBAR_TOTAL: montoDescuentoComercio == montoNetoOriginal completo (24000/24000 * 21600)",
    Number(updateManyDataRecibida.montoDescuentoComercio),
    21600
  );

  // 2. Aprobación PARCIAL: descuento proporcional al neto
  // montoNetoOriginal/montoOriginal * montoReembolsoAprobado = 21600/24000 * 12000 = 10800
  mockDisputa = { ...disputaBase };
  mockUpdateManyCount = 1;
  updateManyDataRecibida = null;
  await DisputaService.resolver("admin-1", 1, {
    accion: "APROBAR_PARCIAL",
    motivo: "Reembolso parcial",
    montoReembolsoAprobado: 12000,
  });
  esperar(
    "APROBAR_PARCIAL: montoReembolsoAprobado == el monto solicitado (12000)",
    Number(updateManyDataRecibida.montoReembolsoAprobado),
    12000
  );
  esperar(
    "APROBAR_PARCIAL: montoDescuentoComercio == proporcional al neto (10800)",
    Number(updateManyDataRecibida.montoDescuentoComercio),
    10800
  );

  // 3. Aprobación PARCIAL con un monto que produce redondeo (verifica el Math.round a 2 decimales)
  // neto/bruto = 21600/24000 = 0.9; monto = 999 => 999 * 0.9 = 899.1 (exacto, sin arrastre de flotantes)
  mockDisputa = { ...disputaBase };
  mockUpdateManyCount = 1;
  updateManyDataRecibida = null;
  await DisputaService.resolver("admin-1", 1, {
    accion: "APROBAR_PARCIAL",
    motivo: "Reembolso parcial con decimales",
    montoReembolsoAprobado: 999,
  });
  esperar(
    "APROBAR_PARCIAL: redondea montoDescuentoComercio a 2 decimales (899.1)",
    Number(updateManyDataRecibida.montoDescuentoComercio),
    899.1
  );

  // 4. RECHAZAR: no calcula ningún monto
  mockDisputa = { ...disputaBase };
  mockUpdateManyCount = 1;
  updateManyDataRecibida = null;
  await DisputaService.resolver("admin-1", 1, { accion: "RECHAZAR", motivo: "No procede" });
  esperar("RECHAZAR: montoReembolsoAprobado queda null", updateManyDataRecibida.montoReembolsoAprobado, null);
  esperar("RECHAZAR: montoDescuentoComercio queda null", updateManyDataRecibida.montoDescuentoComercio, null);

  // 5. Rechaza monto de reembolso mayor al bruto original
  mockDisputa = { ...disputaBase };
  mockUpdateManyCount = 1;
  await esperarRejection(
    "Rechaza monto de reembolso aprobado mayor al monto original",
    DisputaService.resolver("admin-1", 1, { accion: "APROBAR_PARCIAL", montoReembolsoAprobado: 99999 }),
    ErrorValidacion
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 4 — resolver(): updateMany con count !== 1 previene doble-resolución
// ─────────────────────────────────────────────────────────────────────────────
async function runDobleResolucionTests() {
  console.log("\nPruebas: DisputaService.resolver() — prevención de doble-resolución concurrente\n");

  const disputaBase = {
    id: 1,
    estado: "ABIERTA",
    montoOriginal: "24000",
    montoNetoOriginal: "21600",
  };

  // 1. Si el updateMany afecta 0 filas (otro admin ya la resolvió entre el
  //    findUnique inicial y el updateMany), el service debe lanzar un error
  //    en vez de continuar como si hubiera tenido éxito.
  mockDisputa = { ...disputaBase };
  mockUpdateManyCount = 0;
  await esperarRejection(
    "Lanza error si el updateMany afecta 0 filas (ya resuelta por otro admin)",
    DisputaService.resolver("admin-1", 1, { accion: "RECHAZAR", motivo: "No procede" }),
    ErrorValidacion
  );

  // 2. También debe fallar con count 0 en un intento de aprobación parcial
  mockDisputa = { ...disputaBase };
  mockUpdateManyCount = 0;
  await esperarRejection(
    "Lanza error en aprobación parcial si el updateMany afecta 0 filas",
    DisputaService.resolver("admin-1", 1, { accion: "APROBAR_PARCIAL", montoReembolsoAprobado: 5000 }),
    ErrorValidacion
  );

  // 3. Camino feliz de control: con count 1 sí resuelve sin error (regresión)
  mockDisputa = { ...disputaBase };
  mockUpdateManyCount = 1;
  let fallo = false;
  try {
    await DisputaService.resolver("admin-1", 1, { accion: "RECHAZAR", motivo: "No procede" });
  } catch (e) {
    fallo = true;
  }
  esperar("No lanza error cuando el updateMany sí afecta 1 fila", fallo, false);

  // 4. El service también valida el estado ANTES del updateMany (findUnique):
  //    si la disputa ya está en un estado no resolvible, rechaza sin llegar al updateMany.
  mockDisputa = { ...disputaBase, estado: "RESUELTA_RECHAZADA" };
  await esperarRejection(
    "Rechaza resolver una disputa que ya está en estado terminal (chequeo previo al updateMany)",
    DisputaService.resolver("admin-1", 1, { accion: "RECHAZAR", motivo: "No procede" }),
    ErrorValidacion
  );
}

// ── Ejecución ─────────────────────────────────────────────────────────────────
(async () => {
  try {
    await runVentanaReporteTests();
    await runDisputaDuplicadaTests();
    await runResolverCalculoTests();
    await runDobleResolucionTests();
  } catch (err) {
    console.error("\nError inesperado en la suite de pruebas:", err);
    process.exit(1);
  }

  console.log(`\nResultado: ${pasadas} pasadas, ${fallidas} fallidas\n`);
  process.exit(fallidas > 0 ? 1 : 0);
})();
