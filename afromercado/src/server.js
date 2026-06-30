// Punto de entrada — arranca el servidor
const app = require("./app");
const config = require("./config");
const { cerrarConexion } = require("./utils/whatsapp");
const { iniciarCron } = require("./utils/cron");
const { iniciarJob: iniciarJobHotel } = require("./jobs/expirarReservasHotel");
const prisma = require("./config/prisma");

// Aplica migraciones DDL pendientes sin usar prisma migrate (Neon pooler)
async function aplicarMigraciones() {
  const migraciones = [
    `ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "departamento" TEXT`,
    `ALTER TABLE "Comercio" ADD COLUMN IF NOT EXISTS "departamento" TEXT`,
    `ALTER TABLE "Comercio" ADD COLUMN IF NOT EXISTS "latitud" DOUBLE PRECISION`,
    `ALTER TABLE "Comercio" ADD COLUMN IF NOT EXISTS "longitud" DOUBLE PRECISION`,
    // Módulo Hotelería
    `CREATE TABLE IF NOT EXISTS "ConfigHotel" (
      "id" SERIAL PRIMARY KEY,
      "comercioId" INTEGER NOT NULL UNIQUE,
      "activo" BOOLEAN NOT NULL DEFAULT false,
      "confirmacionAuto" BOOLEAN NOT NULL DEFAULT false,
      "horasLimiteConfirm" INTEGER NOT NULL DEFAULT 2,
      "servicios" TEXT[] NOT NULL DEFAULT '{}',
      "politicaCancelacion" TEXT,
      "checkInHora" TEXT NOT NULL DEFAULT '15:00',
      "checkOutHora" TEXT NOT NULL DEFAULT '12:00',
      "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ConfigHotel_comercioId_fkey" FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "HabitacionTipo" (
      "id" SERIAL PRIMARY KEY,
      "configHotelId" INTEGER NOT NULL,
      "nombre" TEXT NOT NULL,
      "descripcion" TEXT,
      "capacidad" INTEGER NOT NULL DEFAULT 2,
      "precioPorNoche" DECIMAL(12,2) NOT NULL,
      "cantidad" INTEGER NOT NULL DEFAULT 1,
      "fotos" TEXT[] NOT NULL DEFAULT '{}',
      "serviciosExtra" TEXT[] NOT NULL DEFAULT '{}',
      "activo" BOOLEAN NOT NULL DEFAULT true,
      "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "HabitacionTipo_configHotelId_fkey" FOREIGN KEY ("configHotelId") REFERENCES "ConfigHotel"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `ALTER TABLE "ConfigHotel" ADD COLUMN IF NOT EXISTS "permiteReservasPorHora" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "ConfigHotel" ADD COLUMN IF NOT EXISTS "minutosLimpiezaEntreReservas" INTEGER NOT NULL DEFAULT 30`,
    `ALTER TABLE "HabitacionTipo" ADD COLUMN IF NOT EXISTS "precioPorHora" DECIMAL(12,2)`,
    `ALTER TABLE "HabitacionTipo" ADD COLUMN IF NOT EXISTS "permitePorHoras" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "HabitacionTipo" ADD COLUMN IF NOT EXISTS "duracionMinHoras" INTEGER NOT NULL DEFAULT 2`,
    `ALTER TABLE "HabitacionTipo" ADD COLUMN IF NOT EXISTS "duracionMaxHoras" INTEGER`,
    `CREATE TABLE IF NOT EXISTS "HabitacionFisica" (
      "id" SERIAL PRIMARY KEY,
      "configHotelId" INTEGER NOT NULL,
      "habitacionTipoId" INTEGER NOT NULL,
      "nombre" TEXT NOT NULL,
      "piso" TEXT,
      "zona" TEXT,
      "estado" TEXT NOT NULL DEFAULT 'LIBRE',
      "notas" TEXT,
      "activo" BOOLEAN NOT NULL DEFAULT true,
      "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "HabitacionFisica_configHotelId_fkey" FOREIGN KEY ("configHotelId") REFERENCES "ConfigHotel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "HabitacionFisica_habitacionTipoId_fkey" FOREIGN KEY ("habitacionTipoId") REFERENCES "HabitacionTipo"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "HabitacionFisica_habitacionTipoId_nombre_key" ON "HabitacionFisica"("habitacionTipoId", "nombre")`,
    `CREATE INDEX IF NOT EXISTS "HabitacionFisica_configHotelId_estado_idx" ON "HabitacionFisica"("configHotelId", "estado")`,
    `CREATE INDEX IF NOT EXISTS "HabitacionFisica_habitacionTipoId_activo_idx" ON "HabitacionFisica"("habitacionTipoId", "activo")`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoReservaHotel') THEN
        CREATE TYPE "EstadoReservaHotel" AS ENUM ('PENDIENTE','CONFIRMADA','CHECKIN','CHECKOUT','CANCELADA','RECHAZADA');
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS "ReservaHotel" (
      "id" SERIAL PRIMARY KEY,
      "codigo" TEXT NOT NULL UNIQUE,
      "configHotelId" INTEGER NOT NULL,
      "habitacionTipoId" INTEGER NOT NULL,
      "clienteId" INTEGER NOT NULL,
      "fechaEntrada" TIMESTAMP(3) NOT NULL,
      "fechaSalida" TIMESTAMP(3) NOT NULL,
      "huespedes" INTEGER NOT NULL DEFAULT 1,
      "total" DECIMAL(12,2) NOT NULL,
      "estado" "EstadoReservaHotel" NOT NULL DEFAULT 'PENDIENTE',
      "metodoPago" TEXT NOT NULL DEFAULT 'EFECTIVO',
      "notasCliente" TEXT,
      "nombreHuesped" TEXT NOT NULL,
      "telefonoHuesped" TEXT NOT NULL,
      "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReservaHotel_configHotelId_fkey" FOREIGN KEY ("configHotelId") REFERENCES "ConfigHotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "ReservaHotel_habitacionTipoId_fkey" FOREIGN KEY ("habitacionTipoId") REFERENCES "HabitacionTipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "ReservaHotel_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    // Módulo Tours
    `ALTER TABLE "ReservaHotel" ADD COLUMN IF NOT EXISTS "habitacionFisicaId" INTEGER`,
    `ALTER TABLE "ReservaHotel" ADD COLUMN IF NOT EXISTS "modalidad" TEXT NOT NULL DEFAULT 'NOCHE'`,
    `ALTER TABLE "ReservaHotel" ADD COLUMN IF NOT EXISTS "duracionHoras" DECIMAL(6,2)`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ReservaHotel_habitacionFisicaId_fkey'
      ) THEN
        ALTER TABLE "ReservaHotel"
          ADD CONSTRAINT "ReservaHotel_habitacionFisicaId_fkey"
          FOREIGN KEY ("habitacionFisicaId") REFERENCES "HabitacionFisica"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$`,
    `CREATE INDEX IF NOT EXISTS "ReservaHotel_habitacionFisicaId_idx" ON "ReservaHotel"("habitacionFisicaId")`,
    `CREATE INDEX IF NOT EXISTS "ReservaHotel_modalidad_idx" ON "ReservaHotel"("modalidad")`,
    `CREATE TABLE IF NOT EXISTS "ConfigTour" (
      "id" SERIAL PRIMARY KEY,
      "comercioId" INTEGER NOT NULL UNIQUE,
      "activo" BOOLEAN NOT NULL DEFAULT false,
      "nombre" TEXT NOT NULL DEFAULT 'Tour',
      "descripcion" TEXT,
      "duracionHoras" DOUBLE PRECISION NOT NULL DEFAULT 2,
      "precioPersona" DECIMAL(12,2) NOT NULL DEFAULT 0,
      "maxParticipantes" INTEGER NOT NULL DEFAULT 10,
      "puntoEncuentro" TEXT,
      "fotos" TEXT[] NOT NULL DEFAULT '{}',
      "servicios" TEXT[] NOT NULL DEFAULT '{}',
      "idiomas" TEXT[] NOT NULL DEFAULT '{}',
      "confirmacionAuto" BOOLEAN NOT NULL DEFAULT false,
      "horasLimiteConfirm" INTEGER NOT NULL DEFAULT 2,
      "politicaCancelacion" TEXT,
      "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ConfigTour_comercioId_fkey" FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoReservaTour') THEN
        CREATE TYPE "EstadoReservaTour" AS ENUM ('PENDIENTE','CONFIRMADA','CANCELADA','RECHAZADA','COMPLETADA');
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS "ReservaTour" (
      "id" SERIAL PRIMARY KEY,
      "codigo" TEXT NOT NULL UNIQUE,
      "configTourId" INTEGER NOT NULL,
      "clienteId" INTEGER NOT NULL,
      "fechaTour" TIMESTAMP(3) NOT NULL,
      "participantes" INTEGER NOT NULL DEFAULT 1,
      "total" DECIMAL(12,2) NOT NULL,
      "estado" "EstadoReservaTour" NOT NULL DEFAULT 'PENDIENTE',
      "metodoPago" TEXT NOT NULL DEFAULT 'EFECTIVO',
      "notasCliente" TEXT,
      "nombreContacto" TEXT NOT NULL,
      "telefonoContacto" TEXT NOT NULL,
      "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReservaTour_configTourId_fkey" FOREIGN KEY ("configTourId") REFERENCES "ConfigTour"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "ReservaTour_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    // Categorías base de turismo
    `INSERT INTO "Categoria" ("nombre","slug","icono","activa")
      VALUES ('Hotelería','hoteleria','🏨',true),
             ('Tours & Experiencias','tours','🗺️',true)
      ON CONFLICT ("slug") DO NOTHING`,
    // Reviews de hoteles
    `CREATE TABLE IF NOT EXISTS "ReviewHotel" (
      "id" SERIAL PRIMARY KEY,
      "configHotelId" INTEGER NOT NULL,
      "clienteId" INTEGER NOT NULL,
      "reservaHotelId" INTEGER NOT NULL UNIQUE,
      "calificacion" INTEGER NOT NULL CHECK ("calificacion" BETWEEN 1 AND 5),
      "comentario" TEXT,
      "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReviewHotel_configHotelId_fkey" FOREIGN KEY ("configHotelId") REFERENCES "ConfigHotel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ReviewHotel_clienteId_fkey"    FOREIGN KEY ("clienteId")    REFERENCES "Usuario"("id")     ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "ReviewHotel_reservaHotelId_fkey" FOREIGN KEY ("reservaHotelId") REFERENCES "ReservaHotel"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    // Reviews de tours
    `CREATE TABLE IF NOT EXISTS "ReviewTour" (
      "id" SERIAL PRIMARY KEY,
      "configTourId" INTEGER NOT NULL,
      "clienteId" INTEGER NOT NULL,
      "reservaTourId" INTEGER NOT NULL UNIQUE,
      "calificacion" INTEGER NOT NULL CHECK ("calificacion" BETWEEN 1 AND 5),
      "comentario" TEXT,
      "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReviewTour_configTourId_fkey"   FOREIGN KEY ("configTourId")   REFERENCES "ConfigTour"("id")   ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ReviewTour_clienteId_fkey"      FOREIGN KEY ("clienteId")      REFERENCES "Usuario"("id")      ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "ReviewTour_reservaTourId_fkey"  FOREIGN KEY ("reservaTourId")  REFERENCES "ReservaTour"("id")  ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    // Módulo Transporte fluvial
    `CREATE TABLE IF NOT EXISTS "ConfigTransporte" (
      "id" SERIAL PRIMARY KEY,
      "comercioId" INTEGER NOT NULL UNIQUE,
      "activo" BOOLEAN NOT NULL DEFAULT false,
      "nombre" TEXT NOT NULL DEFAULT 'Mi Servicio',
      "descripcion" TEXT,
      "tipo" TEXT NOT NULL DEFAULT 'LANCHA',
      "fotos" TEXT[] NOT NULL DEFAULT '{}',
      "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ConfigTransporte_comercioId_fkey" FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "RutaTransporte" (
      "id" SERIAL PRIMARY KEY,
      "configTransporteId" INTEGER NOT NULL,
      "origen" TEXT NOT NULL,
      "destino" TEXT NOT NULL,
      "horario" TEXT NOT NULL,
      "diasSemana" TEXT[] NOT NULL DEFAULT '{}',
      "capacidad" INTEGER NOT NULL DEFAULT 10,
      "precioAsiento" DECIMAL(12,2) NOT NULL DEFAULT 0,
      "activo" BOOLEAN NOT NULL DEFAULT true,
      "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "RutaTransporte_configTransporteId_fkey" FOREIGN KEY ("configTransporteId") REFERENCES "ConfigTransporte"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoReservaTransporte') THEN
        CREATE TYPE "EstadoReservaTransporte" AS ENUM ('PENDIENTE','CONFIRMADA','CANCELADA','RECHAZADA','COMPLETADA');
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS "ReservaTransporte" (
      "id" SERIAL PRIMARY KEY,
      "codigo" TEXT NOT NULL UNIQUE,
      "rutaTransporteId" INTEGER NOT NULL,
      "clienteId" INTEGER NOT NULL,
      "fechaViaje" TIMESTAMP(3) NOT NULL,
      "asientos" INTEGER NOT NULL DEFAULT 1,
      "total" DECIMAL(12,2) NOT NULL,
      "estado" "EstadoReservaTransporte" NOT NULL DEFAULT 'PENDIENTE',
      "metodoPago" TEXT NOT NULL DEFAULT 'EFECTIVO',
      "notasCliente" TEXT,
      "nombreContacto" TEXT NOT NULL,
      "telefonoContacto" TEXT NOT NULL,
      "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReservaTransporte_rutaTransporteId_fkey" FOREIGN KEY ("rutaTransporteId") REFERENCES "RutaTransporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "ReservaTransporte_clienteId_fkey"        FOREIGN KEY ("clienteId")        REFERENCES "Usuario"("id")          ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
  ];
  for (const sql of migraciones) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e) {
      console.error("[MIGRACIÓN] Error en:", sql, e.message);
    }
  }
  console.log("[MIGRACIÓN] Columnas verificadas.");
}

// Evitar que excepciones de Baileys/WhatsApp tumben el proceso
process.on("uncaughtException", (err) => {
  console.error("[PROCESO] Excepción no capturada:", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("[PROCESO] Promesa rechazada sin manejar:", reason?.message ?? reason);
});

// Cierre limpio al reiniciar (SIGTERM de nodemon, SIGINT de Ctrl+C)
// Cierra el socket de WhatsApp antes de salir para evitar conflictos 440
// cuando la nueva instancia arranque con las mismas credenciales.
async function shutdown(signal) {
  console.log(`[PROCESO] ${signal} recibido — cerrando WhatsApp antes de salir…`);
  await cerrarConexion();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

aplicarMigraciones().then(() => {
  app.listen(config.puerto, () => {
    console.log(`🌿 AfroMercado API corriendo en http://localhost:${config.puerto}`);
    console.log(`   Entorno: ${config.entorno}`);
    iniciarCron();
    iniciarJobHotel();
  });
});
