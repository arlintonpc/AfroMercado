-- Piloto Servicios Profesionales (Capítulo 3, sección 3.4.4): un solo campo
-- discriminador en OfertaEmpleo en vez de un módulo nuevo. Cero modelos
-- nuevos — moderación, denuncias y postulaciones se reutilizan tal cual.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoPublicacionEmpleo') THEN
    CREATE TYPE "TipoPublicacionEmpleo" AS ENUM ('OFERTA_EMPLEO', 'OFRECE_SERVICIO');
  END IF;
END $$;

ALTER TABLE "OfertaEmpleo" ADD COLUMN IF NOT EXISTS "tipoPublicacion" "TipoPublicacionEmpleo" NOT NULL DEFAULT 'OFERTA_EMPLEO';
