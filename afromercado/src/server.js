// Punto de entrada — arranca el servidor
const app = require("./app");
const config = require("./config");
const { cerrarConexion } = require("./utils/whatsapp");
const { iniciarCron } = require("./utils/cron");
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
  });
});
