// Pruebas unitarias del servicio de Transporte
// Ejecutar con: node tests/transporte.service.test.js

// ── Mocks ────────────────────────────────────────────────────────────────────
// TransporteService llama a `prisma` DIRECTAMENTE (no tiene repository propio),
// así que sobreescribimos los métodos del módulo compartido ../src/config/prisma
// ANTES de requerir el servicio, para que éste nunca toque la base de datos real.

const prisma = require("../src/config/prisma");

// Estado mutable de los mocks (se puede sobreescribir por test)
let mockRuta = null;
let mockReservasAgregadas = { _sum: { asientos: 0 } };
let reservaCreada = null;

prisma.rutaTransporte = {
  findUnique: async () => mockRuta,
};

prisma.reservaTransporte = {
  aggregate: async () => mockReservasAgregadas,
  create: async (args) => {
    reservaCreada = args.data;
    return { id: "reserva-nueva", ...args.data };
  },
};

prisma.comercio = {
  findUnique: async () => ({ usuarioId: 999 }),
};

prisma.notificacion = {
  create: async () => ({ id: "notif-1" }),
};

// enviarPushAUsuario() consulta este modelo cuando hay VAPID keys configuradas
// en el entorno (.env). Lo mockeamos para que la suite no dependa de si el
// entorno tiene o no push activado, y para evitar ruido en stderr.
prisma.pushSubscripcion = {
  findMany: async () => [],
};

// $transaction: el service la llama como función async (tx) => {...}
prisma.$transaction = async (fn) => fn(prisma);

// prisma.$queryRaw: usado como plantilla con tag (`tx.$queryRaw\`SELECT ... FOR UPDATE\``)
// para el lock pesimista de la ruta antes de crear la reserva.
prisma.$queryRaw = async () => [];

// Ahora sí cargamos el servicio (ya ve los mocks en memoria)
const TransporteService = require("../src/services/transporte.service");
const { ErrorValidacion, ErrorNoEncontrado } = require("../src/utils/errores");

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
const rutaFake = {
  id: "ruta-1",
  configTransporteId: "config-1",
  origen: "Quibdó",
  destino: "Istmina",
  horario: "08:00",
  capacidad: 10,
  precioAsiento: "20000", // Decimal de Prisma llega como string
  activo: true,
  configTransporte: { comercioId: "comercio-1" },
};

const datosReservaValidos = {
  rutaTransporteId: "ruta-1",
  fechaViaje: "2026-08-01",
  asientos: 2,
  metodoPago: "EFECTIVO",
  notasCliente: "",
  nombreContacto: "Juan Pérez",
  telefonoContacto: "3001234567",
};

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 1 — verificarDisponibilidad()
// ─────────────────────────────────────────────────────────────────────────────
async function runVerificarDisponibilidadTests() {
  console.log("\nPruebas: TransporteService.verificarDisponibilidad()\n");

  // 1. Lanza ErrorNoEncontrado si la ruta no existe
  mockRuta = null;
  await esperarRejection(
    "Rechaza ruta inexistente",
    TransporteService.verificarDisponibilidad("ruta-inexistente", "2026-08-01"),
    ErrorNoEncontrado
  );

  // 2. Capacidad completa, sin reservas: todos los cupos disponibles
  mockRuta = { ...rutaFake, capacidad: 10 };
  mockReservasAgregadas = { _sum: { asientos: null } }; // aggregate sin filas retorna null
  let disp = await TransporteService.verificarDisponibilidad("ruta-1", "2026-08-01");
  esperar(
    "Sin reservas previas, disponibles == capacidad total",
    disp,
    { disponibles: 10, capacidad: 10 }
  );

  // 3. Descuenta los asientos ya reservados (PENDIENTE/CONFIRMADA) de la capacidad
  mockRuta = { ...rutaFake, capacidad: 10 };
  mockReservasAgregadas = { _sum: { asientos: 7 } };
  disp = await TransporteService.verificarDisponibilidad("ruta-1", "2026-08-01");
  esperar(
    "Descuenta asientos ya ocupados de la capacidad",
    disp,
    { disponibles: 3, capacidad: 10 }
  );

  // 4. Nunca retorna disponibles negativos aunque haya sobreventa (defensivo)
  mockRuta = { ...rutaFake, capacidad: 10 };
  mockReservasAgregadas = { _sum: { asientos: 15 } };
  disp = await TransporteService.verificarDisponibilidad("ruta-1", "2026-08-01");
  esperar(
    "No retorna disponibles negativos en caso de sobreventa",
    disp,
    { disponibles: 0, capacidad: 10 }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 2 — crearReserva()
// ─────────────────────────────────────────────────────────────────────────────
async function runCrearReservaTests() {
  console.log("\nPruebas: TransporteService.crearReserva()\n");

  // 1. Rechaza reserva con cantidad de asientos que excede lo disponible
  mockRuta = { ...rutaFake, capacidad: 10 };
  mockReservasAgregadas = { _sum: { asientos: 9 } }; // solo queda 1 disponible
  reservaCreada = null;
  await esperarRejection(
    "Rechaza reserva cuando los asientos solicitados exceden la disponibilidad",
    TransporteService.crearReserva("cliente-1", { ...datosReservaValidos, asientos: 2 }),
    ErrorValidacion
  );
  esperar("No crea ninguna reserva cuando se rechaza por falta de cupo", reservaCreada, null);

  // 2. Rechaza si la ruta no existe
  mockRuta = null;
  await esperarRejection(
    "Rechaza reserva sobre una ruta inexistente",
    TransporteService.crearReserva("cliente-1", datosReservaValidos),
    ErrorValidacion
  );

  // 3. Rechaza si la ruta está inactiva
  mockRuta = { ...rutaFake, activo: false };
  await esperarRejection(
    "Rechaza reserva sobre una ruta inactiva",
    TransporteService.crearReserva("cliente-1", datosReservaValidos),
    ErrorValidacion
  );

  // 4. Acepta reserva dentro de la capacidad disponible y calcula el total correctamente
  mockRuta = { ...rutaFake, capacidad: 10 };
  mockReservasAgregadas = { _sum: { asientos: 3 } }; // 7 disponibles, se piden 2
  reservaCreada = null;
  const reserva = await TransporteService.crearReserva("cliente-1", { ...datosReservaValidos, asientos: 2 });
  esperar(
    "Crea la reserva con el total correcto (precioAsiento x asientos)",
    reservaCreada !== null && Number(reservaCreada.total) === 40000 && reservaCreada.asientos === 2,
    true
  );
  esperar("La reserva creada queda en estado PENDIENTE", reservaCreada.estado, "PENDIENTE");

  // 5. Calcula y guarda la comisión de plataforma (10%, igual que Hotel/Tour —
  //    antes Transporte no cobraba comisión en absoluto)
  mockRuta = { ...rutaFake, capacidad: 10 };
  mockReservasAgregadas = { _sum: { asientos: 0 } };
  reservaCreada = null;
  await TransporteService.crearReserva("cliente-1", { ...datosReservaValidos, asientos: 2 });
  esperar(
    "Guarda comision = 10% del total y tasaComision = 0.10",
    reservaCreada !== null && Number(reservaCreada.comision) === 4000 && Number(reservaCreada.tasaComision) === 0.10,
    true
  );
}

// ── Ejecución ─────────────────────────────────────────────────────────────────
(async () => {
  try {
    await runVerificarDisponibilidadTests();
    await runCrearReservaTests();
  } catch (err) {
    console.error("\nError inesperado en la suite de pruebas:", err);
    process.exit(1);
  }

  console.log(`\nResultado: ${pasadas} pasadas, ${fallidas} fallidas\n`);
  process.exit(fallidas > 0 ? 1 : 0);
})();
