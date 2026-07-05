// Pruebas unitarias del servicio de Hoteles
// Ejecutar con: node tests/hotel.service.test.js
//
// hotel.service.js llama a Prisma DIRECTAMENTE (const prisma = require("../config/prisma")),
// sin repository intermedio. Por eso mockeamos el módulo "../config/prisma" reemplazando
// sus propiedades ANTES de requerir el servicio (Node cachea el módulo por referencia, así
// que el servicio ve estos mocks al hacer su propio require más abajo).

const prisma = require("../src/config/prisma");

// ── Fake DB en memoria ───────────────────────────────────────────────────────
// Guardamos las reservas creadas en un array real y respondemos a los métodos
// de Prisma consultando ese array, para poder probar solapamiento de fechas de
// verdad (no solo devolver un booleano fijo).

let habitacionesFisicasDB = [];
let reservasDB = [];
let nextReservaId = 1;

const HABITACION_TIPO_FAKE = {
  id: 10,
  configHotelId: 1,
  nombre: "Doble Vista al Mar",
  activo: true,
  cantidad: 5,
  precioPorNoche: 150000,
  precioPorHora: null,
  permitePorHoras: false,
  duracionMinHoras: 1,
  duracionMaxHoras: null,
  configHotel: {
    id: 1,
    comercioId: "comercio-hotel-1",
    activo: true,
    confirmacionAuto: true, // para que crearReserva devuelva CONFIRMADA directo y simplificar asserts
    permitePagarAlLlegar: true,
    permiteDeposito30: true,
    permiteReservasPorHora: false,
    minutosLimpiezaEntreReservas: 30,
    horasLibresCancelacion: 48,
    pctPenalidadCancelacion: 20,
    comercio: { usuarioId: "usuario-hotelero-1", whatsapp: null, nombre: "Hotel Test" },
  },
};

function reiniciarFakeDB() {
  habitacionesFisicasDB = [
    { id: 100, configHotelId: 1, habitacionTipoId: 10, activo: true, estado: "LIBRE", nombre: "101", piso: "1" },
    { id: 101, configHotelId: 1, habitacionTipoId: 10, activo: true, estado: "LIBRE", nombre: "102", piso: "1" },
  ];
  reservasDB = [];
  nextReservaId = 1;
}

function seSolapan(entradaA, salidaA, entradaB, salidaB) {
  return entradaA < salidaB && salidaA > entradaB;
}

// prisma.habitacionTipo
prisma.habitacionTipo = {
  findUnique: async ({ where }) => (where.id === HABITACION_TIPO_FAKE.id ? HABITACION_TIPO_FAKE : null),
};

// prisma.config → usado por ConfigRepository.obtener() para leer bloqueos manuales.
// Sin fila => sin bloqueos manuales activos.
prisma.config = {
  findUnique: async () => null,
};

// prisma.habitacionFisica
prisma.habitacionFisica = {
  findMany: async ({ where }) => {
    return habitacionesFisicasDB.filter((h) => {
      if (where.configHotelId !== undefined && h.configHotelId !== where.configHotelId) return false;
      if (where.habitacionTipoId !== undefined && h.habitacionTipoId !== where.habitacionTipoId) return false;
      if (where.activo !== undefined && h.activo !== where.activo) return false;
      if (where.estado?.notIn && where.estado.notIn.includes(h.estado)) return false;
      return true;
    });
  },
  findFirst: async ({ where }) => {
    return habitacionesFisicasDB.find((h) => h.id === Number(where.id)) || null;
  },
  update: async ({ where, data }) => {
    const hab = habitacionesFisicasDB.find((h) => h.id === where.id);
    if (hab) Object.assign(hab, data);
    return hab;
  },
};

// prisma.temporadaHotel → sin temporadas especiales, siempre usa el precio base
prisma.temporadaHotel = {
  findFirst: async () => null,
};

// prisma.reservaHotel
prisma.reservaHotel = {
  count: async ({ where }) => {
    return reservasDB.filter((r) => {
      if (where.habitacionTipoId !== undefined && r.habitacionTipoId !== where.habitacionTipoId) return false;
      if (where.habitacionFisicaId === null && r.habitacionFisicaId !== null) return false;
      if (where.estado?.in && !where.estado.in.includes(r.estado)) return false;
      if (where.fechaEntrada?.lt !== undefined && !(r.fechaEntrada < where.fechaEntrada.lt)) return false;
      if (where.fechaSalida?.gt !== undefined && !(r.fechaSalida > where.fechaSalida.gt)) return false;
      return true;
    }).length;
  },
  findMany: async ({ where }) => {
    return reservasDB.filter((r) => {
      if (where.habitacionFisicaId?.in && !where.habitacionFisicaId.in.includes(r.habitacionFisicaId)) return false;
      if (where.estado?.in && !where.estado.in.includes(r.estado)) return false;
      if (where.fechaEntrada?.lt !== undefined && !(r.fechaEntrada < where.fechaEntrada.lt)) return false;
      if (where.fechaSalida?.gt !== undefined && !(r.fechaSalida > where.fechaSalida.gt)) return false;
      return true;
    });
  },
  findFirst: async ({ where }) => {
    const candidatas = reservasDB.filter((r) => {
      if (where.id !== undefined && r.id !== where.id) return false;
      if (where.clienteId !== undefined && r.clienteId !== where.clienteId) return false;
      if (where.habitacionFisicaId !== undefined && r.habitacionFisicaId !== where.habitacionFisicaId) return false;
      if (where.estado?.in && !where.estado.in.includes(r.estado)) return false;
      if (where.fechaEntrada?.lt !== undefined && !(r.fechaEntrada < where.fechaEntrada.lt)) return false;
      if (where.fechaSalida?.gt !== undefined && !(r.fechaSalida > where.fechaSalida.gt)) return false;
      if (where.NOT?.id !== undefined && r.id === where.NOT.id) return false;
      return true;
    });
    const encontrada = candidatas[0];
    if (!encontrada) return null;
    // Simula el `include` que usa cambiarEstadoReserva/asignarHabitacionFisicaReserva
    // (cliente, habitacionTipo, habitacionFisica) además de las selects usadas por
    // cancelarReservaCliente/consultarPoliticaCancelacion (configHotel).
    return {
      ...encontrada,
      cliente: { id: encontrada.clienteId, nombre: "Cliente Test" },
      habitacionTipo: { nombre: HABITACION_TIPO_FAKE.nombre },
      habitacionFisica: encontrada.habitacionFisicaId
        ? habitacionesFisicasDB.find((h) => h.id === encontrada.habitacionFisicaId)
        : null,
      configHotel: {
        horasLibresCancelacion: HABITACION_TIPO_FAKE.configHotel.horasLibresCancelacion,
        pctPenalidadCancelacion: HABITACION_TIPO_FAKE.configHotel.pctPenalidadCancelacion,
      },
    };
  },
  create: async ({ data }) => {
    const reserva = {
      id: nextReservaId++,
      habitacionFisicaId: null,
      montoPenalidad: null,
      montoReembolso: null,
      ...data,
    };
    reservasDB.push(reserva);
    // Simula el `include` mínimo que usa el servicio tras crear.
    return {
      ...reserva,
      habitacionTipo: HABITACION_TIPO_FAKE,
      configHotel: {
        ...HABITACION_TIPO_FAKE.configHotel,
        comercio: { ...HABITACION_TIPO_FAKE.configHotel.comercio, usuario: { email: null, nombre: "Hotelero" } },
      },
    };
  },
  update: async ({ where, data }) => {
    const reserva = reservasDB.find((r) => r.id === where.id);
    if (!reserva) return null;
    Object.assign(reserva, data);
    return {
      ...reserva,
      habitacionTipo: { nombre: HABITACION_TIPO_FAKE.nombre },
      habitacionFisica: reserva.habitacionFisicaId
        ? habitacionesFisicasDB.find((h) => h.id === reserva.habitacionFisicaId)
        : null,
      cliente: { id: reserva.clienteId, nombre: "Cliente Test", email: null, telefono: null },
    };
  },
};

// prisma.configHotel
prisma.configHotel = {
  findUnique: async ({ where }) => {
    if (where.comercioId === HABITACION_TIPO_FAKE.configHotel.comercioId) return HABITACION_TIPO_FAKE.configHotel;
    if (where.id === HABITACION_TIPO_FAKE.configHotel.id) return HABITACION_TIPO_FAKE.configHotel;
    return null;
  },
};

// prisma.notificacion → notifHotel() lo llama en fire-and-forget dentro de try/catch;
// lo mockeamos igual para no ensuciar la salida con errores falsos.
prisma.notificacion = {
  create: async () => ({}),
};

// prisma.pushSubscripcion → tocado por enviarPushAUsuario() (utils/push.js) si hay
// VAPID keys configuradas en el entorno. Lo mockeamos para evitar que intente golpear
// la base de datos real y ensucie la salida con errores de Prisma.
prisma.pushSubscripcion = {
  findMany: async () => [],
};

// prisma.$transaction: los servicios lo invocan siempre como `prisma.$transaction(async (tx) => {...})`,
// nunca con array ni con opciones — así que basta con ejecutar el callback pasándole el propio prisma
// (ya mockeado) como `tx`.
prisma.$transaction = async (fn) => fn(prisma);

// prisma.$queryRaw: usado solo para el `FOR UPDATE` de bloqueo de fila (SELECT ... FOR UPDATE).
// No necesitamos que devuelva nada real, solo que no truene.
prisma.$queryRaw = async () => [];

// Ahora sí cargamos el servicio (ya ve los mocks en memoria)
const HotelService = require("../src/services/hotel.service");
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

async function esperarError(descripcion, fn) {
  try {
    await fn();
    fallidas++;
    console.log(`  ✗ ${descripcion} (no lanzó error)`);
  } catch (e) {
    pasadas++;
    console.log(`  ✓ ${descripcion}`);
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

// Helper para fechas relativas a "ahora" (evita que los tests envejezcan).
function diasDesdeHoy(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(12, 0, 0, 0); // mediodía, para no rozar el límite de "hoy" al normalizar horas
  return d;
}

function fechaISO(date) {
  return date.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 1 — verificarDisponibilidad(): solapamiento de fechas para la misma
// habitación física
// ─────────────────────────────────────────────────────────────────────────────
async function runDisponibilidadTests() {
  console.log("\nPruebas: HotelService.verificarDisponibilidad()\n");

  // 1. Sin reservas previas, hay 2 habitaciones físicas disponibles
  reiniciarFakeDB();
  {
    const entrada = diasDesdeHoy(10);
    const salida = diasDesdeHoy(12);
    const resultado = await HotelService.verificarDisponibilidad(HABITACION_TIPO_FAKE.id, entrada, salida);
    esperar("Sin reservas previas: 2 habitaciones físicas disponibles de 2", resultado.disponibles, 2);
  }

  // 2. Tras ocupar UNA habitación física en un rango, solo queda 1 disponible
  //    si se consulta el MISMO rango (o uno que se solapa)
  reiniciarFakeDB();
  {
    const entrada = diasDesdeHoy(10);
    const salida = diasDesdeHoy(12);
    reservasDB.push({
      id: nextReservaId++,
      habitacionTipoId: HABITACION_TIPO_FAKE.id,
      habitacionFisicaId: 100,
      estado: "CONFIRMADA",
      fechaEntrada: entrada,
      fechaSalida: salida,
    });
    const solapado = await HotelService.verificarDisponibilidad(HABITACION_TIPO_FAKE.id, diasDesdeHoy(11), diasDesdeHoy(13));
    esperar("Con 1 habitación física ocupada y rango solapado: 1 disponible de 2", solapado.disponibles, 1);
  }

  // 3. Si el rango consultado NO se solapa con la reserva existente, las 2 siguen libres
  reiniciarFakeDB();
  {
    const entrada = diasDesdeHoy(10);
    const salida = diasDesdeHoy(12);
    reservasDB.push({
      id: nextReservaId++,
      habitacionTipoId: HABITACION_TIPO_FAKE.id,
      habitacionFisicaId: 100,
      estado: "CONFIRMADA",
      fechaEntrada: entrada,
      fechaSalida: salida,
    });
    const noSolapado = await HotelService.verificarDisponibilidad(HABITACION_TIPO_FAKE.id, diasDesdeHoy(20), diasDesdeHoy(22));
    esperar("Rango sin solapamiento: 2 disponibles de 2 (reserva existente no afecta)", noSolapado.disponibles, 2);
  }

  // 4. Si TODAS las habitaciones físicas están ocupadas en el rango, disponibles = 0
  reiniciarFakeDB();
  {
    const entrada = diasDesdeHoy(10);
    const salida = diasDesdeHoy(12);
    reservasDB.push(
      { id: nextReservaId++, habitacionTipoId: HABITACION_TIPO_FAKE.id, habitacionFisicaId: 100, estado: "CONFIRMADA", fechaEntrada: entrada, fechaSalida: salida },
      { id: nextReservaId++, habitacionTipoId: HABITACION_TIPO_FAKE.id, habitacionFisicaId: 101, estado: "PENDIENTE", fechaEntrada: entrada, fechaSalida: salida }
    );
    const lleno = await HotelService.verificarDisponibilidad(HABITACION_TIPO_FAKE.id, entrada, salida);
    esperar("Con las 2 habitaciones físicas ocupadas: 0 disponibles", lleno.disponibles, 0);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 2 — crearReserva(): rechaza fechas cruzadas para una habitación ya
// ocupada en ese rango (a través del flujo completo, no solo el chequeo interno)
// ─────────────────────────────────────────────────────────────────────────────
async function runCrearReservaTests() {
  console.log("\nPruebas: HotelService.crearReserva()\n");

  const datosBase = {
    habitacionTipoId: HABITACION_TIPO_FAKE.id,
    huespedes: 2,
    metodoPago: "EFECTIVO",
    nombreHuesped: "Juan Pérez",
    telefonoHuesped: "3000000000",
  };

  // 1. Crea la reserva con éxito cuando hay disponibilidad
  reiniciarFakeDB();
  {
    const entrada = diasDesdeHoy(10);
    const salida = diasDesdeHoy(12);
    const reserva = await HotelService.crearReserva("cliente-1", {
      ...datosBase,
      fechaEntrada: fechaISO(entrada),
      fechaSalida: fechaISO(salida),
    });
    esperar("Crea la reserva correctamente cuando hay disponibilidad", reserva.estado, "CONFIRMADA");
  }

  // 2. Al llenar las 2 habitaciones físicas del tipo, la 3ª reserva en el MISMO
  //    rango se rechaza por falta de disponibilidad
  reiniciarFakeDB();
  {
    const entrada = fechaISO(diasDesdeHoy(10));
    const salida = fechaISO(diasDesdeHoy(12));
    await HotelService.crearReserva("cliente-1", { ...datosBase, fechaEntrada: entrada, fechaSalida: salida });
    await HotelService.crearReserva("cliente-2", { ...datosBase, fechaEntrada: entrada, fechaSalida: salida });
    // Ya no quedan habitaciones físicas libres para ese rango exacto (cruzado)
    await esperarRejection(
      "Rechaza una 3ª reserva cuando las 2 habitaciones físicas ya están ocupadas en fechas cruzadas",
      HotelService.crearReserva("cliente-3", { ...datosBase, fechaEntrada: entrada, fechaSalida: salida }),
      ErrorValidacion
    );
  }

  // 3. Un rango que se cruza PARCIALMENTE con una reserva existente también debe
  //    contar como ocupado para esa habitación física (no solo el rango exacto)
  reiniciarFakeDB();
  {
    const entradaA = fechaISO(diasDesdeHoy(10));
    const salidaA = fechaISO(diasDesdeHoy(15));
    await HotelService.crearReserva("cliente-1", { ...datosBase, fechaEntrada: entradaA, fechaSalida: salidaA });
    await HotelService.crearReserva("cliente-2", { ...datosBase, fechaEntrada: entradaA, fechaSalida: salidaA });
    // Rango que empieza ANTES de que termine la reserva A (se cruza) para ambas habitaciones ya ocupadas
    const entradaCruzada = fechaISO(diasDesdeHoy(13));
    const salidaCruzada = fechaISO(diasDesdeHoy(18));
    await esperarRejection(
      "Rechaza fechas cruzadas (rango parcialmente solapado) cuando ambas habitaciones están ocupadas",
      HotelService.crearReserva("cliente-3", { ...datosBase, fechaEntrada: entradaCruzada, fechaSalida: salidaCruzada }),
      ErrorValidacion
    );
  }

  // 4. Rechaza fecha de entrada en el pasado
  reiniciarFakeDB();
  await esperarRejection(
    "Rechaza fecha de entrada en el pasado",
    HotelService.crearReserva("cliente-1", {
      ...datosBase,
      fechaEntrada: fechaISO(diasDesdeHoy(-5)),
      fechaSalida: fechaISO(diasDesdeHoy(-3)),
    }),
    ErrorValidacion
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 3 — cambiarEstadoReserva(): transiciones válidas e inválidas
// Transiciones reales según el código: PENDIENTE→[CONFIRMADA,RECHAZADA],
// CONFIRMADA→[CHECKIN,CANCELADA], CHECKIN→[CHECKOUT]
// ─────────────────────────────────────────────────────────────────────────────
async function runCambiarEstadoTests() {
  console.log("\nPruebas: HotelService.cambiarEstadoReserva()\n");

  function crearReservaDirecta(estadoInicial) {
    const id = nextReservaId++;
    const reserva = {
      id,
      configHotelId: HABITACION_TIPO_FAKE.configHotel.id,
      habitacionTipoId: HABITACION_TIPO_FAKE.id,
      habitacionFisicaId: null,
      clienteId: "cliente-1",
      estado: estadoInicial,
      fechaEntrada: diasDesdeHoy(10),
      fechaSalida: diasDesdeHoy(12),
      modalidad: "NOCHE",
    };
    reservasDB.push(reserva);
    return reserva;
  }

  // 1. PENDIENTE → CONFIRMADA (válida)
  reiniciarFakeDB();
  {
    const reserva = crearReservaDirecta("PENDIENTE");
    const actualizada = await HotelService.cambiarEstadoReserva(HABITACION_TIPO_FAKE.configHotel.comercioId, reserva.id, "CONFIRMADA");
    esperar("PENDIENTE → CONFIRMADA es una transición válida", actualizada.estado, "CONFIRMADA");
  }

  // 2. CONFIRMADA → CHECKIN (válida)
  reiniciarFakeDB();
  {
    const reserva = crearReservaDirecta("CONFIRMADA");
    const actualizada = await HotelService.cambiarEstadoReserva(HABITACION_TIPO_FAKE.configHotel.comercioId, reserva.id, "CHECKIN");
    esperar("CONFIRMADA → CHECKIN es una transición válida", actualizada.estado, "CHECKIN");
  }

  // 3. CHECKIN → CHECKOUT (válida)
  reiniciarFakeDB();
  {
    const reserva = crearReservaDirecta("CHECKIN");
    const actualizada = await HotelService.cambiarEstadoReserva(HABITACION_TIPO_FAKE.configHotel.comercioId, reserva.id, "CHECKOUT");
    esperar("CHECKIN → CHECKOUT es una transición válida", actualizada.estado, "CHECKOUT");
  }

  // 4. PENDIENTE → CHECKOUT directo (INVÁLIDA: el código no lo permite, ver TRANSICIONES)
  reiniciarFakeDB();
  {
    const reserva = crearReservaDirecta("PENDIENTE");
    await esperarRejection(
      "Rechaza saltar directo de PENDIENTE a CHECKOUT",
      HotelService.cambiarEstadoReserva(HABITACION_TIPO_FAKE.configHotel.comercioId, reserva.id, "CHECKOUT"),
      ErrorValidacion
    );
  }

  // 5. CONFIRMADA → CHECKOUT directo (INVÁLIDA: falta pasar por CHECKIN)
  reiniciarFakeDB();
  {
    const reserva = crearReservaDirecta("CONFIRMADA");
    await esperarRejection(
      "Rechaza saltar de CONFIRMADA a CHECKOUT sin pasar por CHECKIN",
      HotelService.cambiarEstadoReserva(HABITACION_TIPO_FAKE.configHotel.comercioId, reserva.id, "CHECKOUT"),
      ErrorValidacion
    );
  }

  // 6. Una reserva ya CANCELADA no admite ninguna transición (no está en TRANSICIONES)
  reiniciarFakeDB();
  {
    const reserva = crearReservaDirecta("CANCELADA");
    await esperarRejection(
      "Rechaza cualquier transición desde una reserva CANCELADA",
      HotelService.cambiarEstadoReserva(HABITACION_TIPO_FAKE.configHotel.comercioId, reserva.id, "CONFIRMADA"),
      ErrorValidacion
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 4 — cancelarReservaCliente(): cálculo de montoPenalidad según
// horasLibresCancelacion y pctPenalidadCancelacion
// ─────────────────────────────────────────────────────────────────────────────
async function runCancelacionTests() {
  console.log("\nPruebas: HotelService.cancelarReservaCliente() — cálculo de penalidad\n");

  function crearReservaParaCancelar(fechaEntrada, total = 300000) {
    const id = nextReservaId++;
    const reserva = {
      id,
      configHotelId: HABITACION_TIPO_FAKE.configHotel.id,
      clienteId: "cliente-1",
      estado: "CONFIRMADA",
      fechaEntrada,
      fechaSalida: new Date(fechaEntrada.getTime() + 2 * 86400000),
      total,
      habitacionFisicaId: null,
    };
    reservasDB.push(reserva);
    return reserva;
  }

  // horasLibresCancelacion = 48, pctPenalidadCancelacion = 20 (definidos en configHotel del fake)

  // 1. Cancelar con MÁS horas de anticipación que el límite libre → sin penalidad
  reiniciarFakeDB();
  {
    const reserva = crearReservaParaCancelar(diasDesdeHoy(10)); // ~240h de anticipación, > 48h libres
    const actualizada = await HotelService.cancelarReservaCliente(reserva.id, "cliente-1");
    esperar("Cancelación con más de 48h de anticipación: montoPenalidad = 0", actualizada.montoPenalidad, 0);
    esperar("Cancelación con más de 48h de anticipación: reembolso = total completo", Number(actualizada.montoReembolso), 300000);
  }

  // 2. Cancelar DENTRO del rango de penalidad (menos de 48h de anticipación) → aplica pctPenalidadCancelacion
  reiniciarFakeDB();
  {
    const entrada = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h de anticipación, < 48h libres
    const reserva = crearReservaParaCancelar(entrada, 300000);
    const actualizada = await HotelService.cancelarReservaCliente(reserva.id, "cliente-1");
    // pctPenalidadCancelacion = 20% de 300000 = 60000
    esperar("Cancelación con menos de 48h de anticipación: montoPenalidad = 20% del total", actualizada.montoPenalidad, 60000);
    esperar("Cancelación con menos de 48h de anticipación: reembolso = total - penalidad", Number(actualizada.montoReembolso), 240000);
  }

  // 3. Rechaza cancelar una reserva que ya está en CHECKIN
  reiniciarFakeDB();
  {
    const id = nextReservaId++;
    reservasDB.push({
      id,
      configHotelId: HABITACION_TIPO_FAKE.configHotel.id,
      clienteId: "cliente-1",
      estado: "CHECKIN",
      fechaEntrada: diasDesdeHoy(1),
      fechaSalida: diasDesdeHoy(3),
      total: 300000,
      habitacionFisicaId: null,
    });
    await esperarRejection(
      "Rechaza cancelar una reserva que ya hizo CHECKIN",
      HotelService.cancelarReservaCliente(id, "cliente-1"),
      ErrorValidacion
    );
  }
}

// ── Ejecución ─────────────────────────────────────────────────────────────────
(async () => {
  try {
    await runDisponibilidadTests();
    await runCrearReservaTests();
    await runCambiarEstadoTests();
    await runCancelacionTests();
  } catch (err) {
    console.error("\nError inesperado en la suite de pruebas:", err);
    process.exit(1);
  }

  console.log(`\nResultado: ${pasadas} pasadas, ${fallidas} fallidas\n`);
  process.exit(fallidas > 0 ? 1 : 0);
})();
