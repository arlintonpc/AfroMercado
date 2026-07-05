-- Tracking en vivo del repartidor (Fase 4.1, reutiliza SSE ya existente) +
-- calificacion del repartidor por el comprador (Fase 4.2).

ALTER TABLE "Entrega" ADD COLUMN IF NOT EXISTS "ultimaLatitud" DOUBLE PRECISION;
ALTER TABLE "Entrega" ADD COLUMN IF NOT EXISTS "ultimaLongitud" DOUBLE PRECISION;
ALTER TABLE "Entrega" ADD COLUMN IF NOT EXISTS "ultimaUbicacionAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "CalificacionRepartidor" (
  "id"           SERIAL NOT NULL,
  "entregaId"    INTEGER NOT NULL,
  "repartidorId" INTEGER NOT NULL,
  "compradorId"  INTEGER NOT NULL,
  "calificacion" INTEGER NOT NULL,
  "comentario"   TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CalificacionRepartidor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CalificacionRepartidor_entregaId_key" ON "CalificacionRepartidor"("entregaId");
CREATE INDEX IF NOT EXISTS "CalificacionRepartidor_repartidorId_idx" ON "CalificacionRepartidor"("repartidorId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CalificacionRepartidor_entregaId_fkey'
  ) THEN
    ALTER TABLE "CalificacionRepartidor" ADD CONSTRAINT "CalificacionRepartidor_entregaId_fkey"
      FOREIGN KEY ("entregaId") REFERENCES "Entrega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CalificacionRepartidor_repartidorId_fkey'
  ) THEN
    ALTER TABLE "CalificacionRepartidor" ADD CONSTRAINT "CalificacionRepartidor_repartidorId_fkey"
      FOREIGN KEY ("repartidorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CalificacionRepartidor_compradorId_fkey'
  ) THEN
    ALTER TABLE "CalificacionRepartidor" ADD CONSTRAINT "CalificacionRepartidor_compradorId_fkey"
      FOREIGN KEY ("compradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
