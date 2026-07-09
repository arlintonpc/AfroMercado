-- Tienda Local: agrupa categorías en Ancestral/Local
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GrupoCategoria') THEN
    CREATE TYPE "GrupoCategoria" AS ENUM ('ANCESTRAL', 'LOCAL');
  END IF;
END $$;

ALTER TABLE "Categoria" ADD COLUMN IF NOT EXISTS "grupo" "GrupoCategoria" NOT NULL DEFAULT 'ANCESTRAL';
