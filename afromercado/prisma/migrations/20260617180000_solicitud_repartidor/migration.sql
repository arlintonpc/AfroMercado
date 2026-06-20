-- CreateEnum
CREATE TYPE "TipoVehiculo" AS ENUM ('MOTO', 'BICICLETA', 'CARRO', 'CAMIONETA', 'TRICIMOTO');

-- CreateEnum
CREATE TYPE "EstadoSolicitudRepartidor" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "SolicitudRepartidor" (
    "id"              SERIAL NOT NULL,
    "usuarioId"       INTEGER NOT NULL,
    "vehiculoTipo"    "TipoVehiculo" NOT NULL,
    "vehiculoMarca"   TEXT NOT NULL,
    "vehiculoModelo"  TEXT NOT NULL,
    "vehiculoColor"   TEXT NOT NULL,
    "vehiculoPlaca"   TEXT NOT NULL,
    "vehiculoAnio"    INTEGER NOT NULL,
    "licenciaNumero"  TEXT NOT NULL,
    "fotoVehiculoUrl" TEXT,
    "fotoLicenciaUrl" TEXT,
    "estado"          "EstadoSolicitudRepartidor" NOT NULL DEFAULT 'PENDIENTE',
    "notasAdmin"      TEXT,
    "revisadoPor"     INTEGER,
    "revisadoAt"      TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitudRepartidor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudRepartidor_usuarioId_key" ON "SolicitudRepartidor"("usuarioId");

-- CreateIndex
CREATE INDEX "SolicitudRepartidor_estado_createdAt_idx" ON "SolicitudRepartidor"("estado", "createdAt");

-- AddForeignKey
ALTER TABLE "SolicitudRepartidor" ADD CONSTRAINT "SolicitudRepartidor_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
