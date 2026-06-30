-- AlterTable ConfigTour
ALTER TABLE "ConfigTour" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;
ALTER TABLE "ConfigTour" ADD COLUMN IF NOT EXISTS "videoPosterUrl" TEXT;

-- AlterTable ReservaTour
ALTER TABLE "ReservaTour" ADD COLUMN IF NOT EXISTS "comision" DECIMAL(10,2);
ALTER TABLE "ReservaTour" ADD COLUMN IF NOT EXISTS "tasaComision" DECIMAL(5,4);
ALTER TABLE "ReservaTour" ADD COLUMN IF NOT EXISTS "montoDescuento" DECIMAL(10,2);
ALTER TABLE "ReservaTour" ADD COLUMN IF NOT EXISTS "codigoCupon" TEXT;

-- CreateTable CuponTour
CREATE TABLE IF NOT EXISTS "CuponTour" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'PORCENTAJE',
    "valor" DECIMAL(10,2) NOT NULL,
    "minimoPersonas" INTEGER,
    "usosMaximos" INTEGER,
    "usosActuales" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "configTourId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CuponTour_pkey" PRIMARY KEY ("id")
);

-- CreateTable CuponTourUso
CREATE TABLE IF NOT EXISTS "CuponTourUso" (
    "id" SERIAL NOT NULL,
    "cuponTourId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "reservaTourId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CuponTourUso_pkey" PRIMARY KEY ("id")
);

-- CreateTable FavoritoTour
CREATE TABLE IF NOT EXISTS "FavoritoTour" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "configTourId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FavoritoTour_pkey" PRIMARY KEY ("id")
);

-- Unique & Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "CuponTour_codigo_key" ON "CuponTour"("codigo");
CREATE UNIQUE INDEX IF NOT EXISTS "CuponTourUso_reservaTourId_key" ON "CuponTourUso"("reservaTourId");
CREATE UNIQUE INDEX IF NOT EXISTS "FavoritoTour_usuarioId_configTourId_key" ON "FavoritoTour"("usuarioId", "configTourId");
CREATE INDEX IF NOT EXISTS "CuponTour_codigo_activo_idx" ON "CuponTour"("codigo", "activo");
CREATE INDEX IF NOT EXISTS "CuponTour_activo_fin_idx" ON "CuponTour"("activo", "fin");
CREATE INDEX IF NOT EXISTS "CuponTour_configTourId_idx" ON "CuponTour"("configTourId");
CREATE INDEX IF NOT EXISTS "CuponTourUso_cuponTourId_clienteId_idx" ON "CuponTourUso"("cuponTourId", "clienteId");
CREATE INDEX IF NOT EXISTS "FavoritoTour_usuarioId_idx" ON "FavoritoTour"("usuarioId");

-- ForeignKeys
ALTER TABLE "CuponTour" ADD CONSTRAINT "CuponTour_configTourId_fkey"
    FOREIGN KEY ("configTourId") REFERENCES "ConfigTour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CuponTourUso" ADD CONSTRAINT "CuponTourUso_cuponTourId_fkey"
    FOREIGN KEY ("cuponTourId") REFERENCES "CuponTour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CuponTourUso" ADD CONSTRAINT "CuponTourUso_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CuponTourUso" ADD CONSTRAINT "CuponTourUso_reservaTourId_fkey"
    FOREIGN KEY ("reservaTourId") REFERENCES "ReservaTour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FavoritoTour" ADD CONSTRAINT "FavoritoTour_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FavoritoTour" ADD CONSTRAINT "FavoritoTour_configTourId_fkey"
    FOREIGN KEY ("configTourId") REFERENCES "ConfigTour"("id") ON DELETE CASCADE ON UPDATE CASCADE;
