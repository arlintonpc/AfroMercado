-- DropIndex
DROP INDEX "CuentaDispersionComercio_providerBankId_idx";

-- DropIndex
DROP INDEX "Producto_esExpress_activo_idx";

-- AlterTable
ALTER TABLE "ConfigExpress" ALTER COLUMN "municipiosEntrega" DROP DEFAULT,
ALTER COLUMN "modalidades" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ConfigHotel" ALTER COLUMN "servicios" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ConfigTour" ALTER COLUMN "precioPersona" DROP DEFAULT,
ALTER COLUMN "fotos" DROP DEFAULT,
ALTER COLUMN "servicios" DROP DEFAULT,
ALTER COLUMN "idiomas" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ConfigTransporte" ALTER COLUMN "fotos" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CuentaDispersionComercio" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Entrega" DROP COLUMN "pagadoAt";

-- AlterTable
ALTER TABLE "HabitacionTipo" ALTER COLUMN "fotos" DROP DEFAULT,
ALTER COLUMN "serviciosExtra" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Liquidacion" DROP COLUMN "canceladaAt",
DROP COLUMN "canceladaMotivo";

-- AlterTable
ALTER TABLE "PagoDispersion" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PedidoExpress" ALTER COLUMN "costoEnvio" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "PublicidadPaqueteConfig" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReservaHotel" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReservaTour" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReservaTransporte" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RutaTransporte" ALTER COLUMN "diasSemana" DROP DEFAULT,
ALTER COLUMN "precioAsiento" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SolicitudPublicidad" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "ConfigHotel_activo_idx" ON "ConfigHotel"("activo");

-- CreateIndex
CREATE INDEX "ConfigTour_activo_idx" ON "ConfigTour"("activo");

-- CreateIndex
CREATE INDEX "ConfigTransporte_activo_idx" ON "ConfigTransporte"("activo");

-- CreateIndex
CREATE INDEX "HabitacionTipo_configHotelId_activo_idx" ON "HabitacionTipo"("configHotelId", "activo");

-- CreateIndex
CREATE INDEX "ReservaHotel_configHotelId_estado_idx" ON "ReservaHotel"("configHotelId", "estado");

-- CreateIndex
CREATE INDEX "ReservaHotel_clienteId_idx" ON "ReservaHotel"("clienteId");

-- CreateIndex
CREATE INDEX "ReservaHotel_fechaEntrada_fechaSalida_idx" ON "ReservaHotel"("fechaEntrada", "fechaSalida");

-- CreateIndex
CREATE INDEX "ReservaTour_configTourId_estado_idx" ON "ReservaTour"("configTourId", "estado");

-- CreateIndex
CREATE INDEX "ReservaTour_clienteId_idx" ON "ReservaTour"("clienteId");

-- CreateIndex
CREATE INDEX "ReservaTour_fechaTour_idx" ON "ReservaTour"("fechaTour");

-- CreateIndex
CREATE INDEX "ReservaTransporte_rutaTransporteId_estado_idx" ON "ReservaTransporte"("rutaTransporteId", "estado");

-- CreateIndex
CREATE INDEX "ReservaTransporte_clienteId_idx" ON "ReservaTransporte"("clienteId");

-- CreateIndex
CREATE INDEX "ReservaTransporte_fechaViaje_idx" ON "ReservaTransporte"("fechaViaje");

-- CreateIndex
CREATE INDEX "ReviewHotel_configHotelId_idx" ON "ReviewHotel"("configHotelId");

-- CreateIndex
CREATE INDEX "ReviewTour_configTourId_idx" ON "ReviewTour"("configTourId");

-- CreateIndex
CREATE INDEX "RutaTransporte_configTransporteId_activo_idx" ON "RutaTransporte"("configTransporteId", "activo");
