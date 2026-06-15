-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CC', 'TI', 'CE', 'PEP', 'PASAPORTE', 'NIT');

-- AlterTable: agregar campos al modelo Usuario
ALTER TABLE "Usuario" ADD COLUMN "tipoDocumento" "TipoDocumento",
                      ADD COLUMN "numeroDocumento" TEXT,
                      ADD COLUMN "autorizacionDatos" BOOLEAN NOT NULL DEFAULT false,
                      ADD COLUMN "autorizacionFecha" TIMESTAMP(3),
                      ADD COLUMN "passwordCambiadoAt" TIMESTAMP(3);

-- AlterTable: agregar campos al modelo Comercio
ALTER TABLE "Comercio" ADD COLUMN "vereda" TEXT,
                       ADD COLUMN "fotoDocumentoUrl" TEXT;

-- CreateTable: TokenRecuperacion
CREATE TABLE "TokenRecuperacion" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "reemplazadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenRecuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SesionReset
CREATE TABLE "SesionReset" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SesionReset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TokenRecuperacion_usuarioId_idx" ON "TokenRecuperacion"("usuarioId");

-- CreateIndex
CREATE INDEX "SesionReset_usuarioId_idx" ON "SesionReset"("usuarioId");

-- AddForeignKey
ALTER TABLE "TokenRecuperacion" ADD CONSTRAINT "TokenRecuperacion_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionReset" ADD CONSTRAINT "SesionReset_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
