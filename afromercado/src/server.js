// Punto de entrada — arranca el servidor
// Sentry debe inicializarse antes de cualquier otro require
const Sentry = require("@sentry/node");
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
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
    `ALTER TABLE "ConfigTransporte" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT`,
    `ALTER TABLE "ConfigTransporte" ADD COLUMN IF NOT EXISTS "videoPosterUrl" TEXT`,
    `CREATE TABLE IF NOT EXISTS "FavoritoTransporte" (
      "id"                 SERIAL PRIMARY KEY,
      "usuarioId"          INTEGER NOT NULL,
      "configTransporteId" INTEGER NOT NULL,
      "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "FavoritoTransporte_usuarioId_fkey"          FOREIGN KEY ("usuarioId")          REFERENCES "Usuario"("id")          ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FavoritoTransporte_configTransporteId_fkey" FOREIGN KEY ("configTransporteId") REFERENCES "ConfigTransporte"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FavoritoTransporte_usuarioId_configTransporteId_key" UNIQUE ("usuarioId", "configTransporteId")
    )`,
    `CREATE INDEX IF NOT EXISTS "FavoritoTransporte_usuarioId_idx" ON "FavoritoTransporte"("usuarioId")`,

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

    // ── ReviewTransporte ───────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS "ReviewTransporte" (
      "id"                  SERIAL PRIMARY KEY,
      "configTransporteId"  INTEGER NOT NULL,
      "clienteId"           INTEGER NOT NULL,
      "reservaTransporteId" INTEGER NOT NULL UNIQUE,
      "calificacion"        INTEGER NOT NULL CHECK ("calificacion" BETWEEN 1 AND 5),
      "comentario"          TEXT,
      "creadoAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReviewTransporte_configTransporteId_fkey"  FOREIGN KEY ("configTransporteId")  REFERENCES "ConfigTransporte"("id")  ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ReviewTransporte_clienteId_fkey"           FOREIGN KEY ("clienteId")           REFERENCES "Usuario"("id")          ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "ReviewTransporte_reservaTransporteId_fkey" FOREIGN KEY ("reservaTransporteId") REFERENCES "ReservaTransporte"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "ReviewTransporte_configTransporteId_idx" ON "ReviewTransporte"("configTransporteId")`,

    // ── ReviewExpress ──────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS "ReviewExpress" (
      "id"              SERIAL PRIMARY KEY,
      "configExpressId" INTEGER NOT NULL,
      "clienteId"       INTEGER NOT NULL,
      "pedidoExpressId" INTEGER NOT NULL UNIQUE,
      "calificacion"    INTEGER NOT NULL CHECK ("calificacion" BETWEEN 1 AND 5),
      "comentario"      TEXT,
      "creadoAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReviewExpress_configExpressId_fkey" FOREIGN KEY ("configExpressId") REFERENCES "ConfigExpress"("id")  ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ReviewExpress_clienteId_fkey"       FOREIGN KEY ("clienteId")       REFERENCES "Usuario"("id")        ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "ReviewExpress_pedidoExpressId_fkey" FOREIGN KEY ("pedidoExpressId") REFERENCES "PedidoExpress"("id")  ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "ReviewExpress_configExpressId_idx" ON "ReviewExpress"("configExpressId")`,

    // ── CuponHotel / CuponHotelUso / TemporadaHotel ───────────────────
    `CREATE TABLE IF NOT EXISTS "CuponHotel" (
      "id"            SERIAL PRIMARY KEY,
      "codigo"        TEXT NOT NULL UNIQUE,
      "tipo"          TEXT NOT NULL DEFAULT 'PORCENTAJE',
      "valor"         DECIMAL(10,2) NOT NULL,
      "minimoNoches"  INTEGER,
      "usosMaximos"   INTEGER,
      "usosActuales"  INTEGER NOT NULL DEFAULT 0,
      "activo"        BOOLEAN NOT NULL DEFAULT true,
      "inicio"        TIMESTAMP(3) NOT NULL,
      "fin"           TIMESTAMP(3) NOT NULL,
      "configHotelId" INTEGER,
      "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CuponHotel_configHotelId_fkey" FOREIGN KEY ("configHotelId") REFERENCES "ConfigHotel"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "CuponHotel_codigo_activo_idx"     ON "CuponHotel"("codigo", "activo")`,
    `CREATE INDEX IF NOT EXISTS "CuponHotel_activo_fin_idx"        ON "CuponHotel"("activo", "fin")`,
    `CREATE INDEX IF NOT EXISTS "CuponHotel_configHotelId_idx"     ON "CuponHotel"("configHotelId")`,
    `CREATE TABLE IF NOT EXISTS "CuponHotelUso" (
      "id"             SERIAL PRIMARY KEY,
      "cuponHotelId"   INTEGER NOT NULL,
      "clienteId"      INTEGER NOT NULL,
      "reservaHotelId" INTEGER NOT NULL UNIQUE,
      "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CuponHotelUso_cuponHotelId_fkey"   FOREIGN KEY ("cuponHotelId")   REFERENCES "CuponHotel"("id")   ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "CuponHotelUso_clienteId_fkey"      FOREIGN KEY ("clienteId")      REFERENCES "Usuario"("id")      ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "CuponHotelUso_reservaHotelId_fkey" FOREIGN KEY ("reservaHotelId") REFERENCES "ReservaHotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "CuponHotelUso_cuponHotelId_clienteId_idx" ON "CuponHotelUso"("cuponHotelId", "clienteId")`,
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

    // ── CuponExpress / CuponExpressUso ─────────────────────────────────
    `CREATE TABLE IF NOT EXISTS "CuponExpress" (
      "id"              SERIAL PRIMARY KEY,
      "codigo"          TEXT NOT NULL UNIQUE,
      "tipo"            TEXT NOT NULL DEFAULT 'PORCENTAJE',
      "valor"           DECIMAL(10,2) NOT NULL,
      "minimoSubtotal"  DECIMAL(10,2),
      "usosMaximos"     INTEGER,
      "usosActuales"    INTEGER NOT NULL DEFAULT 0,
      "activo"          BOOLEAN NOT NULL DEFAULT true,
      "inicio"          TIMESTAMP(3) NOT NULL,
      "fin"             TIMESTAMP(3) NOT NULL,
      "configExpressId" INTEGER,
      "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CuponExpress_configExpressId_fkey" FOREIGN KEY ("configExpressId") REFERENCES "ConfigExpress"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "CuponExpress_codigo_activo_idx"     ON "CuponExpress"("codigo", "activo")`,
    `CREATE INDEX IF NOT EXISTS "CuponExpress_activo_fin_idx"        ON "CuponExpress"("activo", "fin")`,
    `CREATE INDEX IF NOT EXISTS "CuponExpress_configExpressId_idx"   ON "CuponExpress"("configExpressId")`,
    `CREATE TABLE IF NOT EXISTS "CuponExpressUso" (
      "id"              SERIAL PRIMARY KEY,
      "cuponExpressId"  INTEGER NOT NULL,
      "clienteId"       INTEGER NOT NULL,
      "pedidoExpressId" INTEGER NOT NULL UNIQUE,
      "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CuponExpressUso_cuponExpressId_fkey"  FOREIGN KEY ("cuponExpressId")  REFERENCES "CuponExpress"("id")  ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "CuponExpressUso_clienteId_fkey"       FOREIGN KEY ("clienteId")       REFERENCES "Usuario"("id")       ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "CuponExpressUso_pedidoExpressId_fkey" FOREIGN KEY ("pedidoExpressId") REFERENCES "PedidoExpress"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "CuponExpressUso_cuponExpressId_clienteId_idx" ON "CuponExpressUso"("cuponExpressId", "clienteId")`,

    // ── FavoritoHotel ──────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS "FavoritoHotel" (
      "id"            SERIAL PRIMARY KEY,
      "usuarioId"     INTEGER NOT NULL,
      "configHotelId" INTEGER NOT NULL,
      "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "FavoritoHotel_usuarioId_fkey"     FOREIGN KEY ("usuarioId")     REFERENCES "Usuario"("id")     ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FavoritoHotel_configHotelId_fkey" FOREIGN KEY ("configHotelId") REFERENCES "ConfigHotel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FavoritoHotel_usuarioId_configHotelId_key" UNIQUE ("usuarioId", "configHotelId")
    )`,
    `CREATE INDEX IF NOT EXISTS "FavoritoHotel_usuarioId_idx"     ON "FavoritoHotel"("usuarioId")`,
    `CREATE INDEX IF NOT EXISTS "FavoritoHotel_configHotelId_idx" ON "FavoritoHotel"("configHotelId")`,

    // ── CuponTour / CuponTourUso ───────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS "CuponTour" (
      "id"             SERIAL PRIMARY KEY,
      "codigo"         TEXT NOT NULL UNIQUE,
      "tipo"           TEXT NOT NULL DEFAULT 'PORCENTAJE',
      "valor"          DECIMAL(10,2) NOT NULL,
      "minimoPersonas" INTEGER,
      "usosMaximos"    INTEGER,
      "usosActuales"   INTEGER NOT NULL DEFAULT 0,
      "activo"         BOOLEAN NOT NULL DEFAULT true,
      "inicio"         TIMESTAMP(3) NOT NULL,
      "fin"            TIMESTAMP(3) NOT NULL,
      "configTourId"   INTEGER,
      "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CuponTour_configTourId_fkey" FOREIGN KEY ("configTourId") REFERENCES "ConfigTour"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "CuponTour_codigo_activo_idx"   ON "CuponTour"("codigo", "activo")`,
    `CREATE INDEX IF NOT EXISTS "CuponTour_activo_fin_idx"      ON "CuponTour"("activo", "fin")`,
    `CREATE INDEX IF NOT EXISTS "CuponTour_configTourId_idx"    ON "CuponTour"("configTourId")`,
    `CREATE TABLE IF NOT EXISTS "CuponTourUso" (
      "id"            SERIAL PRIMARY KEY,
      "cuponTourId"   INTEGER NOT NULL,
      "clienteId"     INTEGER NOT NULL,
      "reservaTourId" INTEGER NOT NULL UNIQUE,
      "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CuponTourUso_cuponTourId_fkey"   FOREIGN KEY ("cuponTourId")   REFERENCES "CuponTour"("id")   ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "CuponTourUso_clienteId_fkey"     FOREIGN KEY ("clienteId")     REFERENCES "Usuario"("id")     ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "CuponTourUso_reservaTourId_fkey" FOREIGN KEY ("reservaTourId") REFERENCES "ReservaTour"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "CuponTourUso_cuponTourId_clienteId_idx" ON "CuponTourUso"("cuponTourId", "clienteId")`,

    // ── FavoritoTour ───────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS "FavoritoTour" (
      "id"           SERIAL PRIMARY KEY,
      "usuarioId"    INTEGER NOT NULL,
      "configTourId" INTEGER NOT NULL,
      "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "FavoritoTour_usuarioId_fkey"    FOREIGN KEY ("usuarioId")    REFERENCES "Usuario"("id")    ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FavoritoTour_configTourId_fkey" FOREIGN KEY ("configTourId") REFERENCES "ConfigTour"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FavoritoTour_usuarioId_configTourId_key" UNIQUE ("usuarioId", "configTourId")
    )`,
    `CREATE INDEX IF NOT EXISTS "FavoritoTour_usuarioId_idx" ON "FavoritoTour"("usuarioId")`,

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
    // Favoritos de ofertas de empleo (mismo patrón que FavoritoHotel/FavoritoTour).
    `CREATE TABLE IF NOT EXISTS "FavoritoOfertaEmpleo" (
      "id"             SERIAL PRIMARY KEY,
      "usuarioId"      INTEGER NOT NULL,
      "ofertaEmpleoId" INTEGER NOT NULL,
      "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "FavoritoOfertaEmpleo_usuarioId_ofertaEmpleoId_key" ON "FavoritoOfertaEmpleo"("usuarioId", "ofertaEmpleoId")`,
    `CREATE INDEX IF NOT EXISTS "FavoritoOfertaEmpleo_usuarioId_idx" ON "FavoritoOfertaEmpleo"("usuarioId")`,
    `CREATE INDEX IF NOT EXISTS "FavoritoOfertaEmpleo_ofertaEmpleoId_idx" ON "FavoritoOfertaEmpleo"("ofertaEmpleoId")`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FavoritoOfertaEmpleo_usuarioId_fkey') THEN
        ALTER TABLE "FavoritoOfertaEmpleo" ADD CONSTRAINT "FavoritoOfertaEmpleo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FavoritoOfertaEmpleo_ofertaEmpleoId_fkey') THEN
        ALTER TABLE "FavoritoOfertaEmpleo" ADD CONSTRAINT "FavoritoOfertaEmpleo_ofertaEmpleoId_fkey" FOREIGN KEY ("ofertaEmpleoId") REFERENCES "OfertaEmpleo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$`,

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

    // ── CuponTransporte / CuponTransporteUso ──────────────────────
    `ALTER TABLE "ReservaTransporte" ADD COLUMN IF NOT EXISTS "montoDescuento" DECIMAL(10,2)`,
    `ALTER TABLE "ReservaTransporte" ADD COLUMN IF NOT EXISTS "codigoCupon" TEXT`,
    `CREATE TABLE IF NOT EXISTS "CuponTransporte" (
      "id"                 SERIAL PRIMARY KEY,
      "codigo"             TEXT NOT NULL UNIQUE,
      "tipo"               TEXT NOT NULL DEFAULT 'PORCENTAJE',
      "valor"              DECIMAL(10,2) NOT NULL,
      "minimoAsientos"     INTEGER,
      "usosMaximos"        INTEGER,
      "usosActuales"       INTEGER NOT NULL DEFAULT 0,
      "activo"             BOOLEAN NOT NULL DEFAULT true,
      "inicio"             TIMESTAMP(3) NOT NULL,
      "fin"                TIMESTAMP(3) NOT NULL,
      "configTransporteId" INTEGER,
      "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CuponTransporte_configTransporteId_fkey" FOREIGN KEY ("configTransporteId") REFERENCES "ConfigTransporte"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "CuponTransporte_codigo_activo_idx"     ON "CuponTransporte"("codigo", "activo")`,
    `CREATE INDEX IF NOT EXISTS "CuponTransporte_activo_fin_idx"        ON "CuponTransporte"("activo", "fin")`,
    `CREATE INDEX IF NOT EXISTS "CuponTransporte_configTransporteId_idx" ON "CuponTransporte"("configTransporteId")`,
    `CREATE TABLE IF NOT EXISTS "CuponTransporteUso" (
      "id"                  SERIAL PRIMARY KEY,
      "cuponTransporteId"   INTEGER NOT NULL,
      "clienteId"           INTEGER NOT NULL,
      "reservaTransporteId" INTEGER NOT NULL UNIQUE,
      "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CuponTransporteUso_cuponTransporteId_fkey"   FOREIGN KEY ("cuponTransporteId")   REFERENCES "CuponTransporte"("id")   ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "CuponTransporteUso_clienteId_fkey"           FOREIGN KEY ("clienteId")           REFERENCES "Usuario"("id")           ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "CuponTransporteUso_reservaTransporteId_fkey" FOREIGN KEY ("reservaTransporteId") REFERENCES "ReservaTransporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "CuponTransporteUso_cuponTransporteId_clienteId_idx" ON "CuponTransporteUso"("cuponTransporteId", "clienteId")`,

    // ── ReviewCultura ─────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS "ReviewCultura" (
      "id"                SERIAL PRIMARY KEY,
      "eventoCulturalId"  INTEGER NOT NULL,
      "clienteId"         INTEGER NOT NULL,
      "reservaCulturalId" INTEGER NOT NULL UNIQUE,
      "calificacion"      INTEGER NOT NULL,
      "comentario"        TEXT,
      "creadoAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReviewCultura_eventoCulturalId_fkey"  FOREIGN KEY ("eventoCulturalId")  REFERENCES "EventoCultural"("id")  ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ReviewCultura_clienteId_fkey"         FOREIGN KEY ("clienteId")         REFERENCES "Usuario"("id")         ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "ReviewCultura_reservaCulturalId_fkey" FOREIGN KEY ("reservaCulturalId") REFERENCES "ReservaCultural"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "ReviewCultura_eventoCulturalId_idx" ON "ReviewCultura"("eventoCulturalId")`,

    // ── EstadoEventoCultural: agrega POSPUESTO ──────────────────────────
    `ALTER TYPE "EstadoEventoCultural" ADD VALUE IF NOT EXISTS 'POSPUESTO'`,

    // ── FavoritoExpress ──────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS "FavoritoExpress" (
      "id"              SERIAL PRIMARY KEY,
      "usuarioId"       INTEGER NOT NULL,
      "configExpressId" INTEGER NOT NULL,
      "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "FavoritoExpress_usuarioId_fkey"       FOREIGN KEY ("usuarioId")       REFERENCES "Usuario"("id")       ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FavoritoExpress_configExpressId_fkey" FOREIGN KEY ("configExpressId") REFERENCES "ConfigExpress"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FavoritoExpress_usuarioId_configExpressId_key" UNIQUE ("usuarioId", "configExpressId")
    )`,
    `CREATE INDEX IF NOT EXISTS "FavoritoExpress_usuarioId_idx"       ON "FavoritoExpress"("usuarioId")`,
    `CREATE INDEX IF NOT EXISTS "FavoritoExpress_configExpressId_idx" ON "FavoritoExpress"("configExpressId")`,

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
