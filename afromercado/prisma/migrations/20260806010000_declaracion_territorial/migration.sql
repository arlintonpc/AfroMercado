-- Declaracion de organizacion territorial (Modulo D, Ley 1581 - dato sensible)
-- Solo se llenan tras aprobacion admin del CambioCriticoComercio tipo DECLARACION_TERRITORIAL.
DO $$ BEGIN
  CREATE TYPE "TipoOrganizacionTerritorial" AS ENUM ('CONSEJO_COMUNITARIO', 'RESGUARDO_INDIGENA', 'ZONA_RESERVA_CAMPESINA', 'OTRA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Comercio"
  ADD COLUMN IF NOT EXISTS "organizacionTerritorialTipo" "TipoOrganizacionTerritorial",
  ADD COLUMN IF NOT EXISTS "organizacionTerritorialNombre" TEXT,
  ADD COLUMN IF NOT EXISTS "organizacionTerritorialFecha" TIMESTAMP(3);
