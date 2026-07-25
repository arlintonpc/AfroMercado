const prisma = require("../config/prisma");
const crypto = require("crypto");

/**
 * Módulo de Migraciones DDL Idempotentes y Seguras para Neon DB / PostgreSQL.
 * Incluye:
 * 1. Trazabilidad de versión (Tabla `_MigracionLog`).
 * 2. Bloqueo de concurrencia mediante PostgreSQL Advisory Lock (ID 778899).
 * 3. Manejo de errores controlado y registro de fallos.
 * 4. Compatible con Neon DB connection pooling.
 */

const ADVISORY_LOCK_ID = 778899;

const STATEMENTS = [
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

  // Módulo Tours & Transporte
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
  `CREATE TABLE IF NOT EXISTS "ConfigTransporte" (
    "id" SERIAL PRIMARY KEY,
    "comercioId" INTEGER NOT NULL UNIQUE,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "nombre" TEXT NOT NULL DEFAULT 'Transporte',
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

  // Módulo Cultura
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoEventoCultural') THEN
      CREATE TYPE "EstadoEventoCultural" AS ENUM ('BORRADOR','PUBLICADO','FINALIZADO','CANCELADO');
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoReservaCultural') THEN
      CREATE TYPE "EstadoReservaCultural" AS ENUM ('PENDIENTE','CONFIRMADA','CANCELADA','RECHAZADA','USADA');
    END IF;
  END $$`,
  `CREATE TABLE IF NOT EXISTS "EventoCultural" (
    "id" SERIAL PRIMARY KEY,
    "comercioId" INTEGER,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT,
    "departamento" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "lugar" TEXT,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "portadaUrl" TEXT,
    "fotos" TEXT[] NOT NULL DEFAULT '{}',
    "videoUrl" TEXT,
    "patrimonio" BOOLEAN NOT NULL DEFAULT false,
    "patrimonioNota" TEXT,
    "gratuito" BOOLEAN NOT NULL DEFAULT true,
    "destacado" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoEventoCultural" NOT NULL DEFAULT 'BORRADOR',
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventoCultural_comercioId_fkey" FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "EntradaCultural" (
    "id" SERIAL PRIMARY KEY,
    "eventoCulturalId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(12,2) NOT NULL,
    "cupo" INTEGER,
    "vendidas" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntradaCultural_eventoCulturalId_fkey" FOREIGN KEY ("eventoCulturalId") REFERENCES "EventoCultural"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ReservaCultural" (
    "id" SERIAL PRIMARY KEY,
    "codigo" TEXT NOT NULL UNIQUE,
    "eventoCulturalId" INTEGER NOT NULL,
    "entradaCulturalId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "total" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoReservaCultural" NOT NULL DEFAULT 'PENDIENTE',
    "metodoPago" TEXT NOT NULL DEFAULT 'EFECTIVO',
    "notasCliente" TEXT,
    "nombreContacto" TEXT NOT NULL,
    "telefonoContacto" TEXT NOT NULL,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReservaCultural_eventoCulturalId_fkey" FOREIGN KEY ("eventoCulturalId") REFERENCES "EventoCultural"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReservaCultural_entradaCulturalId_fkey" FOREIGN KEY ("entradaCulturalId") REFERENCES "EntradaCultural"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReservaCultural_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "PublicacionCultural" (
    "id" SERIAL PRIMARY KEY,
    "autorId" INTEGER,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fotoUrls" TEXT[] NOT NULL DEFAULT '{}',
    "videoUrl" TEXT,
    "departamento" TEXT NOT NULL,
    "municipio" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE "PublicacionCultural" ADD COLUMN IF NOT EXISTS "comercioId" INTEGER`,
  `ALTER TABLE "PublicacionCultural" ADD COLUMN IF NOT EXISTS "moduloOrigen" TEXT`,
  `ALTER TABLE "PublicacionCultural" ADD COLUMN IF NOT EXISTS "videoPosterUrl" TEXT`,
  `ALTER TABLE "PublicacionCultural" ADD COLUMN IF NOT EXISTS "videoDuracionSegundos" INTEGER`,
  `ALTER TABLE "PublicacionCultural" ADD COLUMN IF NOT EXISTS "videoPublicId" TEXT`,
  `ALTER TABLE "PublicacionCultural" ADD COLUMN IF NOT EXISTS "productoId" INTEGER`,
  
  // Vitrina Social / Comentarios / Historias Efímeras 24h
  `ALTER TABLE "ComentarioPublicacionCultural" ADD COLUMN IF NOT EXISTS "respuestaAId" INTEGER`,
  `ALTER TABLE "ComentarioPublicacionCultural" ADD COLUMN IF NOT EXISTS "fijado" BOOLEAN NOT NULL DEFAULT false`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoMediaHistoria') THEN
      CREATE TYPE "TipoMediaHistoria" AS ENUM ('FOTO', 'VIDEO');
    END IF;
  END $$`,
  // Los nombres deben coincidir con los modelos Prisma. La primera versión
  // creó tablas snake_case, por lo que el cliente no podía consultar historias.
  `CREATE TABLE IF NOT EXISTS "HistoriaEfimera" (
    "id" SERIAL PRIMARY KEY,
    "autorId" INTEGER NOT NULL,
    "comercioId" INTEGER,
    "mediaUrl" TEXT NOT NULL,
    "mediaTipo" "TipoMediaHistoria" NOT NULL DEFAULT 'FOTO',
    "duracionSegundos" INTEGER NOT NULL DEFAULT 5,
    "texto" TEXT,
    "fondoColor" TEXT DEFAULT '#1B4332',
    "vistasCount" INTEGER NOT NULL DEFAULT 0,
    "expiraAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistoriaEfimera_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HistoriaEfimera_comercioId_fkey" FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `ALTER TABLE "HistoriaEfimera" ALTER COLUMN "mediaTipo" DROP DEFAULT`,
  `ALTER TABLE "HistoriaEfimera" ALTER COLUMN "mediaTipo" TYPE "TipoMediaHistoria" USING "mediaTipo"::"TipoMediaHistoria"`,
  `ALTER TABLE "HistoriaEfimera" ALTER COLUMN "mediaTipo" SET DEFAULT 'FOTO'::"TipoMediaHistoria"`,

  `CREATE TABLE IF NOT EXISTS "VistaHistoriaEfimera" (
    "id" SERIAL PRIMARY KEY,
    "historiaId" INTEGER NOT NULL,
    "usuarioId" INTEGER,
    "sesionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VistaHistoriaEfimera_historiaId_fkey" FOREIGN KEY ("historiaId") REFERENCES "HistoriaEfimera"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VistaHistoriaEfimera_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "VistaHistoriaEfimera_historiaId_usuarioId_key" ON "VistaHistoriaEfimera"("historiaId", "usuarioId")`,
  `CREATE INDEX IF NOT EXISTS "HistoriaEfimera_expiraAt_createdAt_idx" ON "HistoriaEfimera"("expiraAt", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "HistoriaEfimera_comercioId_expiraAt_idx" ON "HistoriaEfimera"("comercioId", "expiraAt")`,
  `CREATE INDEX IF NOT EXISTS "HistoriaEfimera_autorId_expiraAt_idx" ON "HistoriaEfimera"("autorId", "expiraAt")`,
  `CREATE INDEX IF NOT EXISTS "VistaHistoriaEfimera_historiaId_createdAt_idx" ON "VistaHistoriaEfimera"("historiaId", "createdAt")`,
  // Conserva contenido publicado con la primera migración, si existe.
  `DO $$ BEGIN
    IF to_regclass('public.historias_efimeras') IS NOT NULL THEN
      INSERT INTO "HistoriaEfimera" ("id", "autorId", "comercioId", "mediaUrl", "mediaTipo", "duracionSegundos", "texto", "fondoColor", "vistasCount", "expiraAt", "createdAt")
      SELECT "id", "autorId", "comercioId", "mediaUrl", "mediaTipo", "duracionSegundos", "texto", "fondoColor", "vistasCount", "expiraAt", "createdAt"
      FROM "historias_efimeras"
      ON CONFLICT ("id") DO NOTHING;
    END IF;
  END $$`,
  `SELECT setval(pg_get_serial_sequence('"HistoriaEfimera"', 'id'), COALESCE((SELECT MAX("id") FROM "HistoriaEfimera"), 1), true)`,
];

async function asegurarTablaLog() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_MigracionLog" (
      "id" SERIAL PRIMARY KEY,
      "hash" TEXT NOT NULL UNIQUE,
      "sql" TEXT NOT NULL,
      "ejecutadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "exito" BOOLEAN NOT NULL DEFAULT true,
      "errorMsg" TEXT
    )
  `);
}

function calcularHash(sql) {
  return crypto.createHash("sha256").update(sql.trim()).digest("hex");
}

async function aplicarMigracionesSeguras() {
  if (process.env.SKIP_AUTO_MIGRATIONS === "true") {
    console.log("[MIGRACIÓN] Auto-migraciones omitidas por SKIP_AUTO_MIGRATIONS=true.");
    return;
  }

  let lockAdquirido = false;
  try {
    // Intentar adquirir PostgreSQL Advisory Lock (previene ejecuciones concurrentes)
    const lockRes = await prisma.$queryRawUnsafe(`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID}) as lock`);
    lockAdquirido = Boolean(lockRes?.[0]?.lock);

    if (!lockAdquirido) {
      console.warn("[MIGRACIÓN] Advisory lock ocupado por otra instancia. Omitiendo migración en esta réplica.");
      return;
    }

    await asegurarTablaLog();

    let aplicadas = 0;
    let omitidas = 0;
    let errores = 0;

    for (const sql of STATEMENTS) {
      const hash = calcularHash(sql);
      const yaAplicada = await prisma.$queryRawUnsafe(
        `SELECT id, exito FROM "_MigracionLog" WHERE hash = $1 AND exito = true`,
        hash
      );

      if (yaAplicada && yaAplicada.length > 0) {
        omitidas++;
        continue;
      }

      try {
        await prisma.$executeRawUnsafe(sql);
        await prisma.$executeRawUnsafe(
          `INSERT INTO "_MigracionLog" ("hash", "sql", "exito") VALUES ($1, $2, true) ON CONFLICT ("hash") DO UPDATE SET "exito" = true, "errorMsg" = NULL`,
          hash,
          sql
        );
        aplicadas++;
      } catch (e) {
        errores++;
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[MIGRACIÓN ERROR] ${msg} en SQL: ${sql.slice(0, 80)}...`);
        await prisma.$executeRawUnsafe(
          `INSERT INTO "_MigracionLog" ("hash", "sql", "exito", "errorMsg") VALUES ($1, $2, false, $3) ON CONFLICT ("hash") DO UPDATE SET "exito" = false, "errorMsg" = $3`,
          hash,
          sql,
          msg
        );

        if (process.env.STRICT_MIGRATION_MODE === "true") {
          throw new Error(`Fallo crítico en migración DDL: ${msg}`);
        }
      }
    }

    console.log(`[MIGRACIÓN] Verificación completada: ${aplicadas} aplicadas, ${omitidas} previamente registradas, ${errores} errores.`);
  } catch (err) {
    console.error("[MIGRACIÓN] Error global al procesar migraciones:", err.message);
    if (process.env.STRICT_MIGRATION_MODE === "true") {
      throw err;
    }
  } finally {
    if (lockAdquirido) {
      try {
        await prisma.$queryRawUnsafe(`SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID})`);
      } catch (e) {
        // Ignorar error al liberar lock
      }
    }
  }
}

module.exports = {
  aplicarMigracionesSeguras,
  STATEMENTS,
};
