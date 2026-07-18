// Punto de entrada — arranca el servidor
// Sentry debe inicializarse antes de cualquier otro require
const Sentry = require("@sentry/node");
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    // En 0 se desactiva el rastreo de rendimiento por petición (transactions/spans);
    // captureException para errores 500 sigue activo sin depender de esto.
    // Bajado temporalmente tras un OOM en Render (Starter, 512MB) que coincidió
    // con una ráfaga de peticiones — mitigación mientras se confirma la causa real.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0 : 1.0,
    // Filtra eventos de test/desarrollo si es necesario
    beforeSend(event) {
      if (process.env.NODE_ENV === "test") return null;
      return event;
    },
  });
}

const app = require("./app");
const config = require("./config");
const { cerrarConexion } = require("./utils/whatsapp");
const { iniciarCron } = require("./utils/cron");
const { iniciarJob: iniciarJobHotel } = require("./jobs/expirarReservasHotel");
const { iniciarJob: iniciarJobRecordatorioTour } = require("./jobs/recordatorioTour");
const { iniciarJob: iniciarJobReintentarDispersiones } = require("./jobs/reintentar-dispersiones.job");
const { iniciarJob: iniciarJobReintentarFacturacion } = require("./jobs/reintentar-facturacion.job");
const prisma = require("./config/prisma");
const { estaConfigurado: smtpConfigurado } = require("./utils/email");

// Advertencias de arranque que dependen de la BD (tabla Config), por eso van
// aparte de config/index.js (síncrono) y corren después de aplicarMigraciones().
async function verificarAdvertenciasArranque() {
  if (!(await smtpConfigurado())) {
    console.warn("[CONFIG] Advertencia: SMTP no configurado (ni en Config ni en variables de entorno) — los correos transaccionales estarán deshabilitados.");
  }
}

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
    `CREATE TABLE IF NOT EXISTS "TourLugar" (
      "id" SERIAL PRIMARY KEY,
      "configTourId" INTEGER NOT NULL,
      "titulo" TEXT NOT NULL,
      "descripcion" TEXT,
      "tipo" TEXT,
      "orden" INTEGER NOT NULL DEFAULT 0,
      "duracionMinutos" INTEGER,
      "recomendaciones" TEXT,
      "latitud" DOUBLE PRECISION,
      "longitud" DOUBLE PRECISION,
      "activo" BOOLEAN NOT NULL DEFAULT true,
      "destacado" BOOLEAN NOT NULL DEFAULT false,
      "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TourLugar_configTourId_fkey" FOREIGN KEY ("configTourId") REFERENCES "ConfigTour"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "TourLugarMedia" (
      "id" SERIAL PRIMARY KEY,
      "tourLugarId" INTEGER NOT NULL,
      "tipo" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "posterUrl" TEXT,
      "titulo" TEXT,
      "descripcion" TEXT,
      "plataforma" TEXT,
      "orden" INTEGER NOT NULL DEFAULT 0,
      "activo" BOOLEAN NOT NULL DEFAULT true,
      "publicId" TEXT,
      "duracionSegundos" DOUBLE PRECISION,
      "bytes" INTEGER,
      "formato" TEXT,
      "mimeType" TEXT,
      "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TourLugarMedia_tourLugarId_fkey" FOREIGN KEY ("tourLugarId") REFERENCES "TourLugar"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `ALTER TABLE "TourLugar" ADD COLUMN IF NOT EXISTS "rutaNombre" TEXT`,
    `CREATE INDEX IF NOT EXISTS "TourLugar_configTourId_orden_idx" ON "TourLugar"("configTourId", "orden")`,
    `CREATE INDEX IF NOT EXISTS "TourLugar_configTourId_activo_idx" ON "TourLugar"("configTourId", "activo")`,
    `CREATE INDEX IF NOT EXISTS "TourLugarMedia_tourLugarId_orden_idx" ON "TourLugarMedia"("tourLugarId", "orden")`,
    `CREATE INDEX IF NOT EXISTS "TourLugarMedia_tipo_idx" ON "TourLugarMedia"("tipo")`,
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
    `ALTER TABLE "ConfigTransporte" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT`,
    `ALTER TABLE "ConfigTransporte" ADD COLUMN IF NOT EXISTS "videoPosterUrl" TEXT`,
    // ── Columnas de video en tablas existentes ─────────────────────────
    `ALTER TABLE "ConfigTour" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT`,
    `ALTER TABLE "ConfigTour" ADD COLUMN IF NOT EXISTS "videoPosterUrl" TEXT`,
    `ALTER TABLE "HabitacionTipo" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT`,
    `ALTER TABLE "HabitacionTipo" ADD COLUMN IF NOT EXISTS "videoPosterUrl" TEXT`,
    `ALTER TABLE "HabitacionTipo" ADD COLUMN IF NOT EXISTS "videoDuracionSeg" INTEGER`,

    // ── GrupoComplemento / ItemComplemento (Express) ───────────────────
    `CREATE TABLE IF NOT EXISTS "GrupoComplemento" (
      "id"         SERIAL PRIMARY KEY,
      "productoId" INTEGER NOT NULL,
      "nombre"     TEXT NOT NULL,
      "minimo"     INTEGER NOT NULL DEFAULT 0,
      "maximo"     INTEGER NOT NULL DEFAULT 1,
      "requerido"  BOOLEAN NOT NULL DEFAULT false,
      "orden"      INTEGER NOT NULL DEFAULT 0,
      "activo"     BOOLEAN NOT NULL DEFAULT true,
      CONSTRAINT "GrupoComplemento_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "GrupoComplemento_productoId_idx" ON "GrupoComplemento"("productoId")`,
    `CREATE TABLE IF NOT EXISTS "ItemComplemento" (
      "id"                  SERIAL PRIMARY KEY,
      "grupoComplementoId"  INTEGER NOT NULL,
      "nombre"              TEXT NOT NULL,
      "icono"               TEXT,
      "imagenUrl"           TEXT,
      "precio"              DECIMAL(12,2) NOT NULL DEFAULT 0,
      "disponible"          BOOLEAN NOT NULL DEFAULT true,
      "orden"               INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "ItemComplemento_grupoComplementoId_fkey" FOREIGN KEY ("grupoComplementoId") REFERENCES "GrupoComplemento"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `ALTER TABLE "ItemComplemento" ADD COLUMN IF NOT EXISTS "icono" TEXT`,
    `ALTER TABLE "ItemComplemento" ADD COLUMN IF NOT EXISTS "imagenUrl" TEXT`,
    `CREATE INDEX IF NOT EXISTS "ItemComplemento_grupoComplementoId_idx" ON "ItemComplemento"("grupoComplementoId")`,
    `CREATE TABLE IF NOT EXISTS "GrupoComplementoBiblioteca" (
      "id" SERIAL PRIMARY KEY,
      "comercioId" INTEGER NOT NULL,
      "nombre" TEXT NOT NULL,
      "minimo" INTEGER NOT NULL DEFAULT 0,
      "maximo" INTEGER NOT NULL DEFAULT 1,
      "requerido" BOOLEAN NOT NULL DEFAULT false,
      "orden" INTEGER NOT NULL DEFAULT 0,
      "activo" BOOLEAN NOT NULL DEFAULT true,
      "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "GrupoComplementoBiblioteca_comercioId_fkey" FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "ItemComplementoBiblioteca" (
      "id" SERIAL PRIMARY KEY,
      "grupoBibliotecaId" INTEGER NOT NULL,
      "nombre" TEXT NOT NULL,
      "icono" TEXT,
      "imagenUrl" TEXT,
      "precio" DECIMAL(12,2) NOT NULL DEFAULT 0,
      "disponible" BOOLEAN NOT NULL DEFAULT true,
      "orden" INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "ItemComplementoBiblioteca_grupoBibliotecaId_fkey" FOREIGN KEY ("grupoBibliotecaId") REFERENCES "GrupoComplementoBiblioteca"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "ProductoGrupoComplemento" (
      "id" SERIAL PRIMARY KEY,
      "productoId" INTEGER NOT NULL,
      "grupoBibliotecaId" INTEGER NOT NULL,
      "minimoOverride" INTEGER,
      "maximoOverride" INTEGER,
      "requeridoOverride" BOOLEAN,
      "orden" INTEGER NOT NULL DEFAULT 0,
      "activo" BOOLEAN NOT NULL DEFAULT true,
      "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProductoGrupoComplemento_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ProductoGrupoComplemento_grupoBibliotecaId_fkey" FOREIGN KEY ("grupoBibliotecaId") REFERENCES "GrupoComplementoBiblioteca"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "GrupoComplementoBiblioteca_comercioId_nombre_key" ON "GrupoComplementoBiblioteca"("comercioId", "nombre")`,
    `CREATE INDEX IF NOT EXISTS "GrupoComplementoBiblioteca_comercioId_idx" ON "GrupoComplementoBiblioteca"("comercioId")`,
    `CREATE INDEX IF NOT EXISTS "ItemComplementoBiblioteca_grupoBibliotecaId_idx" ON "ItemComplementoBiblioteca"("grupoBibliotecaId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ProductoGrupoComplemento_productoId_grupoBibliotecaId_key" ON "ProductoGrupoComplemento"("productoId", "grupoBibliotecaId")`,
    `CREATE INDEX IF NOT EXISTS "ProductoGrupoComplemento_productoId_idx" ON "ProductoGrupoComplemento"("productoId")`,
    `CREATE INDEX IF NOT EXISTS "ProductoGrupoComplemento_grupoBibliotecaId_idx" ON "ProductoGrupoComplemento"("grupoBibliotecaId")`,

    // ── TemporadaHotel ───────────────────
    `CREATE TABLE IF NOT EXISTS "TemporadaHotel" (
      "id"               SERIAL PRIMARY KEY,
      "configHotelId"    INTEGER NOT NULL,
      "habitacionTipoId" INTEGER,
      "nombre"           TEXT NOT NULL,
      "inicio"           TIMESTAMP(3) NOT NULL,
      "fin"              TIMESTAMP(3) NOT NULL,
      "precioPorNoche"   DECIMAL(12,2) NOT NULL,
      "activo"           BOOLEAN NOT NULL DEFAULT true,
      "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TemporadaHotel_configHotelId_fkey"    FOREIGN KEY ("configHotelId")    REFERENCES "ConfigHotel"("id")    ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "TemporadaHotel_habitacionTipoId_fkey" FOREIGN KEY ("habitacionTipoId") REFERENCES "HabitacionTipo"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "TemporadaHotel_configHotelId_activo_idx"    ON "TemporadaHotel"("configHotelId", "activo")`,
    `CREATE INDEX IF NOT EXISTS "TemporadaHotel_habitacionTipoId_activo_idx" ON "TemporadaHotel"("habitacionTipoId", "activo")`,
    `CREATE INDEX IF NOT EXISTS "TemporadaHotel_inicio_fin_idx"              ON "TemporadaHotel"("inicio", "fin")`,


    // Desactivar categoría "Turismo" duplicada — reemplazada por "Tours & Experiencias" (slug 'tours')
    `UPDATE "Categoria" SET "activa" = false WHERE "slug" = 'turismo'`,

    // ── Módulo Cultura: eventos culturales, entradas y reservas ──
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
    `CREATE INDEX IF NOT EXISTS "EventoCultural_estado_fechaInicio_idx" ON "EventoCultural"("estado","fechaInicio")`,
    `CREATE INDEX IF NOT EXISTS "EventoCultural_departamento_municipio_idx" ON "EventoCultural"("departamento","municipio")`,
    `CREATE INDEX IF NOT EXISTS "EventoCultural_comercioId_idx" ON "EventoCultural"("comercioId")`,
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
    `CREATE INDEX IF NOT EXISTS "EntradaCultural_eventoCulturalId_activa_idx" ON "EntradaCultural"("eventoCulturalId","activa")`,
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
      "comision" DECIMAL(10,2),
      "tasaComision" DECIMAL(5,4),
      "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReservaCultural_eventoCulturalId_fkey" FOREIGN KEY ("eventoCulturalId") REFERENCES "EventoCultural"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "ReservaCultural_entradaCulturalId_fkey" FOREIGN KEY ("entradaCulturalId") REFERENCES "EntradaCultural"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "ReservaCultural_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "ReservaCultural_eventoCulturalId_estado_idx" ON "ReservaCultural"("eventoCulturalId","estado")`,
    `CREATE INDEX IF NOT EXISTS "ReservaCultural_clienteId_idx" ON "ReservaCultural"("clienteId")`,
    // Certificación en dos niveles: base nacional + variante de comunidad étnica
    `ALTER TABLE "Comercio" ADD COLUMN IF NOT EXISTS "verificadoEtnico" BOOLEAN NOT NULL DEFAULT false`,

    // Declaración de organización territorial (Módulo D institucional, Ley 1581 - dato sensible)
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoOrganizacionTerritorial') THEN
        CREATE TYPE "TipoOrganizacionTerritorial" AS ENUM ('CONSEJO_COMUNITARIO','RESGUARDO_INDIGENA','ZONA_RESERVA_CAMPESINA','OTRA');
      END IF;
    END $$`,
    `ALTER TABLE "Comercio" ADD COLUMN IF NOT EXISTS "organizacionTerritorialTipo" "TipoOrganizacionTerritorial"`,
    `ALTER TABLE "Comercio" ADD COLUMN IF NOT EXISTS "organizacionTerritorialNombre" TEXT`,
    `ALTER TABLE "Comercio" ADD COLUMN IF NOT EXISTS "organizacionTerritorialFecha" TIMESTAMP(3)`,

    // Directorio de proveedores certificados para compra pública B2G (Módulo C institucional)
    `ALTER TABLE "Comercio" ADD COLUMN IF NOT EXISTS "disponibleComprasPublicas" BOOLEAN NOT NULL DEFAULT false`,

    // Sistema de reclamos/disputas post-compra (reporte + mediación; el reembolso
    // aprobado se descuenta de la siguiente Liquidacion, nunca revierte el pago en Wompi)
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoDisputa') THEN
        CREATE TYPE "EstadoDisputa" AS ENUM ('ABIERTA','RESPONDIDA_COMERCIO','RESUELTA_RECHAZADA','RESUELTA_REEMBOLSO_TOTAL','RESUELTA_REEMBOLSO_PARCIAL','CERRADA_SIN_RESPUESTA');
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MotivoDisputa') THEN
        CREATE TYPE "MotivoDisputa" AS ENUM ('PRODUCTO_NO_LLEGO','PRODUCTO_DEFECTUOSO_O_DANADO','PRODUCTO_INCOMPLETO','PRODUCTO_DIFERENTE_AL_PEDIDO','CALIDAD_NO_CONFORME','SERVICIO_NO_PRESTADO','COBRO_INCORRECTO','OTRO');
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS "Disputa" (
      "id" SERIAL NOT NULL,
      "moduloOrigen" TEXT NOT NULL,
      "referenciaId" INTEGER NOT NULL,
      "compradorId" INTEGER NOT NULL,
      "comercioId" INTEGER NOT NULL,
      "motivo" "MotivoDisputa" NOT NULL,
      "descripcion" TEXT NOT NULL,
      "evidenciaUrls" TEXT[] NOT NULL DEFAULT '{}',
      "montoOriginal" DECIMAL(12,2) NOT NULL,
      "montoNetoOriginal" DECIMAL(12,2) NOT NULL,
      "montoReembolsoSolicitado" DECIMAL(12,2),
      "estado" "EstadoDisputa" NOT NULL DEFAULT 'ABIERTA',
      "respuestaComercio" TEXT,
      "respuestaComercioUrls" TEXT[] NOT NULL DEFAULT '{}',
      "respondidoPor" INTEGER,
      "respondidoAt" TIMESTAMP(3),
      "resolucion" TEXT,
      "montoReembolsoAprobado" DECIMAL(12,2),
      "montoDescuentoComercio" DECIMAL(12,2),
      "resueltoPor" INTEGER,
      "resueltoAt" TIMESTAMP(3),
      "notaCreditoAplicada" BOOLEAN NOT NULL DEFAULT false,
      "notaCreditoLiquidacionId" INTEGER,
      "reembolsoTransferidoAt" TIMESTAMP(3),
      "reembolsoTransferidoPor" INTEGER,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Disputa_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "Disputa_moduloOrigen_referenciaId_idx" ON "Disputa"("moduloOrigen", "referenciaId")`,
    `CREATE INDEX IF NOT EXISTS "Disputa_comercioId_estado_idx" ON "Disputa"("comercioId", "estado")`,
    `CREATE INDEX IF NOT EXISTS "Disputa_compradorId_createdAt_idx" ON "Disputa"("compradorId", "createdAt")`,
    `CREATE INDEX IF NOT EXISTS "Disputa_estado_createdAt_idx" ON "Disputa"("estado", "createdAt")`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Disputa_compradorId_fkey') THEN
        ALTER TABLE "Disputa" ADD CONSTRAINT "Disputa_compradorId_fkey" FOREIGN KEY ("compradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Disputa_comercioId_fkey') THEN
        ALTER TABLE "Disputa" ADD CONSTRAINT "Disputa_comercioId_fkey" FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,

    // ── IVA configurable por comercio (Fase 1.1) ──────────────────
    `CREATE TABLE IF NOT EXISTS "ConfigFiscalComercio" (
      "id"                SERIAL PRIMARY KEY,
      "comercioId"        INTEGER NOT NULL,
      "ivaActivo"         BOOLEAN NOT NULL DEFAULT false,
      "ivaPorcentaje"     DECIMAL(5,2) NOT NULL DEFAULT 19.00,
      "regimenTributario" TEXT,
      "activadoPor"       INTEGER,
      "activadoAt"        TIMESTAMP(3),
      "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"         TIMESTAMP(3) NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ConfigFiscalComercio_comercioId_key" ON "ConfigFiscalComercio"("comercioId")`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ConfigFiscalComercio_comercioId_fkey') THEN
        ALTER TABLE "ConfigFiscalComercio" ADD CONSTRAINT "ConfigFiscalComercio_comercioId_fkey" FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,
    `ALTER TABLE "Pedido" ADD COLUMN IF NOT EXISTS "ivaTotal" DECIMAL(12,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE "SubPedido" ADD COLUMN IF NOT EXISTS "iva" DECIMAL(12,2) NOT NULL DEFAULT 0`,

    // ── Módulo Empleo / Bolsa de Trabajo (Fase 6) ──────────────────
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoOfertaEmpleo') THEN
        CREATE TYPE "EstadoOfertaEmpleo" AS ENUM ('BORRADOR','PUBLICADA','PAUSADA','CERRADA');
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoContratoEmpleo') THEN
        CREATE TYPE "TipoContratoEmpleo" AS ENUM ('TIEMPO_COMPLETO','MEDIO_TIEMPO','POR_DIAS','TEMPORAL','OTRO');
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoPostulacionEmpleo') THEN
        CREATE TYPE "EstadoPostulacionEmpleo" AS ENUM ('ENVIADA','VISTA','PRESELECCIONADO','RECHAZADA','CONTRATADO');
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS "OfertaEmpleo" (
      "id"                      SERIAL PRIMARY KEY,
      "publicadoPorId"          INTEGER NOT NULL,
      "comercioId"              INTEGER,
      "titulo"                  TEXT NOT NULL,
      "descripcion"             TEXT NOT NULL,
      "categoria"               TEXT,
      "tipoContrato"            "TipoContratoEmpleo" NOT NULL,
      "municipio"               TEXT NOT NULL,
      "departamento"            TEXT,
      "salarioMin"              DECIMAL(12,2),
      "salarioMax"              DECIMAL(12,2),
      "salarioNegociable"       BOOLEAN NOT NULL DEFAULT false,
      "requisitos"              TEXT,
      "vacantes"                INTEGER NOT NULL DEFAULT 1,
      "estado"                  "EstadoOfertaEmpleo" NOT NULL DEFAULT 'BORRADOR',
      "estadoModeracion"        TEXT NOT NULL DEFAULT 'PENDIENTE',
      "revisadoPor"             INTEGER,
      "revisadoAt"              TIMESTAMP(3),
      "motivoRechazoModeracion" TEXT,
      "fechaCierre"             TIMESTAMP(3),
      "contactoWhatsapp"        TEXT,
      "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"               TIMESTAMP(3) NOT NULL,
      "deletedAt"               TIMESTAMP(3)
    )`,
    `CREATE INDEX IF NOT EXISTS "OfertaEmpleo_estado_estadoModeracion_municipio_createdAt_idx" ON "OfertaEmpleo"("estado", "estadoModeracion", "municipio", "createdAt")`,
    `CREATE INDEX IF NOT EXISTS "OfertaEmpleo_publicadoPorId_idx" ON "OfertaEmpleo"("publicadoPorId")`,
    `CREATE INDEX IF NOT EXISTS "OfertaEmpleo_comercioId_idx" ON "OfertaEmpleo"("comercioId")`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'OfertaEmpleo_publicadoPorId_fkey') THEN
        ALTER TABLE "OfertaEmpleo" ADD CONSTRAINT "OfertaEmpleo_publicadoPorId_fkey" FOREIGN KEY ("publicadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'OfertaEmpleo_comercioId_fkey') THEN
        ALTER TABLE "OfertaEmpleo" ADD CONSTRAINT "OfertaEmpleo_comercioId_fkey" FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS "HojaDeVida" (
      "id"               SERIAL PRIMARY KEY,
      "usuarioId"        INTEGER NOT NULL,
      "resumenPerfil"    TEXT,
      "telefonoContacto" TEXT NOT NULL,
      "experiencia"      JSONB NOT NULL,
      "educacion"        JSONB NOT NULL,
      "habilidades"      TEXT[] NOT NULL DEFAULT '{}',
      "disponibilidad"   TEXT,
      "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"        TIMESTAMP(3) NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "HojaDeVida_usuarioId_key" ON "HojaDeVida"("usuarioId")`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'HojaDeVida_usuarioId_fkey') THEN
        ALTER TABLE "HojaDeVida" ADD CONSTRAINT "HojaDeVida_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS "PostulacionEmpleo" (
      "id"              SERIAL PRIMARY KEY,
      "ofertaEmpleoId"  INTEGER NOT NULL,
      "postulanteId"    INTEGER NOT NULL,
      "hojaDeVidaId"    INTEGER NOT NULL,
      "experienciaSnap" JSONB NOT NULL,
      "educacionSnap"   JSONB NOT NULL,
      "habilidadesSnap" TEXT[] NOT NULL DEFAULT '{}',
      "mensaje"         TEXT,
      "estado"          "EstadoPostulacionEmpleo" NOT NULL DEFAULT 'ENVIADA',
      "vistaAt"         TIMESTAMP(3),
      "notasPublicador" TEXT,
      "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"       TIMESTAMP(3) NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PostulacionEmpleo_ofertaEmpleoId_postulanteId_key" ON "PostulacionEmpleo"("ofertaEmpleoId", "postulanteId")`,
    `CREATE INDEX IF NOT EXISTS "PostulacionEmpleo_ofertaEmpleoId_estado_idx" ON "PostulacionEmpleo"("ofertaEmpleoId", "estado")`,
    `CREATE INDEX IF NOT EXISTS "PostulacionEmpleo_postulanteId_idx" ON "PostulacionEmpleo"("postulanteId")`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PostulacionEmpleo_ofertaEmpleoId_fkey') THEN
        ALTER TABLE "PostulacionEmpleo" ADD CONSTRAINT "PostulacionEmpleo_ofertaEmpleoId_fkey" FOREIGN KEY ("ofertaEmpleoId") REFERENCES "OfertaEmpleo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PostulacionEmpleo_postulanteId_fkey') THEN
        ALTER TABLE "PostulacionEmpleo" ADD CONSTRAINT "PostulacionEmpleo_postulanteId_fkey" FOREIGN KEY ("postulanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,
    // ALTER TYPE ... ADD VALUE no puede ir dentro de un bloque DO/transacción;
    // se usa IF NOT EXISTS como sentencia suelta para que sea idempotente.
    `ALTER TYPE "EstadoPostulacionEmpleo" ADD VALUE IF NOT EXISTS 'RETIRADA'`,
    // CV adjunto (PDF) en la hoja de vida, y snapshot de foto+CV en la postulación.
    `ALTER TABLE "HojaDeVida" ADD COLUMN IF NOT EXISTS "cvUrl" TEXT`,
    `ALTER TABLE "PostulacionEmpleo" ADD COLUMN IF NOT EXISTS "fotoSnapUrl" TEXT`,
    `ALTER TABLE "PostulacionEmpleo" ADD COLUMN IF NOT EXISTS "cvSnapUrl" TEXT`,
    // Preguntas de selección por oferta + snapshot de respuestas.
    `ALTER TABLE "OfertaEmpleo" ADD COLUMN IF NOT EXISTS "preguntas" JSONB NOT NULL DEFAULT '[]'`,
    `ALTER TABLE "PostulacionEmpleo" ADD COLUMN IF NOT EXISTS "respuestas" JSONB NOT NULL DEFAULT '[]'`,
    // El panel del empleador necesita resumen y disponibilidad también snapshoteados.
    `ALTER TABLE "PostulacionEmpleo" ADD COLUMN IF NOT EXISTS "resumenPerfilSnap" TEXT`,
    `ALTER TABLE "PostulacionEmpleo" ADD COLUMN IF NOT EXISTS "disponibilidadSnap" TEXT`,
    // ── Fidelización / referidos (Fase 5.2) ────────────────────────
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoMovimientoPuntos') THEN
        CREATE TYPE "TipoMovimientoPuntos" AS ENUM ('GANADO_COMPRA','GANADO_REFERIDO','CANJEADO','AJUSTE_ADMIN');
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS "PerfilFidelizacion" (
      "id"                    SERIAL PRIMARY KEY,
      "usuarioId"             INTEGER NOT NULL,
      "puntos"                INTEGER NOT NULL DEFAULT 0,
      "puntosAcumuladosTotal" INTEGER NOT NULL DEFAULT 0,
      "codigoReferido"        TEXT NOT NULL,
      "referidoPorId"         INTEGER,
      "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"             TIMESTAMP(3) NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PerfilFidelizacion_usuarioId_key" ON "PerfilFidelizacion"("usuarioId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PerfilFidelizacion_codigoReferido_key" ON "PerfilFidelizacion"("codigoReferido")`,
    `CREATE INDEX IF NOT EXISTS "PerfilFidelizacion_codigoReferido_idx" ON "PerfilFidelizacion"("codigoReferido")`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PerfilFidelizacion_usuarioId_fkey') THEN
        ALTER TABLE "PerfilFidelizacion" ADD CONSTRAINT "PerfilFidelizacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PerfilFidelizacion_referidoPorId_fkey') THEN
        ALTER TABLE "PerfilFidelizacion" ADD CONSTRAINT "PerfilFidelizacion_referidoPorId_fkey" FOREIGN KEY ("referidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS "MovimientoPuntos" (
      "id"           SERIAL PRIMARY KEY,
      "perfilId"     INTEGER NOT NULL,
      "tipo"         "TipoMovimientoPuntos" NOT NULL,
      "puntos"       INTEGER NOT NULL,
      "moduloOrigen" TEXT,
      "referenciaId" INTEGER,
      "descripcion"  TEXT,
      "creadoPor"    INTEGER,
      "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS "MovimientoPuntos_perfilId_createdAt_idx" ON "MovimientoPuntos"("perfilId", "createdAt")`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'MovimientoPuntos_perfilId_fkey') THEN
        ALTER TABLE "MovimientoPuntos" ADD CONSTRAINT "MovimientoPuntos_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "PerfilFidelizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,

    // ── Alertas de stock bajo (Fase 5.3) ───────────────────────────
    `ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "stockMinimo" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "stockBajoNotificadoAt" TIMESTAMP(3)`,

    // ── Tracking de repartidor + calificación (Fase 4) ────────────
    `ALTER TABLE "Entrega" ADD COLUMN IF NOT EXISTS "ultimaLatitud" DOUBLE PRECISION`,
    `ALTER TABLE "Entrega" ADD COLUMN IF NOT EXISTS "ultimaLongitud" DOUBLE PRECISION`,
    `ALTER TABLE "Entrega" ADD COLUMN IF NOT EXISTS "ultimaUbicacionAt" TIMESTAMP(3)`,
    `CREATE TABLE IF NOT EXISTS "CalificacionRepartidor" (
      "id"           SERIAL PRIMARY KEY,
      "entregaId"    INTEGER NOT NULL,
      "repartidorId" INTEGER NOT NULL,
      "compradorId"  INTEGER NOT NULL,
      "calificacion" INTEGER NOT NULL,
      "comentario"   TEXT,
      "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "CalificacionRepartidor_entregaId_key" ON "CalificacionRepartidor"("entregaId")`,
    `CREATE INDEX IF NOT EXISTS "CalificacionRepartidor_repartidorId_idx" ON "CalificacionRepartidor"("repartidorId")`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CalificacionRepartidor_entregaId_fkey') THEN
        ALTER TABLE "CalificacionRepartidor" ADD CONSTRAINT "CalificacionRepartidor_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CalificacionRepartidor_repartidorId_fkey') THEN
        ALTER TABLE "CalificacionRepartidor" ADD CONSTRAINT "CalificacionRepartidor_repartidorId_fkey" FOREIGN KEY ("repartidorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CalificacionRepartidor_compradorId_fkey') THEN
        ALTER TABLE "CalificacionRepartidor" ADD CONSTRAINT "CalificacionRepartidor_compradorId_fkey" FOREIGN KEY ("compradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,

    // ── PQRSD genérico (Fase 3.1) ──────────────────────────────────
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoPqrsd') THEN
        CREATE TYPE "TipoPqrsd" AS ENUM ('PETICION','QUEJA','RECLAMO','SUGERENCIA','DENUNCIA');
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoPqrsd') THEN
        CREATE TYPE "EstadoPqrsd" AS ENUM ('ABIERTO','EN_PROCESO','RESPONDIDO','CERRADO');
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS "Pqrsd" (
      "id"                SERIAL PRIMARY KEY,
      "usuarioId"         INTEGER,
      "nombreContacto"    TEXT NOT NULL,
      "emailContacto"     TEXT NOT NULL,
      "telefonoContacto"  TEXT,
      "tipo"              "TipoPqrsd" NOT NULL,
      "asunto"            TEXT NOT NULL,
      "mensaje"           TEXT NOT NULL,
      "moduloRelacionado" TEXT,
      "referenciaId"      INTEGER,
      "adjuntoUrls"       TEXT[] NOT NULL DEFAULT '{}',
      "estado"            "EstadoPqrsd" NOT NULL DEFAULT 'ABIERTO',
      "prioridad"         TEXT NOT NULL DEFAULT 'NORMAL',
      "respuesta"         TEXT,
      "respondidoPor"     INTEGER,
      "respondidoAt"      TIMESTAMP(3),
      "cerradoPor"        INTEGER,
      "cerradoAt"         TIMESTAMP(3),
      "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"         TIMESTAMP(3) NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS "Pqrsd_estado_createdAt_idx" ON "Pqrsd"("estado", "createdAt")`,
    `CREATE INDEX IF NOT EXISTS "Pqrsd_usuarioId_createdAt_idx" ON "Pqrsd"("usuarioId", "createdAt")`,
    `CREATE INDEX IF NOT EXISTS "Pqrsd_tipo_estado_idx" ON "Pqrsd"("tipo", "estado")`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Pqrsd_usuarioId_fkey') THEN
        ALTER TABLE "Pqrsd" ADD CONSTRAINT "Pqrsd_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$`,

    // ── Facturación electrónica DIAN (Fase 1.2) ───────────────────
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoFactura') THEN
        CREATE TYPE "EstadoFactura" AS ENUM ('PENDIENTE','ENVIADA','ACEPTADA','RECHAZADA','ERROR','ANULADA','OMITIDA');
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS "FacturaElectronica" (
      "id"                 SERIAL PRIMARY KEY,
      "moduloOrigen"       TEXT NOT NULL,
      "referenciaId"       INTEGER NOT NULL,
      "comercioId"         INTEGER NOT NULL,
      "compradorId"        INTEGER NOT NULL,
      "proveedor"          TEXT NOT NULL DEFAULT 'NINGUNO',
      "estado"             "EstadoFactura" NOT NULL DEFAULT 'PENDIENTE',
      "subtotal"           DECIMAL(12,2) NOT NULL,
      "ivaTotal"           DECIMAL(12,2) NOT NULL DEFAULT 0,
      "total"              DECIMAL(12,2) NOT NULL,
      "cufe"               TEXT,
      "numeroFactura"      TEXT,
      "pdfUrl"             TEXT,
      "xmlUrl"             TEXT,
      "providerFacturaId"  TEXT,
      "providerPayload"    JSONB,
      "errorMensaje"       TEXT,
      "intentosFallidos"   INTEGER NOT NULL DEFAULT 0,
      "proximoReintentoAt" TIMESTAMP(3),
      "anuladaPor"         INTEGER,
      "anuladaAt"          TIMESTAMP(3),
      "motivoAnulacion"    TEXT,
      "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"          TIMESTAMP(3) NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "FacturaElectronica_cufe_key" ON "FacturaElectronica"("cufe")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "FacturaElectronica_moduloOrigen_referenciaId_key" ON "FacturaElectronica"("moduloOrigen", "referenciaId")`,
    `CREATE INDEX IF NOT EXISTS "FacturaElectronica_comercioId_estado_idx" ON "FacturaElectronica"("comercioId", "estado")`,
    `CREATE INDEX IF NOT EXISTS "FacturaElectronica_estado_proximoReintentoAt_idx" ON "FacturaElectronica"("estado", "proximoReintentoAt")`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FacturaElectronica_comercioId_fkey') THEN
        ALTER TABLE "FacturaElectronica" ADD CONSTRAINT "FacturaElectronica_comercioId_fkey" FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FacturaElectronica_compradorId_fkey') THEN
        ALTER TABLE "FacturaElectronica" ADD CONSTRAINT "FacturaElectronica_compradorId_fkey" FOREIGN KEY ("compradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,

    // ── Reintento de dispersiones fallidas ────────────────────────
    `ALTER TABLE "PagoDispersion" ADD COLUMN IF NOT EXISTS "intentosFallidos" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "PagoDispersion" ADD COLUMN IF NOT EXISTS "proximoReintentoAt" TIMESTAMP(3)`,
    `CREATE INDEX IF NOT EXISTS "PagoDispersion_estado_proximoReintentoAt_idx" ON "PagoDispersion"("estado", "proximoReintentoAt")`,

    // ── ReservaTransporte: columnas de descuento/cupón ──────────────────
    `ALTER TABLE "ReservaTransporte" ADD COLUMN IF NOT EXISTS "montoDescuento" DECIMAL(10,2)`,
    `ALTER TABLE "ReservaTransporte" ADD COLUMN IF NOT EXISTS "codigoCupon" TEXT`,

    // ── EstadoEventoCultural: agrega POSPUESTO ──────────────────────────
    `ALTER TYPE "EstadoEventoCultural" ADD VALUE IF NOT EXISTS 'POSPUESTO'`,

    // ── PedidoExpress: pedido programado ("para más tarde") ─────────────
    `ALTER TABLE "PedidoExpress" ADD COLUMN IF NOT EXISTS "fechaProgramada" TIMESTAMP(3)`,

    // ── ReservaHotel: reserva múltiple (varios tipos de habitación en un solo grupo) ──
    `ALTER TABLE "ReservaHotel" ADD COLUMN IF NOT EXISTS "grupoReservaId" TEXT`,
    `CREATE INDEX IF NOT EXISTS "ReservaHotel_grupoReservaId_idx" ON "ReservaHotel"("grupoReservaId")`,

    // ── Publicidad: alcance geográfico (Municipio / Departamento / Nacional) ──
    // Default 'NACIONAL' preserva el comportamiento actual de las pautas ya existentes.
    `ALTER TABLE "VisibilidadPagada" ADD COLUMN IF NOT EXISTS "alcance" TEXT NOT NULL DEFAULT 'NACIONAL'`,
    `ALTER TABLE "VisibilidadPagada" ADD COLUMN IF NOT EXISTS "departamento" TEXT`,
    `ALTER TABLE "VisibilidadPagada" ADD COLUMN IF NOT EXISTS "municipio" TEXT`,
    `ALTER TABLE "SolicitudPublicidad" ADD COLUMN IF NOT EXISTS "alcance" TEXT NOT NULL DEFAULT 'NACIONAL'`,
    `ALTER TABLE "SolicitudPublicidad" ADD COLUMN IF NOT EXISTS "departamento" TEXT`,
    `ALTER TABLE "SolicitudPublicidad" ADD COLUMN IF NOT EXISTS "municipio" TEXT`,

    // ── Publicidad: BANNER_CARRUSEL / IRRUPTOR_BIENVENIDA (imagen diseñada propia) ──
    `ALTER TABLE "SolicitudPublicidad" ADD COLUMN IF NOT EXISTS "imagenPersonalizadaUrl" TEXT`,
    `ALTER TABLE "CampanaHero" ADD COLUMN IF NOT EXISTS "alcance" TEXT NOT NULL DEFAULT 'NACIONAL'`,
    `ALTER TABLE "CampanaHero" ADD COLUMN IF NOT EXISTS "departamento" TEXT`,
    `ALTER TABLE "CampanaHero" ADD COLUMN IF NOT EXISTS "municipio" TEXT`,

    // ── Alianzas comerciales (cupón compartido entre comercios de distintos módulos) ──
    `CREATE TABLE IF NOT EXISTS "AlianzaComercial" (
      "id"                  SERIAL PRIMARY KEY,
      "nombre"              TEXT NOT NULL,
      "descripcion"         TEXT,
      "departamento"        TEXT,
      "municipio"           TEXT,
      "codigoCompartido"    TEXT NOT NULL,
      "estado"              TEXT NOT NULL DEFAULT 'PENDIENTE_APROBACION',
      "inicio"              TIMESTAMP(3) NOT NULL,
      "fin"                 TIMESTAMP(3) NOT NULL,
      "creadoPorComercioId" INTEGER NOT NULL,
      "aprobadoPor"         INTEGER,
      "aprobadoAt"          TIMESTAMP(3),
      "motivoRechazo"       TEXT,
      "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AlianzaComercial_codigoCompartido_key" UNIQUE ("codigoCompartido")
    )`,
    `CREATE INDEX IF NOT EXISTS "AlianzaComercial_codigoCompartido_estado_idx" ON "AlianzaComercial"("codigoCompartido","estado")`,
    `CREATE INDEX IF NOT EXISTS "AlianzaComercial_departamento_municipio_idx" ON "AlianzaComercial"("departamento","municipio")`,
    `CREATE TABLE IF NOT EXISTS "AlianzaSocio" (
      "id"             SERIAL PRIMARY KEY,
      "alianzaId"      INTEGER NOT NULL,
      "comercioId"     INTEGER NOT NULL,
      "modulo"         TEXT NOT NULL,
      "tipoDescuento"  TEXT NOT NULL DEFAULT 'PORCENTAJE',
      "valorDescuento" DECIMAL(10,2) NOT NULL,
      "aceptado"       BOOLEAN NOT NULL DEFAULT false,
      "aceptadoAt"     TIMESTAMP(3),
      "activo"         BOOLEAN NOT NULL DEFAULT true,
      "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AlianzaSocio_alianzaId_fkey"  FOREIGN KEY ("alianzaId")  REFERENCES "AlianzaComercial"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "AlianzaSocio_comercioId_fkey" FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id")         ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "AlianzaSocio_alianzaId_comercioId_modulo_key" UNIQUE ("alianzaId", "comercioId", "modulo")
    )`,
    `CREATE INDEX IF NOT EXISTS "AlianzaSocio_comercioId_modulo_aceptado_activo_idx" ON "AlianzaSocio"("comercioId","modulo","aceptado","activo")`,

    // ── Denuncias de ofertas de empleo ─────────────────────────────
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MotivoDenunciaEmpleo') THEN
        CREATE TYPE "MotivoDenunciaEmpleo" AS ENUM ('OFERTA_FALSA','EXPLOTACION_LABORAL','DISCRIMINATORIA','ESTAFA_DINERO','CONTENIDO_INAPROPIADO','OTRO');
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoDenunciaEmpleo') THEN
        CREATE TYPE "EstadoDenunciaEmpleo" AS ENUM ('PENDIENTE','DESESTIMADA','OFERTA_BLOQUEADA','CUENTA_BLOQUEADA');
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS "DenunciaOfertaEmpleo" (
      "id"             SERIAL PRIMARY KEY,
      "ofertaEmpleoId" INTEGER NOT NULL,
      "denuncianteId"  INTEGER NOT NULL,
      "motivo"         "MotivoDenunciaEmpleo" NOT NULL,
      "descripcion"    TEXT,
      "estado"         "EstadoDenunciaEmpleo" NOT NULL DEFAULT 'PENDIENTE',
      "revisadoPor"    INTEGER,
      "revisadoAt"     TIMESTAMP(3),
      "notaRevision"   TEXT,
      "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "DenunciaOfertaEmpleo_ofertaEmpleoId_denuncianteId_key" ON "DenunciaOfertaEmpleo"("ofertaEmpleoId", "denuncianteId")`,
    `CREATE INDEX IF NOT EXISTS "DenunciaOfertaEmpleo_estado_createdAt_idx" ON "DenunciaOfertaEmpleo"("estado", "createdAt")`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DenunciaOfertaEmpleo_ofertaEmpleoId_fkey') THEN
        ALTER TABLE "DenunciaOfertaEmpleo" ADD CONSTRAINT "DenunciaOfertaEmpleo_ofertaEmpleoId_fkey" FOREIGN KEY ("ofertaEmpleoId") REFERENCES "OfertaEmpleo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DenunciaOfertaEmpleo_denuncianteId_fkey') THEN
        ALTER TABLE "DenunciaOfertaEmpleo" ADD CONSTRAINT "DenunciaOfertaEmpleo_denuncianteId_fkey" FOREIGN KEY ("denuncianteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,
    `ALTER TABLE "CampanaHero" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT`,
    `ALTER TABLE "CampanaHero" ADD COLUMN IF NOT EXISTS "etiqueta" TEXT NOT NULL DEFAULT 'Patrocinado'`,

    // ── Comparte tu Chocó: publicaciones comunitarias + denuncias ──
    `CREATE TABLE IF NOT EXISTS "PublicacionCultural" (
      "id"           SERIAL PRIMARY KEY,
      "autorId"      INTEGER NOT NULL,
      "titulo"       TEXT NOT NULL,
      "descripcion"  TEXT,
      "fotoUrls"     TEXT[] NOT NULL DEFAULT '{}',
      "videoUrl"     TEXT,
      "departamento" TEXT NOT NULL,
      "municipio"    TEXT,
      "activa"       BOOLEAN NOT NULL DEFAULT true,
      "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS "PublicacionCultural_activa_departamento_createdAt_idx" ON "PublicacionCultural"("activa", "departamento", "createdAt")`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PublicacionCultural_autorId_fkey') THEN
        ALTER TABLE "PublicacionCultural" ADD CONSTRAINT "PublicacionCultural_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MotivoDenunciaPublicacion') THEN
        CREATE TYPE "MotivoDenunciaPublicacion" AS ENUM ('CONTENIDO_INAPROPIADO','SPAM','DERECHOS_DE_AUTOR','NO_RELACIONADO','OTRO');
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoDenunciaPublicacion') THEN
        CREATE TYPE "EstadoDenunciaPublicacion" AS ENUM ('PENDIENTE','DESESTIMADA','PUBLICACION_OCULTADA');
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS "DenunciaPublicacionCultural" (
      "id"                    SERIAL PRIMARY KEY,
      "publicacionCulturalId" INTEGER NOT NULL,
      "denuncianteId"         INTEGER NOT NULL,
      "motivo"                "MotivoDenunciaPublicacion" NOT NULL,
      "descripcion"           TEXT,
      "estado"                "EstadoDenunciaPublicacion" NOT NULL DEFAULT 'PENDIENTE',
      "revisadoPor"           INTEGER,
      "revisadoAt"            TIMESTAMP(3),
      "notaRevision"          TEXT,
      "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "DenunciaPublicacionCultural_publicacionCulturalId_denuncian_key" ON "DenunciaPublicacionCultural"("publicacionCulturalId", "denuncianteId")`,
    `CREATE INDEX IF NOT EXISTS "DenunciaPublicacionCultural_estado_createdAt_idx" ON "DenunciaPublicacionCultural"("estado", "createdAt")`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DenunciaPublicacionCultural_publicacionCulturalId_fkey') THEN
        ALTER TABLE "DenunciaPublicacionCultural" ADD CONSTRAINT "DenunciaPublicacionCultural_publicacionCulturalId_fkey" FOREIGN KEY ("publicacionCulturalId") REFERENCES "PublicacionCultural"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DenunciaPublicacionCultural_denuncianteId_fkey') THEN
        ALTER TABLE "DenunciaPublicacionCultural" ADD CONSTRAINT "DenunciaPublicacionCultural_denuncianteId_fkey" FOREIGN KEY ("denuncianteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,

    // ── Likes de publicaciones culturales ──
    `CREATE TABLE IF NOT EXISTS "LikePublicacionCultural" (
      "id"                    SERIAL PRIMARY KEY,
      "usuarioId"             INTEGER NOT NULL,
      "publicacionCulturalId" INTEGER NOT NULL,
      "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "LikePublicacionCultural_usuarioId_publicacionCulturalId_key" ON "LikePublicacionCultural"("usuarioId", "publicacionCulturalId")`,
    `CREATE INDEX IF NOT EXISTS "LikePublicacionCultural_publicacionCulturalId_idx" ON "LikePublicacionCultural"("publicacionCulturalId")`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LikePublicacionCultural_usuarioId_fkey') THEN
        ALTER TABLE "LikePublicacionCultural" ADD CONSTRAINT "LikePublicacionCultural_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LikePublicacionCultural_publicacionCulturalId_fkey') THEN
        ALTER TABLE "LikePublicacionCultural" ADD CONSTRAINT "LikePublicacionCultural_publicacionCulturalId_fkey" FOREIGN KEY ("publicacionCulturalId") REFERENCES "PublicacionCultural"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$`,

    // ── Rediseño de Empleo: imagen tipo banner por vacante ──
    `ALTER TABLE "OfertaEmpleo" ADD COLUMN IF NOT EXISTS "imagenUrl" TEXT`,

    // ── Turismo Comunitario Certificado: RNT en Tour (mismo patron que ConfigHotel) ──
    `ALTER TABLE "ConfigTour" ADD COLUMN IF NOT EXISTS "rnt" TEXT`,
    `ALTER TABLE "ConfigTour" ADD COLUMN IF NOT EXISTS "rntVerificado" BOOLEAN NOT NULL DEFAULT false`,

    // ── Programas y Subsidios con Trazabilidad: agrupa cupones de un mismo programa ──
    `ALTER TABLE "Cupon" ADD COLUMN IF NOT EXISTS "programaNombre" TEXT`,

    // ── Tienda Local: agrupa categorías en Ancestral/Local ──
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GrupoCategoria') THEN
        CREATE TYPE "GrupoCategoria" AS ENUM ('ANCESTRAL', 'LOCAL');
      END IF;
    END $$`,
    `ALTER TABLE "Categoria" ADD COLUMN IF NOT EXISTS "grupo" "GrupoCategoria" NOT NULL DEFAULT 'ANCESTRAL'`,

    // ── Rediseño de Express: video de la tienda (columnas que faltaban) + fotos en reseñas ──
    `ALTER TABLE "ConfigExpress" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT`,
    `ALTER TABLE "ConfigExpress" ADD COLUMN IF NOT EXISTS "videoPosterUrl" TEXT`,

    // ── Vista compacta de sección de menú (ideal para bebidas) ──
    `ALTER TABLE "MenuSeccion" ADD COLUMN IF NOT EXISTS "vistaCompacta" BOOLEAN NOT NULL DEFAULT false`,

    // ── Validación de comerciante: RUT y Cámara de Comercio ──
    `ALTER TABLE "Comercio" ADD COLUMN IF NOT EXISTS "rut" TEXT`,
    `ALTER TABLE "Comercio" ADD COLUMN IF NOT EXISTS "camaraComercioNumero" TEXT`,
    `ALTER TABLE "Comercio" ADD COLUMN IF NOT EXISTS "camaraComercioUrl" TEXT`,

    // ── Anexo B, Fase 1: Favorito unificado (reemplaza 7 tablas por 1) ──
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoEntidadFavorita') THEN
        CREATE TYPE "TipoEntidadFavorita" AS ENUM (
          'PRODUCTO', 'CONFIG_HOTEL', 'CONFIG_EXPRESS', 'CONFIG_TOUR',
          'CONFIG_TRANSPORTE', 'EVENTO_CULTURAL', 'OFERTA_EMPLEO'
        );
      END IF;
    END $$`,
    `ALTER TABLE "Favorito" ADD COLUMN IF NOT EXISTS "tipoEntidad" "TipoEntidadFavorita"`,
    `ALTER TABLE "Favorito" ADD COLUMN IF NOT EXISTS "entidadId" INTEGER`,
    `DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Favorito' AND column_name = 'productoId') THEN
        UPDATE "Favorito" SET "tipoEntidad" = 'PRODUCTO', "entidadId" = "productoId"
          WHERE "tipoEntidad" IS NULL AND "productoId" IS NOT NULL;
      END IF;
    END $$`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Favorito_usuarioId_tipoEntidad_entidadId_key"
      ON "Favorito"("usuarioId", "tipoEntidad", "entidadId")`,
    `DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FavoritoHotel') THEN
        INSERT INTO "Favorito" ("usuarioId", "tipoEntidad", "entidadId", "createdAt")
          SELECT "usuarioId", 'CONFIG_HOTEL', "configHotelId", "createdAt" FROM "FavoritoHotel"
          ON CONFLICT ("usuarioId", "tipoEntidad", "entidadId") DO NOTHING;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FavoritoExpress') THEN
        INSERT INTO "Favorito" ("usuarioId", "tipoEntidad", "entidadId", "createdAt")
          SELECT "usuarioId", 'CONFIG_EXPRESS', "configExpressId", "createdAt" FROM "FavoritoExpress"
          ON CONFLICT ("usuarioId", "tipoEntidad", "entidadId") DO NOTHING;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FavoritoTour') THEN
        INSERT INTO "Favorito" ("usuarioId", "tipoEntidad", "entidadId", "createdAt")
          SELECT "usuarioId", 'CONFIG_TOUR', "configTourId", "createdAt" FROM "FavoritoTour"
          ON CONFLICT ("usuarioId", "tipoEntidad", "entidadId") DO NOTHING;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FavoritoTransporte') THEN
        INSERT INTO "Favorito" ("usuarioId", "tipoEntidad", "entidadId", "createdAt")
          SELECT "usuarioId", 'CONFIG_TRANSPORTE', "configTransporteId", "createdAt" FROM "FavoritoTransporte"
          ON CONFLICT ("usuarioId", "tipoEntidad", "entidadId") DO NOTHING;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FavoritoCultura') THEN
        INSERT INTO "Favorito" ("usuarioId", "tipoEntidad", "entidadId", "createdAt")
          SELECT "usuarioId", 'EVENTO_CULTURAL', "eventoCulturalId", "createdAt" FROM "FavoritoCultura"
          ON CONFLICT ("usuarioId", "tipoEntidad", "entidadId") DO NOTHING;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FavoritoOfertaEmpleo') THEN
        INSERT INTO "Favorito" ("usuarioId", "tipoEntidad", "entidadId", "createdAt")
          SELECT "usuarioId", 'OFERTA_EMPLEO', "ofertaEmpleoId", "createdAt" FROM "FavoritoOfertaEmpleo"
          ON CONFLICT ("usuarioId", "tipoEntidad", "entidadId") DO NOTHING;
      END IF;
    END $$`,
    `ALTER TABLE "Favorito" ALTER COLUMN "tipoEntidad" SET NOT NULL`,
    `ALTER TABLE "Favorito" ALTER COLUMN "entidadId" SET NOT NULL`,
    `ALTER TABLE "Favorito" DROP CONSTRAINT IF EXISTS "Favorito_productoId_fkey"`,
    `DROP INDEX IF EXISTS "Favorito_usuarioId_productoId_key"`,
    `ALTER TABLE "Favorito" DROP COLUMN IF EXISTS "productoId"`,
    `DROP TABLE IF EXISTS "FavoritoHotel"`,
    `DROP TABLE IF EXISTS "FavoritoExpress"`,
    `DROP TABLE IF EXISTS "FavoritoTour"`,
    `DROP TABLE IF EXISTS "FavoritoTransporte"`,
    `DROP TABLE IF EXISTS "FavoritoCultura"`,
    `DROP TABLE IF EXISTS "FavoritoOfertaEmpleo"`,

    // ── Anexo B, Fase 3: Resena unificada (reemplaza 7 tablas por 1) ──
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoEntidadResenable') THEN
        CREATE TYPE "TipoEntidadResenable" AS ENUM (
          'PEDIDO', 'PRODUCTO', 'RESERVA_HOTEL', 'RESERVA_TOUR',
          'RESERVA_TRANSPORTE', 'PEDIDO_EXPRESS', 'RESERVA_CULTURAL'
        );
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS "Resena" (
      "id" SERIAL PRIMARY KEY,
      "tipoEntidad" "TipoEntidadResenable" NOT NULL,
      "entidadId" INTEGER NOT NULL,
      "comercioId" INTEGER,
      "autorId" INTEGER NOT NULL,
      "calificacion" INTEGER NOT NULL,
      "comentario" TEXT,
      "fotoUrls" TEXT[] NOT NULL DEFAULT '{}',
      "videoUrl" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Resena_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "Resena_comercioId_fkey" FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "Resena_tipoEntidad_entidadId_autorId_key" UNIQUE ("tipoEntidad", "entidadId", "autorId")
    )`,
    `CREATE INDEX IF NOT EXISTS "Resena_comercioId_idx" ON "Resena"("comercioId")`,
    `CREATE INDEX IF NOT EXISTS "Resena_tipoEntidad_entidadId_idx" ON "Resena"("tipoEntidad", "entidadId")`,
    `DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Review') THEN
        INSERT INTO "Resena" ("tipoEntidad", "entidadId", "comercioId", "autorId", "calificacion", "comentario", "createdAt")
          SELECT 'PEDIDO', "pedidoId", "comercioId", "compradorId", "calificacion", "comentario", "createdAt" FROM "Review"
          ON CONFLICT ("tipoEntidad", "entidadId", "autorId") DO NOTHING;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReviewProducto') THEN
        INSERT INTO "Resena" ("tipoEntidad", "entidadId", "comercioId", "autorId", "calificacion", "comentario", "createdAt")
          SELECT 'PRODUCTO', rp."productoId", p."comercioId", rp."compradorId", rp."calificacion", rp."comentario", rp."createdAt"
          FROM "ReviewProducto" rp LEFT JOIN "Producto" p ON p."id" = rp."productoId"
          ON CONFLICT ("tipoEntidad", "entidadId", "autorId") DO NOTHING;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReviewHotel') THEN
        INSERT INTO "Resena" ("tipoEntidad", "entidadId", "comercioId", "autorId", "calificacion", "comentario", "createdAt")
          SELECT 'RESERVA_HOTEL', rh."reservaHotelId", ch."comercioId", rh."clienteId", rh."calificacion", rh."comentario", rh."creadoAt"
          FROM "ReviewHotel" rh LEFT JOIN "ConfigHotel" ch ON ch."id" = rh."configHotelId"
          ON CONFLICT ("tipoEntidad", "entidadId", "autorId") DO NOTHING;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReviewTour') THEN
        INSERT INTO "Resena" ("tipoEntidad", "entidadId", "comercioId", "autorId", "calificacion", "comentario", "createdAt")
          SELECT 'RESERVA_TOUR', rt."reservaTourId", ct."comercioId", rt."clienteId", rt."calificacion", rt."comentario", rt."creadoAt"
          FROM "ReviewTour" rt LEFT JOIN "ConfigTour" ct ON ct."id" = rt."configTourId"
          ON CONFLICT ("tipoEntidad", "entidadId", "autorId") DO NOTHING;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReviewTransporte') THEN
        INSERT INTO "Resena" ("tipoEntidad", "entidadId", "comercioId", "autorId", "calificacion", "comentario", "createdAt")
          SELECT 'RESERVA_TRANSPORTE', rt."reservaTransporteId", ctr."comercioId", rt."clienteId", rt."calificacion", rt."comentario", rt."creadoAt"
          FROM "ReviewTransporte" rt LEFT JOIN "ConfigTransporte" ctr ON ctr."id" = rt."configTransporteId"
          ON CONFLICT ("tipoEntidad", "entidadId", "autorId") DO NOTHING;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReviewExpress') THEN
        INSERT INTO "Resena" ("tipoEntidad", "entidadId", "comercioId", "autorId", "calificacion", "comentario", "fotoUrls", "createdAt")
          SELECT 'PEDIDO_EXPRESS', re."pedidoExpressId", ce."comercioId", re."clienteId", re."calificacion", re."comentario", re."fotoUrls", re."creadoAt"
          FROM "ReviewExpress" re LEFT JOIN "ConfigExpress" ce ON ce."id" = re."configExpressId"
          ON CONFLICT ("tipoEntidad", "entidadId", "autorId") DO NOTHING;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReviewCultura') THEN
        INSERT INTO "Resena" ("tipoEntidad", "entidadId", "comercioId", "autorId", "calificacion", "comentario", "fotoUrls", "videoUrl", "createdAt")
          SELECT 'RESERVA_CULTURAL', rc."reservaCulturalId", ev."comercioId", rc."clienteId", rc."calificacion", rc."comentario", rc."fotoUrls", rc."videoUrl", rc."creadoAt"
          FROM "ReviewCultura" rc LEFT JOIN "EventoCultural" ev ON ev."id" = rc."eventoCulturalId"
          ON CONFLICT ("tipoEntidad", "entidadId", "autorId") DO NOTHING;
      END IF;
    END $$`,
    `UPDATE "Comercio" c SET
      "calificacion" = sub.avg_cal,
      "totalReviews" = sub.cnt
      FROM (
        SELECT "comercioId", ROUND(AVG("calificacion")::numeric, 2) AS avg_cal, COUNT(*)::int AS cnt
        FROM "Resena"
        WHERE "comercioId" IS NOT NULL AND "tipoEntidad" != 'PRODUCTO'
        GROUP BY "comercioId"
      ) sub
      WHERE c."id" = sub."comercioId"`,
    `DROP TABLE IF EXISTS "Review"`,
    `DROP TABLE IF EXISTS "ReviewProducto"`,
    `DROP TABLE IF EXISTS "ReviewHotel"`,
    `DROP TABLE IF EXISTS "ReviewTour"`,
    `DROP TABLE IF EXISTS "ReviewTransporte"`,
    `DROP TABLE IF EXISTS "ReviewExpress"`,
    `DROP TABLE IF EXISTS "ReviewCultura"`,

    // ── Anexo B, Fase 4: CuponVertical unificado (Hotel/Express/Tour/Transporte, 8→2) ──
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoEntidadCuponVertical') THEN
        CREATE TYPE "TipoEntidadCuponVertical" AS ENUM (
          'CONFIG_HOTEL', 'CONFIG_EXPRESS', 'CONFIG_TOUR', 'CONFIG_TRANSPORTE'
        );
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS "CuponVertical" (
      "id"              SERIAL PRIMARY KEY,
      "codigo"          TEXT NOT NULL UNIQUE,
      "tipoEntidad"     "TipoEntidadCuponVertical" NOT NULL,
      "entidadId"       INTEGER,
      "tipo"            TEXT NOT NULL DEFAULT 'PORCENTAJE',
      "valor"           DECIMAL(10,2) NOT NULL,
      "minimoAplicable" DECIMAL(12,2),
      "usosMaximos"     INTEGER,
      "usosActuales"    INTEGER NOT NULL DEFAULT 0,
      "activo"          BOOLEAN NOT NULL DEFAULT true,
      "inicio"          TIMESTAMP(3) NOT NULL,
      "fin"             TIMESTAMP(3) NOT NULL,
      "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS "CuponVertical_codigo_activo_idx" ON "CuponVertical"("codigo", "activo")`,
    `CREATE INDEX IF NOT EXISTS "CuponVertical_activo_fin_idx" ON "CuponVertical"("activo", "fin")`,
    `CREATE INDEX IF NOT EXISTS "CuponVertical_tipoEntidad_entidadId_idx" ON "CuponVertical"("tipoEntidad", "entidadId")`,
    `CREATE TABLE IF NOT EXISTS "CuponVerticalUso" (
      "id"          SERIAL PRIMARY KEY,
      "cuponId"     INTEGER NOT NULL,
      "clienteId"   INTEGER NOT NULL,
      "tipoEntidad" "TipoEntidadCuponVertical" NOT NULL,
      "entidadId"   INTEGER NOT NULL,
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CuponVerticalUso_cuponId_fkey" FOREIGN KEY ("cuponId") REFERENCES "CuponVertical"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "CuponVerticalUso_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "CuponVerticalUso_tipoEntidad_entidadId_key" UNIQUE ("tipoEntidad", "entidadId")
    )`,
    `CREATE INDEX IF NOT EXISTS "CuponVerticalUso_cuponId_clienteId_idx" ON "CuponVerticalUso"("cuponId", "clienteId")`,
    `DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CuponHotel') THEN
        INSERT INTO "CuponVertical" ("codigo","tipoEntidad","entidadId","tipo","valor","minimoAplicable","usosMaximos","usosActuales","activo","inicio","fin","createdAt")
          SELECT codigo, 'CONFIG_HOTEL', "configHotelId", tipo, valor, "minimoNoches"::decimal, "usosMaximos", "usosActuales", activo, inicio, fin, "createdAt"
          FROM "CuponHotel"
          ON CONFLICT (codigo) DO NOTHING;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CuponExpress') THEN
        INSERT INTO "CuponVertical" ("codigo","tipoEntidad","entidadId","tipo","valor","minimoAplicable","usosMaximos","usosActuales","activo","inicio","fin","createdAt")
          SELECT codigo, 'CONFIG_EXPRESS', "configExpressId", tipo, valor, "minimoSubtotal", "usosMaximos", "usosActuales", activo, inicio, fin, "createdAt"
          FROM "CuponExpress"
          ON CONFLICT (codigo) DO NOTHING;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CuponTour') THEN
        INSERT INTO "CuponVertical" ("codigo","tipoEntidad","entidadId","tipo","valor","minimoAplicable","usosMaximos","usosActuales","activo","inicio","fin","createdAt")
          SELECT codigo, 'CONFIG_TOUR', "configTourId", tipo, valor, "minimoPersonas"::decimal, "usosMaximos", "usosActuales", activo, inicio, fin, "createdAt"
          FROM "CuponTour"
          ON CONFLICT (codigo) DO NOTHING;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CuponTransporte') THEN
        INSERT INTO "CuponVertical" ("codigo","tipoEntidad","entidadId","tipo","valor","minimoAplicable","usosMaximos","usosActuales","activo","inicio","fin","createdAt")
          SELECT codigo, 'CONFIG_TRANSPORTE', "configTransporteId", tipo, valor, "minimoAsientos"::decimal, "usosMaximos", "usosActuales", activo, inicio, fin, "createdAt"
          FROM "CuponTransporte"
          ON CONFLICT (codigo) DO NOTHING;
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CuponHotelUso') THEN
        INSERT INTO "CuponVerticalUso" ("cuponId","clienteId","tipoEntidad","entidadId","createdAt")
          SELECT cv.id, u."clienteId", 'CONFIG_HOTEL', u."reservaHotelId", u."createdAt"
          FROM "CuponHotelUso" u
          JOIN "CuponHotel" c ON c.id = u."cuponHotelId"
          JOIN "CuponVertical" cv ON cv.codigo = c.codigo AND cv."tipoEntidad" = 'CONFIG_HOTEL'
          ON CONFLICT ("tipoEntidad", "entidadId") DO NOTHING;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CuponExpressUso') THEN
        INSERT INTO "CuponVerticalUso" ("cuponId","clienteId","tipoEntidad","entidadId","createdAt")
          SELECT cv.id, u."clienteId", 'CONFIG_EXPRESS', u."pedidoExpressId", u."createdAt"
          FROM "CuponExpressUso" u
          JOIN "CuponExpress" c ON c.id = u."cuponExpressId"
          JOIN "CuponVertical" cv ON cv.codigo = c.codigo AND cv."tipoEntidad" = 'CONFIG_EXPRESS'
          ON CONFLICT ("tipoEntidad", "entidadId") DO NOTHING;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CuponTourUso') THEN
        INSERT INTO "CuponVerticalUso" ("cuponId","clienteId","tipoEntidad","entidadId","createdAt")
          SELECT cv.id, u."clienteId", 'CONFIG_TOUR', u."reservaTourId", u."createdAt"
          FROM "CuponTourUso" u
          JOIN "CuponTour" c ON c.id = u."cuponTourId"
          JOIN "CuponVertical" cv ON cv.codigo = c.codigo AND cv."tipoEntidad" = 'CONFIG_TOUR'
          ON CONFLICT ("tipoEntidad", "entidadId") DO NOTHING;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CuponTransporteUso') THEN
        INSERT INTO "CuponVerticalUso" ("cuponId","clienteId","tipoEntidad","entidadId","createdAt")
          SELECT cv.id, u."clienteId", 'CONFIG_TRANSPORTE', u."reservaTransporteId", u."createdAt"
          FROM "CuponTransporteUso" u
          JOIN "CuponTransporte" c ON c.id = u."cuponTransporteId"
          JOIN "CuponVertical" cv ON cv.codigo = c.codigo AND cv."tipoEntidad" = 'CONFIG_TRANSPORTE'
          ON CONFLICT ("tipoEntidad", "entidadId") DO NOTHING;
      END IF;
    END $$`,
    `DROP TABLE IF EXISTS "CuponHotelUso"`,
    `DROP TABLE IF EXISTS "CuponHotel"`,
    `DROP TABLE IF EXISTS "CuponExpressUso"`,
    `DROP TABLE IF EXISTS "CuponExpress"`,
    `DROP TABLE IF EXISTS "CuponTourUso"`,
    `DROP TABLE IF EXISTS "CuponTour"`,
    `DROP TABLE IF EXISTS "CuponTransporteUso"`,
    `DROP TABLE IF EXISTS "CuponTransporte"`,

    // ── Anexo B, Fase 5: Entrega sirve también a Express (modo propio/plataforma) ──
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoEntregaDomicilio') THEN
        CREATE TYPE "TipoEntregaDomicilio" AS ENUM ('PROPIO', 'PLATAFORMA');
      END IF;
    END $$`,
    `ALTER TABLE "ConfigExpress" ADD COLUMN IF NOT EXISTS "tipoEntregaDomicilio" "TipoEntregaDomicilio" NOT NULL DEFAULT 'PROPIO'`,
    `ALTER TABLE "Entrega" ALTER COLUMN "subPedidoId" DROP NOT NULL`,
    `ALTER TABLE "Entrega" ADD COLUMN IF NOT EXISTS "pedidoExpressId" INTEGER`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Entrega_pedidoExpressId_key') THEN
        ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_pedidoExpressId_key" UNIQUE ("pedidoExpressId");
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Entrega_pedidoExpressId_fkey') THEN
        ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_pedidoExpressId_fkey" FOREIGN KEY ("pedidoExpressId") REFERENCES "PedidoExpress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Entrega_origen_unico_check') THEN
        ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_origen_unico_check"
          CHECK (("subPedidoId" IS NOT NULL AND "pedidoExpressId" IS NULL) OR ("subPedidoId" IS NULL AND "pedidoExpressId" IS NOT NULL));
      END IF;
    END $$`,
    `ALTER TABLE "PedidoExpress" DROP CONSTRAINT IF EXISTS "PedidoExpress_repartidorId_fkey"`,
    `ALTER TABLE "PedidoExpress" DROP COLUMN IF EXISTS "repartidorId"`,

    // ── Módulo Hotel: categorías de alojamiento (cabaña, apartamento, casa completa, finca, glamping, posada) ──
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoAlojamiento') THEN
        CREATE TYPE "TipoAlojamiento" AS ENUM ('HABITACION', 'CABANA', 'APARTAMENTO', 'CASA_COMPLETA', 'FINCA', 'GLAMPING', 'POSADA');
      END IF;
    END $$`,
    `ALTER TABLE "HabitacionTipo" ADD COLUMN IF NOT EXISTS "tipoAlojamiento" "TipoAlojamiento" NOT NULL DEFAULT 'HABITACION'`,
    `ALTER TYPE "TipoAlojamiento" ADD VALUE IF NOT EXISTS 'HOSTAL'`,
    `ALTER TYPE "TipoAlojamiento" ADD VALUE IF NOT EXISTS 'ALBERGUE'`,
    `ALTER TYPE "TipoAlojamiento" ADD VALUE IF NOT EXISTS 'RESORT'`,

    // ── Módulo Bienes Raíces / Inmuebles (vitrina, sin transacción) ──
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoInmueble') THEN
        CREATE TYPE "TipoInmueble" AS ENUM ('LOTE', 'CASA', 'APARTAMENTO', 'FINCA', 'LOCAL_COMERCIAL', 'BODEGA', 'OTRO');
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoOperacionInmueble') THEN
        CREATE TYPE "TipoOperacionInmueble" AS ENUM ('VENTA', 'ARRIENDO');
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoInmueble') THEN
        CREATE TYPE "EstadoInmueble" AS ENUM ('BORRADOR', 'PUBLICADO', 'PAUSADO', 'CERRADO');
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MotivoDenunciaInmueble') THEN
        CREATE TYPE "MotivoDenunciaInmueble" AS ENUM ('PUBLICACION_FALSA', 'TIERRA_EN_DISPUTA', 'ESTAFA_DINERO', 'DOCUMENTO_FALSO', 'CONTENIDO_INAPROPIADO', 'OTRO');
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoDenunciaInmueble') THEN
        CREATE TYPE "EstadoDenunciaInmueble" AS ENUM ('PENDIENTE', 'DESESTIMADA', 'PUBLICACION_BLOQUEADA', 'CUENTA_BLOQUEADA');
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS "Inmueble" (
      "id"                      SERIAL NOT NULL,
      "publicadorId"            INTEGER NOT NULL,
      "comercioId"              INTEGER,
      "titulo"                  TEXT NOT NULL,
      "descripcion"             TEXT,
      "tipoInmueble"            "TipoInmueble" NOT NULL,
      "tipoOperacion"           "TipoOperacionInmueble" NOT NULL,
      "precio"                  DECIMAL(14,2) NOT NULL,
      "areaM2"                  DOUBLE PRECISION,
      "habitaciones"            INTEGER,
      "banos"                   INTEGER,
      "departamento"            TEXT NOT NULL,
      "municipio"               TEXT NOT NULL,
      "vereda"                  TEXT,
      "direccionReferencia"     TEXT,
      "latitud"                 DOUBLE PRECISION,
      "longitud"                DOUBLE PRECISION,
      "fotoUrls"                TEXT[] NOT NULL DEFAULT '{}',
      "folioMatricula"          TEXT,
      "documentoSoporteUrl"     TEXT,
      "contactoWhatsapp"        TEXT,
      "estado"                  "EstadoInmueble" NOT NULL DEFAULT 'BORRADOR',
      "estadoModeracion"        TEXT NOT NULL DEFAULT 'PENDIENTE',
      "revisadoPor"             INTEGER,
      "revisadoAt"              TIMESTAMP(3),
      "motivoRechazoModeracion" TEXT,
      "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"               TIMESTAMP(3) NOT NULL,
      "deletedAt"               TIMESTAMP(3),
      CONSTRAINT "Inmueble_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "Inmueble_departamento_municipio_idx" ON "Inmueble"("departamento", "municipio")`,
    `CREATE INDEX IF NOT EXISTS "Inmueble_tipoInmueble_tipoOperacion_idx" ON "Inmueble"("tipoInmueble", "tipoOperacion")`,
    `CREATE INDEX IF NOT EXISTS "Inmueble_estado_estadoModeracion_idx" ON "Inmueble"("estado", "estadoModeracion")`,
    `CREATE INDEX IF NOT EXISTS "Inmueble_publicadorId_idx" ON "Inmueble"("publicadorId")`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Inmueble_publicadorId_fkey') THEN
        ALTER TABLE "Inmueble" ADD CONSTRAINT "Inmueble_publicadorId_fkey"
          FOREIGN KEY ("publicadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Inmueble_comercioId_fkey') THEN
        ALTER TABLE "Inmueble" ADD CONSTRAINT "Inmueble_comercioId_fkey"
          FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS "DenunciaInmueble" (
      "id"            SERIAL NOT NULL,
      "inmuebleId"    INTEGER NOT NULL,
      "denuncianteId" INTEGER NOT NULL,
      "motivo"        "MotivoDenunciaInmueble" NOT NULL,
      "descripcion"   TEXT,
      "estado"        "EstadoDenunciaInmueble" NOT NULL DEFAULT 'PENDIENTE',
      "revisadoPor"   INTEGER,
      "revisadoAt"    TIMESTAMP(3),
      "notaRevision"  TEXT,
      "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DenunciaInmueble_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "DenunciaInmueble_inmuebleId_denuncianteId_key" ON "DenunciaInmueble"("inmuebleId", "denuncianteId")`,
    `CREATE INDEX IF NOT EXISTS "DenunciaInmueble_estado_createdAt_idx" ON "DenunciaInmueble"("estado", "createdAt")`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DenunciaInmueble_inmuebleId_fkey') THEN
        ALTER TABLE "DenunciaInmueble" ADD CONSTRAINT "DenunciaInmueble_inmuebleId_fkey"
          FOREIGN KEY ("inmuebleId") REFERENCES "Inmueble"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DenunciaInmueble_denuncianteId_fkey') THEN
        ALTER TABLE "DenunciaInmueble" ADD CONSTRAINT "DenunciaInmueble_denuncianteId_fkey"
          FOREIGN KEY ("denuncianteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$`,
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
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[PROCESO] Promesa rechazada sin manejar:", reason?.message ?? reason);
  if (process.env.SENTRY_DSN) Sentry.captureException(reason);
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

aplicarMigraciones().then(async () => {
  await verificarAdvertenciasArranque();
  app.listen(config.puerto, () => {
    console.log(`🌿 AfroMercado API corriendo en http://localhost:${config.puerto}`);
    console.log(`   Entorno: ${config.entorno}`);
    iniciarCron();
    iniciarJobHotel();
    iniciarJobRecordatorioTour();
    iniciarJobReintentarDispersiones();
    iniciarJobReintentarFacturacion();
  });
});
