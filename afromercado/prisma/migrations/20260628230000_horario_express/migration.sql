-- Eliminar columnas de horario simple de ConfigExpress
ALTER TABLE "ConfigExpress"
  DROP COLUMN IF EXISTS "horarioApertura",
  DROP COLUMN IF EXISTS "horarioCierre";

-- Crear enum DiaSemana
DO $$ BEGIN
  CREATE TYPE "DiaSemana" AS ENUM ('LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO','FESTIVO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Crear tabla HorarioExpress
CREATE TABLE IF NOT EXISTS "HorarioExpress" (
  "id"              SERIAL NOT NULL,
  "configExpressId" INTEGER NOT NULL,
  "dia"             "DiaSemana" NOT NULL,
  "abierto"         BOOLEAN NOT NULL DEFAULT true,
  "apertura"        TEXT NOT NULL,
  "cierre"          TEXT NOT NULL,
  CONSTRAINT "HorarioExpress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HorarioExpress_configExpressId_dia_key"
  ON "HorarioExpress"("configExpressId", "dia");

CREATE INDEX IF NOT EXISTS "HorarioExpress_configExpressId_idx"
  ON "HorarioExpress"("configExpressId");

DO $$ BEGIN
  ALTER TABLE "HorarioExpress" ADD CONSTRAINT "HorarioExpress_configExpressId_fkey"
    FOREIGN KEY ("configExpressId") REFERENCES "ConfigExpress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
