-- CreateEnum TipoDistribucionCupon
DO $$ BEGIN
  CREATE TYPE "TipoDistribucionCupon" AS ENUM ('PUBLICO', 'ASIGNADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable Cupon: nuevos campos
ALTER TABLE "Cupon"
  ADD COLUMN IF NOT EXISTS "usosMaximosPorUsuario" INTEGER,
  ADD COLUMN IF NOT EXISTS "distribucion" "TipoDistribucionCupon" NOT NULL DEFAULT 'PUBLICO';

-- CreateTable CuponComercio
CREATE TABLE IF NOT EXISTS "CuponComercio" (
    "id"         SERIAL NOT NULL,
    "cuponId"    INTEGER NOT NULL,
    "comercioId" INTEGER NOT NULL,
    CONSTRAINT "CuponComercio_pkey" PRIMARY KEY ("id")
);

-- CreateTable CuponAsignacion
CREATE TABLE IF NOT EXISTS "CuponAsignacion" (
    "id"        SERIAL NOT NULL,
    "cuponId"   INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CuponAsignacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex CuponComercio
CREATE UNIQUE INDEX IF NOT EXISTS "CuponComercio_cuponId_comercioId_key" ON "CuponComercio"("cuponId", "comercioId");
CREATE INDEX IF NOT EXISTS "CuponComercio_cuponId_idx" ON "CuponComercio"("cuponId");

-- CreateIndex CuponAsignacion
CREATE UNIQUE INDEX IF NOT EXISTS "CuponAsignacion_cuponId_usuarioId_key" ON "CuponAsignacion"("cuponId", "usuarioId");
CREATE INDEX IF NOT EXISTS "CuponAsignacion_cuponId_idx" ON "CuponAsignacion"("cuponId");

-- AddForeignKey CuponComercio
ALTER TABLE "CuponComercio" ADD CONSTRAINT "CuponComercio_cuponId_fkey"
    FOREIGN KEY ("cuponId") REFERENCES "Cupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuponComercio" ADD CONSTRAINT "CuponComercio_comercioId_fkey"
    FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey CuponAsignacion
ALTER TABLE "CuponAsignacion" ADD CONSTRAINT "CuponAsignacion_cuponId_fkey"
    FOREIGN KEY ("cuponId") REFERENCES "Cupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuponAsignacion" ADD CONSTRAINT "CuponAsignacion_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
