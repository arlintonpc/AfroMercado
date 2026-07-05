// Pruebas unitarias del servicio de Cultura
// Ejecutar con: node tests/cultura.service.test.js

// ── Mocks ────────────────────────────────────────────────────────────────────
// CulturaService llama a `prisma` DIRECTAMENTE (no tiene repository propio),
// así que sobreescribimos los métodos del módulo compartido ../src/config/prisma
// ANTES de requerir el servicio, para que éste nunca toque la base de datos real.

const prisma = require("../src/config/prisma");
const NotificacionService = require("../src/services/notificacion.service");

// Estado mutable de los mocks (se puede sobreescribir por test)
let mockEntrada = null;
let mockFilasActualizadas = 1; // lo que retorna el UPDATE ... WHERE cupo/vendidas de $executeRaw
let reservaCreadaData = null;

prisma.entradaCultural = {
  findUnique: async () => mockEntrada,
};

// crearReserva() usa prisma.$transaction(async (tx) => {...}) y dentro de tx
// llama a tx.$executeRaw`...` (tagged template) y tx.reservaCultural.create(...).
prisma.$transaction = async (fn) => fn(prisma);

// $executeRaw es una función de "tagged template": se invoca como
// tx.$executeRaw`UPDATE ...`. Node pasa el array de strings + los valores
// interpolados como argumentos posicionales; no nos interesa parsear el SQL,
// solo controlar cuántas "filas" dice haber afectado.
prisma.$executeRaw = async (_strings, ..._valores) => mockFilasActualizadas;

prisma.reservaCultural = {
  create: async (args) => {
    reservaCreadaData = args.data;
    return { id: "reserva-cultural-nueva", ...args.data };
  },
};

NotificacionService.eventoCulturalCambioEstado = async () => {};

// Ahora sí cargamos el servicio (ya ve los mocks en memoria)
const CulturaService = require("../src/services/cultura.service");
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
function entradaFake({ precio = "10000", cupo = 50, activa = true, eventoEstado = "PUBLICADO", gratuito = false } = {}) {
  return {
    id: 1,
    eventoCulturalId: 10,
    nombre: "Entrada general",
    precio,
    cupo,
    vendidas: 0,
    activa,
    evento: {
      id: 10,
      titulo: "Festival de Currulao",
      estado: eventoEstado,
      gratuito,
    },
  };
}

const datosReservaValidos = {
  entradaCulturalId: 1,
  cantidad: 2,
  metodoPago: "EFECTIVO",
  notasCliente: "",
  nombreContacto: "María López",
  telefonoContacto: "3009876543",
};

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 1 — crearReserva(): respeta el cupo disponible
// ─────────────────────────────────────────────────────────────────────────────
async function runCupoTests() {
  console.log("\nPruebas: CulturaService.crearReserva() — respeto del cupo\n");

  // 1. Rechaza si la entrada no existe
  mockEntrada = null;
  await esperarRejection(
    "Rechaza reserva sobre una entrada inexistente",
    CulturaService.crearReserva("cliente-1", datosReservaValidos),
    ErrorValidacion
  );

  // 2. Rechaza si la entrada está inactiva
  mockEntrada = entradaFake({ activa: false });
  await esperarRejection(
    "Rechaza reserva sobre una entrada inactiva",
    CulturaService.crearReserva("cliente-1", datosReservaValidos),
    ErrorValidacion
  );

  // 3. Rechaza si el evento no está PUBLICADO
  mockEntrada = entradaFake({ eventoEstado: "BORRADOR" });
  await esperarRejection(
    "Rechaza reserva si el evento no está publicado",
    CulturaService.crearReserva("cliente-1", datosReservaValidos),
    ErrorValidacion
  );

  // 4. Rechaza si ya no hay cupo disponible: el UPDATE atómico de $executeRaw
  //    afecta 0 filas porque la condición (cupo - vendidas) >= cantidad falla.
  mockEntrada = entradaFake({ cupo: 10 });
  mockFilasActualizadas = 0; // simula que el WHERE del UPDATE no encontró fila que cumpliera
  reservaCreadaData = null;
  await esperarRejection(
    "Rechaza reserva cuando ya no hay cupo disponible (UPDATE atómico afecta 0 filas)",
    CulturaService.crearReserva("cliente-1", datosReservaValidos),
    ErrorValidacion
  );
  esperar("No crea la reserva cuando se rechaza por falta de cupo", reservaCreadaData, null);

  // 5. Acepta reserva cuando sí hay cupo disponible
  mockEntrada = entradaFake({ cupo: 50 });
  mockFilasActualizadas = 1; // el UPDATE sí afectó la fila (había cupo suficiente)
  reservaCreadaData = null;
  const reserva = await CulturaService.crearReserva("cliente-1", datosReservaValidos);
  esperar(
    "Acepta la reserva y la crea cuando hay cupo suficiente",
    reservaCreadaData !== null && reserva.id === "reserva-cultural-nueva",
    true
  );
  esperar("La reserva creada respeta la cantidad solicitada", reservaCreadaData.cantidad, 2);
  esperar("La reserva creada calcula el total correctamente (precio x cantidad)", Number(reservaCreadaData.total), 20000);

  // 6. Entrada con cupo null (ilimitado): el UPDATE nunca falla por cupo (la condición
  //    SQL es "cupo IS NULL OR ..."), así que el mock de $executeRaw refleja "siempre cabe".
  mockEntrada = entradaFake({ cupo: null });
  mockFilasActualizadas = 1;
  reservaCreadaData = null;
  await CulturaService.crearReserva("cliente-1", datosReservaValidos);
  esperar("Acepta reserva sobre una entrada con cupo ilimitado (cupo null)", reservaCreadaData !== null, true);
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 2 — crearReserva(): evento gratuito no requiere/genera flujo de pago
// ─────────────────────────────────────────────────────────────────────────────
async function runEventoGratuitoTests() {
  console.log("\nPruebas: CulturaService.crearReserva() — evento gratuito\n");

  // El modelo EventoCultural tiene un campo booleano `gratuito` (default true en
  // schema.prisma) que el organizador puede marcar al crear/editar el evento
  // (ver camposEvento() en cultura.service.js). PERO: leyendo crearReserva()
  // completo, ese flag NUNCA se lee ni se usa para bifurcar el flujo — no hay
  // ningún "if (entrada.evento.gratuito) { ... }" en el código. El total y la
  // comisión siempre se calculan igual: total = precio * cantidad,
  // comision = round(total * 10%), y metodoPago siempre se guarda (con
  // fallback a "EFECTIVO"). Un evento "gratuito" en la práctica es simplemente
  // un evento cuya(s) entrada(s) tienen precio 0 — no existe una ruta de
  // código distinta ni un "no se genera flujo de pago" explícito.
  //
  // Los tests de este grupo reflejan ESE comportamiento real: una entrada con
  // precio 0 (asociada a un evento marcado gratuito: true) recorre exactamente
  // el mismo camino que cualquier otra, y produce total/comision en 0 de forma
  // incidental por la aritmética, no por una rama especial del código.

  // 1. Evento gratuito con entrada de precio 0: la reserva se crea igual,
  //    con total y comisión en 0 (no hay bifurcación en el código).
  mockEntrada = entradaFake({ precio: "0", cupo: 100, gratuito: true });
  mockFilasActualizadas = 1;
  reservaCreadaData = null;
  const reserva = await CulturaService.crearReserva("cliente-1", datosReservaValidos);
  esperar(
    "Evento gratuito (precio 0): la reserva se crea sin error",
    reservaCreadaData !== null && reserva.id === "reserva-cultural-nueva",
    true
  );
  esperar("Evento gratuito (precio 0): el total calculado es 0", Number(reservaCreadaData.total), 0);
  esperar("Evento gratuito (precio 0): la comisión calculada es 0", Number(reservaCreadaData.comision), 0);
  esperar(
    "Evento gratuito (precio 0): igual guarda metodoPago (no se omite el campo de pago)",
    reservaCreadaData.metodoPago,
    "EFECTIVO"
  );
  esperar(
    "Evento gratuito (precio 0): igual guarda tasaComision aunque el monto sea 0",
    Number(reservaCreadaData.tasaComision),
    0.10
  );

  // 2. Confirma que el flag `evento.gratuito` en sí mismo NO es lo que determina
  //    el resultado: un evento gratuito=true con entrada de precio > 0 (ej. "entrada
  //    VIP" opcional en un evento de acceso general gratis) SÍ cobra normalmente,
  //    exactamente igual que si gratuito fuera false. Esto confirma que el service
  //    no bifurca en absoluto sobre este campo.
  mockEntrada = entradaFake({ precio: "15000", cupo: 100, gratuito: true });
  mockFilasActualizadas = 1;
  reservaCreadaData = null;
  await CulturaService.crearReserva("cliente-1", datosReservaValidos);
  esperar(
    "Evento marcado gratuito=true pero con entrada de pago: igual cobra el total normal",
    Number(reservaCreadaData.total),
    30000 // precio 15000 x cantidad 2
  );
}

// ── Ejecución ─────────────────────────────────────────────────────────────────
(async () => {
  try {
    await runCupoTests();
    await runEventoGratuitoTests();
  } catch (err) {
    console.error("\nError inesperado en la suite de pruebas:", err);
    process.exit(1);
  }

  console.log(`\nResultado: ${pasadas} pasadas, ${fallidas} fallidas\n`);
  process.exit(fallidas > 0 ? 1 : 0);
})();
