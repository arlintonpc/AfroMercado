-- AlterTable
ALTER TABLE "SolicitudPublicidad"
ADD COLUMN "politicaAceptada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "politicaVersion" TEXT,
ADD COLUMN "politicaAceptadaAt" TIMESTAMP(3),
ADD COLUMN "politicaIp" TEXT;
