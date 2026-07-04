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

aplicarMigraciones().then(() => {
  app.listen(config.puerto, () => {
    console.log(`🌿 AfroMercado API corriendo en http://localhost:${config.puerto}`);
    console.log(`   Entorno: ${config.entorno}`);
    iniciarCron();
    iniciarJobHotel();
    iniciarJobRecordatorioTour();
  });
});
