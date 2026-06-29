-- DropIndex (safe)
DROP INDEX IF EXISTS "CuentaDispersionComercio_providerBankId_idx";
DROP INDEX IF EXISTS "Producto_esExpress_activo_idx";

-- AlterTable ConfigExpress
ALTER TABLE "ConfigExpress"
  ALTER COLUMN "municipiosEntrega" DROP DEFAULT,
  ALTER COLUMN "modalidades" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable ConfigHotel
ALTER TABLE "ConfigHotel"
  ALTER COLUMN "servicios" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable ConfigTour
ALTER TABLE "ConfigTour"
  ALTER COLUMN "precioPersona" DROP DEFAULT,
  ALTER COLUMN "fotos" DROP DEFAULT,
  ALTER COLUMN "servicios" DROP DEFAULT,
  ALTER COLUMN "idiomas" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable ConfigTransporte
ALTER TABLE "ConfigTransporte"
  ALTER COLUMN "fotos" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable CuentaDispersionComercio
ALTER TABLE "CuentaDispersionComercio"
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable Entrega (safe)
ALTER TABLE "Entrega" DROP COLUMN IF EXISTS "pagadoAt";

-- AlterTable HabitacionTipo
ALTER TABLE "HabitacionTipo"
  ALTER COLUMN "fotos" DROP DEFAULT,
  ALTER COLUMN "serviciosExtra" DROP DEFAULT;

-- AlterTable Liquidacion (safe)
ALTER TABLE "Liquidacion"
  DROP COLUMN IF EXISTS "canceladaAt",
  DROP COLUMN IF EXISTS "canceladaMotivo";

-- AlterTable PagoDispersion
ALTER TABLE "PagoDispersion"
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable PedidoExpress
ALTER TABLE "PedidoExpress"
  ALTER COLUMN "costoEnvio" SET DATA TYPE DECIMAL(10,2);

-- AlterTable PublicidadPaqueteConfig
ALTER TABLE "PublicidadPaqueteConfig"
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable ReservaHotel
ALTER TABLE "ReservaHotel"
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable ReservaTour
ALTER TABLE "ReservaTour"
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable ReservaTransporte
ALTER TABLE "ReservaTransporte"
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable RutaTransporte
ALTER TABLE "RutaTransporte"
  ALTER COLUMN "diasSemana" DROP DEFAULT,
  ALTER COLUMN "precioAsiento" DROP DEFAULT;

-- AlterTable SolicitudPublicidad
ALTER TABLE "SolicitudPublicidad"
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex (safe)
CREATE INDEX IF NOT EXISTS "ConfigHotel_activo_idx" ON "ConfigHotel"("activo");
CREATE INDEX IF NOT EXISTS "ConfigTour_activo_idx" ON "ConfigTour"("activo");
CREATE INDEX IF NOT EXISTS "ConfigTransporte_activo_idx" ON "ConfigTransporte"("activo");
CREATE INDEX IF NOT EXISTS "HabitacionTipo_configHotelId_activo_idx" ON "HabitacionTipo"("configHotelId", "activo");
CREATE INDEX IF NOT EXISTS "ReservaHotel_configHotelId_estado_idx" ON "ReservaHotel"("configHotelId", "estado");
CREATE INDEX IF NOT EXISTS "ReservaHotel_clienteId_idx" ON "ReservaHotel"("clienteId");
CREATE INDEX IF NOT EXISTS "ReservaHotel_fechaEntrada_fechaSalida_idx" ON "ReservaHotel"("fechaEntrada", "fechaSalida");
CREATE INDEX IF NOT EXISTS "ReservaTour_configTourId_estado_idx" ON "ReservaTour"("configTourId", "estado");
CREATE INDEX IF NOT EXISTS "ReservaTour_clienteId_idx" ON "ReservaTour"("clienteId");
CREATE INDEX IF NOT EXISTS "ReservaTour_fechaTour_idx" ON "ReservaTour"("fechaTour");
CREATE INDEX IF NOT EXISTS "ReservaTransporte_rutaTransporteId_estado_idx" ON "ReservaTransporte"("rutaTransporteId", "estado");
CREATE INDEX IF NOT EXISTS "ReservaTransporte_clienteId_idx" ON "ReservaTransporte"("clienteId");
CREATE INDEX IF NOT EXISTS "ReservaTransporte_fechaViaje_idx" ON "ReservaTransporte"("fechaViaje");
CREATE INDEX IF NOT EXISTS "ReviewHotel_configHotelId_idx" ON "ReviewHotel"("configHotelId");
CREATE INDEX IF NOT EXISTS "ReviewTour_configTourId_idx" ON "ReviewTour"("configTourId");
CREATE INDEX IF NOT EXISTS "RutaTransporte_configTransporteId_activo_idx" ON "RutaTransporte"("configTransporteId", "activo");
