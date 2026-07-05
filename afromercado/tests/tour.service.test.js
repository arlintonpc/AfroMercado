// Pruebas unitarias del servicio de Tours
// Ejecutar con: node tests/tour.service.test.js
//
// tour.service.js llama a Prisma DIRECTAMENTE (const prisma = require("../config/prisma")),
// sin repository intermedio. Por eso mockeamos el módulo "../config/prisma" reemplazando
// sus propiedades ANTES de requerir el servicio (Node cachea el módulo por referencia, así
// que el servicio ve estos mocks al hacer su propio require más abajo).

const prisma = require("../src/config/prisma");

// ── Fake DB en memoria ───────────────────────────────────────────────────────
// Guardamos las reservas creadas en un array real y respondemos a los métodos
// de Prisma consultando ese array, para poder probar el cupo real (no solo
// devolver un booleano fijo).

let reservasDB = [];
let nextReservaId = 1;

const CONFIG_TOUR_FAKE = {
  id: 20,
  comercioId: "comercio-tour-1",
  activo: true,
  nombre: "Tour por el Manglar",
  precioPersona: 50000,
  maxParticipantes: 10,
  confirmacionAuto: true, // simplifica los asserts: crearReserva devuelve CONFIRMADA directo
  comercio: { id: "comercio-tour-1", usuarioId: "usuario-operador-1", whatsapp: null, nombre: "Tours Chocó" },
};

function reiniciarFakeDB() {
  reservasDB = [];
  nextReservaId = 1;
}

// prisma.configTour
prisma.configTour = {
  findUnique: async ({ where }) => {
    if (where.id === CONFIG_TOUR_FAKE.id) return CONFIG_TOUR_FAKE;
    if (where.comercioId === CONFIG_TOUR_FAKE.comercioId) return CONFIG_TOUR_FAKE;
    return null;
  },
};

// prisma.comercio → usado por crearReserva() FUERA de la transacción para notificar al operador
prisma.comercio = {
  findUnique: async ({ where }) => (where.id === CONFIG_TOUR_FAKE.comercioId ? CONFIG_TOUR_FAKE.comercio : null),
};

// Mismo día calendario que la función real: normaliza a [00:00:00.000, 23:59:59.999]
function rangoDelDia(fecha) {
  const fechaD = new Date(fecha);
  const inicio = new Date(fechaD); inicio.setHours(0, 0, 0, 0);
  const fin = new Date(fechaD); fin.setHours(23, 59, 59, 999);
  return { inicio, fin };
}

// prisma.reservaTour
prisma.reservaTour = {
  aggregate: async ({ where }) => {
    const { inicio, fin } = { inicio: where.fechaTour.gte, fin: where.fechaTour.lte };
    const suma = reservasDB
      .filter((r) => {
        if (r.configTourId !== where.configTourId) return false;
        if (!(r.fechaTour >= inicio && r.fechaTour <= fin)) return false;
        if (where.estado?.in && !where.estado.in.includes(r.estado)) return false;
        return true;
      })
      .reduce((acc, r) => acc + r.participantes, 0);
    return { _sum: { participantes: suma || null } };
  },
  create: async ({ data }) => {
    const reserva = { id: nextReservaId++, ...data };
    reservasDB.push(reserva);
    return { ...reserva, configTour: CONFIG_TOUR_FAKE };
  },
  findFirst: async ({ where }) => {
    const encontrada = reservasDB.find((r) => {
      if (where.id !== undefined && r.id !== where.id) return false;
      if (where.clienteId !== undefined && r.clienteId !== where.clienteId) return false;
      if (where.configTourId !== undefined && r.configTourId !== where.configTourId) return false;
      return true;
    });
    if (!encontrada) return null;
    return { ...encontrada, cliente: { id: encontrada.clienteId } };
  },
  update: async ({ where, data }) => {
    const reserva = reservasDB.find((r) => r.id === where.id);
    if (!reserva) return null;
    Object.assign(reserva, data);
    return { ...reserva };
  },
};

// prisma.notificacion → notifTour() lo llama en fire-and-forget dentro de try/catch;
// lo mockeamos igual para no ensuciar la salida con errores falsos.
prisma.notificacion = {
  create: async () => ({}),
};

// prisma.pushSubscripcion → tocado por enviarPushAUsuario() (utils/push.js) si hay
// VAPID keys configuradas en el entorno.
prisma.pushSubscripcion = {
  findMany: async () => [],
};

// prisma.$transaction: el servicio lo invoca siempre como `prisma.$transaction(async (tx) => {...})`,
// nunca con array ni con opciones — basta con ejecutar el callback pasándole el propio prisma
// (ya mockeado) como `tx`.
prisma.$transaction = async (fn) => fn(prisma);

// prisma.$queryRaw: usado como plantilla con tag (`tx.$queryRaw\`SELECT ... FOR UPDATE\``)
// solo para el bloqueo de fila. No necesitamos que devuelva nada real.
prisma.$queryRaw = async () => [];

// Ahora sí cargamos el servicio (ya ve los mocks en memoria)
const TourService = require("../src/services/tour.service");
const { ErrorValidacion, ErrorNoEncontrado } = require("../src/utils/errores");

// ── Utilidades de reporte (mismo patrón que comision.test.js) ───────────────
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

function diasDesdeHoy(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(12, 0, 0, 0);
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 1 — verificarDisponibilidad(): cupo contra maxParticipantes
// ─────────────────────────────────────────────────────────────────────────────
async function runDisponibilidadTests() {
  console.log("\nPruebas: TourService.verificarDisponibilidad()\n");

  // 1. Sin reservas previas, la disponibilidad es igual a maxParticipantes (10)
  reiniciarFakeDB();
  {
    const resultado = await TourService.verificarDisponibilidad(CONFIG_TOUR_FAKE.id, diasDesdeHoy(5));
    esperar("Sin reservas previas: disponibles = maxParticipantes (10)", resultado.disponibles, 10);
  }

  // 2. Con una reserva de 4 participantes CONFIRMADA ese día, quedan 6 cupos
  reiniciarFakeDB();
  {
    const fecha = diasDesdeHoy(5);
    reservasDB.push({ id: nextReservaId++, configTourId: CONFIG_TOUR_FAKE.id, fechaTour: fecha, participantes: 4, estado: "CONFIRMADA" });
    const resultado = await TourService.verificarDisponibilidad(CONFIG_TOUR_FAKE.id, fecha);
    esperar("Con 4 participantes ya reservados (CONFIRMADA): quedan 6 disponibles", resultado.disponibles, 6);
  }

  // 3. Reservas PENDIENTE también restan cupo (el servicio las cuenta como ocupando)
  reiniciarFakeDB();
  {
    const fecha = diasDesdeHoy(5);
    reservasDB.push({ id: nextReservaId++, configTourId: CONFIG_TOUR_FAKE.id, fechaTour: fecha, participantes: 3, estado: "PENDIENTE" });
    const resultado = await TourService.verificarDisponibilidad(CONFIG_TOUR_FAKE.id, fecha);
    esperar("Reservas PENDIENTE también ocupan cupo: quedan 7 disponibles", resultado.disponibles, 7);
  }

  // 4. Reservas CANCELADA/RECHAZADA NO restan cupo
  reiniciarFakeDB();
  {
    const fecha = diasDesdeHoy(5);
    reservasDB.push({ id: nextReservaId++, configTourId: CONFIG_TOUR_FAKE.id, fechaTour: fecha, participantes: 8, estado: "CANCELADA" });
    const resultado = await TourService.verificarDisponibilidad(CONFIG_TOUR_FAKE.id, fecha);
    esperar("Reservas CANCELADA no restan cupo: siguen los 10 disponibles", resultado.disponibles, 10);
  }

  // 5. Si se llena el cupo exacto, disponibles = 0 (nunca negativo)
  reiniciarFakeDB();
  {
    const fecha = diasDesdeHoy(5);
    reservasDB.push({ id: nextReservaId++, configTourId: CONFIG_TOUR_FAKE.id, fechaTour: fecha, participantes: 10, estado: "CONFIRMADA" });
    const resultado = await TourService.verificarDisponibilidad(CONFIG_TOUR_FAKE.id, fecha);
    esperar("Cupo lleno exacto: 0 disponibles (nunca negativo)", resultado.disponibles, 0);
  }

  // 6. Una reserva en OTRA fecha no afecta la disponibilidad del día consultado
  reiniciarFakeDB();
  {
    reservasDB.push({ id: nextReservaId++, configTourId: CONFIG_TOUR_FAKE.id, fechaTour: diasDesdeHoy(2), participantes: 9, estado: "CONFIRMADA" });
    const resultado = await TourService.verificarDisponibilidad(CONFIG_TOUR_FAKE.id, diasDesdeHoy(5));
    esperar("Reserva en otra fecha no afecta el día consultado: siguen 10 disponibles", resultado.disponibles, 10);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 2 — crearReserva(): rechaza participantes que exceden el cupo disponible
// ─────────────────────────────────────────────────────────────────────────────
async function runCrearReservaTests() {
  console.log("\nPruebas: TourService.crearReserva()\n");

  const datosBase = {
    configTourId: CONFIG_TOUR_FAKE.id,
    metodoPago: "EFECTIVO",
    nombreContacto: "Ana Gómez",
    telefonoContacto: "3100000000",
  };

  // 1. Crea la reserva con éxito cuando hay cupo suficiente
  reiniciarFakeDB();
  {
    const reserva = await TourService.crearReserva("cliente-1", { ...datosBase, fechaTour: diasDesdeHoy(5), participantes: 4 });
    esperar("Crea la reserva correctamente cuando hay cupo suficiente", reserva.estado, "CONFIRMADA");
    esperar("El total se calcula como precioPersona * participantes", Number(reserva.total), 200000);
  }

  // 2. Rechaza una cantidad de participantes que excede el cupo total del tour
  reiniciarFakeDB();
  await esperarRejection(
    "Rechaza una reserva que excede el cupo total del tour (15 > maxParticipantes 10)",
    TourService.crearReserva("cliente-1", { ...datosBase, fechaTour: diasDesdeHoy(5), participantes: 15 }),
    ErrorValidacion
  );

  // 3. Rechaza una reserva que excede el cupo YA PARCIALMENTE ocupado ese día
  reiniciarFakeDB();
  {
    const fecha = diasDesdeHoy(5);
    await TourService.crearReserva("cliente-1", { ...datosBase, fechaTour: fecha, participantes: 7 });
    // Ya quedan solo 3 cupos libres; pedir 5 debe rechazarse
    await esperarRejection(
      "Rechaza una 2ª reserva que excede el cupo restante (quedan 3, pide 5)",
      TourService.crearReserva("cliente-2", { ...datosBase, fechaTour: fecha, participantes: 5 }),
      ErrorValidacion
    );
  }

  // 4. Una reserva que cabe justo en el cupo restante SÍ se acepta
  reiniciarFakeDB();
  {
    const fecha = diasDesdeHoy(5);
    await TourService.crearReserva("cliente-1", { ...datosBase, fechaTour: fecha, participantes: 7 });
    const segunda = await TourService.crearReserva("cliente-2", { ...datosBase, fechaTour: fecha, participantes: 3 });
    esperar("Una reserva que cabe justo en el cupo restante (3 de 3) se acepta", segunda.estado, "CONFIRMADA");
  }

  // 5. Rechaza cantidad de participantes no válida (0 o negativa)
  reiniciarFakeDB();
  await esperarRejection(
    "Rechaza 0 participantes",
    TourService.crearReserva("cliente-1", { ...datosBase, fechaTour: diasDesdeHoy(5), participantes: 0 }),
    ErrorValidacion
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 3 — cambiarEstadoReserva(): transiciones válidas e inválidas
// Transiciones reales según el código: PENDIENTE→[CONFIRMADA,RECHAZADA],
// CONFIRMADA→[COMPLETADA,CANCELADA]. Nótese que NO existe un estado CHECKIN
// para tours (a diferencia de hoteles) — el camino a COMPLETADA pasa siempre
// primero por CONFIRMADA.
// ─────────────────────────────────────────────────────────────────────────────
async function runCambiarEstadoTests() {
  console.log("\nPruebas: TourService.cambiarEstadoReserva()\n");

  function crearReservaDirecta(estadoInicial) {
    const id = nextReservaId++;
    const reserva = {
      id,
      configTourId: CONFIG_TOUR_FAKE.id,
      clienteId: "cliente-1",
      estado: estadoInicial,
      fechaTour: diasDesdeHoy(5),
      participantes: 2,
      total: 100000,
    };
    reservasDB.push(reserva);
    return reserva;
  }

  // 1. PENDIENTE → CONFIRMADA (válida)
  reiniciarFakeDB();
  {
    const reserva = crearReservaDirecta("PENDIENTE");
    const actualizada = await TourService.cambiarEstadoReserva(CONFIG_TOUR_FAKE.comercioId, reserva.id, "CONFIRMADA");
    esperar("PENDIENTE → CONFIRMADA es una transición válida", actualizada.estado, "CONFIRMADA");
  }

  // 2. CONFIRMADA → COMPLETADA (válida)
  reiniciarFakeDB();
  {
    const reserva = crearReservaDirecta("CONFIRMADA");
    const actualizada = await TourService.cambiarEstadoReserva(CONFIG_TOUR_FAKE.comercioId, reserva.id, "COMPLETADA");
    esperar("CONFIRMADA → COMPLETADA es una transición válida", actualizada.estado, "COMPLETADA");
  }

  // 3. PENDIENTE → RECHAZADA (válida)
  reiniciarFakeDB();
  {
    const reserva = crearReservaDirecta("PENDIENTE");
    const actualizada = await TourService.cambiarEstadoReserva(CONFIG_TOUR_FAKE.comercioId, reserva.id, "RECHAZADA");
    esperar("PENDIENTE → RECHAZADA es una transición válida", actualizada.estado, "RECHAZADA");
  }

  // 4. CONFIRMADA → CANCELADA (válida)
  reiniciarFakeDB();
  {
    const reserva = crearReservaDirecta("CONFIRMADA");
    const actualizada = await TourService.cambiarEstadoReserva(CONFIG_TOUR_FAKE.comercioId, reserva.id, "CANCELADA");
    esperar("CONFIRMADA → CANCELADA es una transición válida", actualizada.estado, "CANCELADA");
  }

  // 5. Rechaza saltar directo de PENDIENTE a COMPLETADA (no está en TRANSICIONES.PENDIENTE)
  reiniciarFakeDB();
  {
    const reserva = crearReservaDirecta("PENDIENTE");
    await esperarRejection(
      "Rechaza saltar directo de PENDIENTE a COMPLETADA",
      TourService.cambiarEstadoReserva(CONFIG_TOUR_FAKE.comercioId, reserva.id, "COMPLETADA"),
      ErrorValidacion
    );
  }

  // 6. Una reserva ya COMPLETADA no admite ninguna transición (no está en TRANSICIONES)
  reiniciarFakeDB();
  {
    const reserva = crearReservaDirecta("COMPLETADA");
    await esperarRejection(
      "Rechaza cualquier transición desde una reserva ya COMPLETADA",
      TourService.cambiarEstadoReserva(CONFIG_TOUR_FAKE.comercioId, reserva.id, "CANCELADA"),
      ErrorValidacion
    );
  }

  // 7. Rechaza reserva inexistente
  reiniciarFakeDB();
  await esperarRejection(
    "Rechaza cambiar estado de una reserva inexistente",
    TourService.cambiarEstadoReserva(CONFIG_TOUR_FAKE.comercioId, 9999, "CONFIRMADA"),
    ErrorNoEncontrado
  );
}

// ── Ejecución ─────────────────────────────────────────────────────────────────
(async () => {
  try {
    await runDisponibilidadTests();
    await runCrearReservaTests();
    await runCambiarEstadoTests();
  } catch (err) {
    console.error("\nError inesperado en la suite de pruebas:", err);
    process.exit(1);
  }

  console.log(`\nResultado: ${pasadas} pasadas, ${fallidas} fallidas\n`);
  process.exit(fallidas > 0 ? 1 : 0);
})();
