-- Sistema PQRSD generico (Fase 3.1) — canal de contacto con la plataforma,
-- distinto de Disputa (que es contra un comercio especifico). Acepta
-- visitantes sin cuenta (usuarioId nullable).

DO $$ BEGIN
  CREATE TYPE "TipoPqrsd" AS ENUM ('PETICION', 'QUEJA', 'RECLAMO', 'SUGERENCIA', 'DENUNCIA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EstadoPqrsd" AS ENUM ('ABIERTO', 'EN_PROCESO', 'RESPONDIDO', 'CERRADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Pqrsd" (
  "id"                SERIAL NOT NULL,
  "usuarioId"         INTEGER,
  "nombreContacto"    TEXT NOT NULL,
  "emailContacto"     TEXT NOT NULL,
  "telefonoContacto"  TEXT,
  "tipo"              "TipoPqrsd" NOT NULL,
  "asunto"            TEXT NOT NULL,
  "mensaje"           TEXT NOT NULL,
  "moduloRelacionado" TEXT,
  "referenciaId"      INTEGER,
  "adjuntoUrls"       TEXT[] NOT NULL DEFAULT '{}',
  "estado"            "EstadoPqrsd" NOT NULL DEFAULT 'ABIERTO',
  "prioridad"         TEXT NOT NULL DEFAULT 'NORMAL',
  "respuesta"         TEXT,
  "respondidoPor"     INTEGER,
  "respondidoAt"      TIMESTAMP(3),
  "cerradoPor"        INTEGER,
  "cerradoAt"         TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Pqrsd_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Pqrsd_estado_createdAt_idx" ON "Pqrsd"("estado", "createdAt");
CREATE INDEX IF NOT EXISTS "Pqrsd_usuarioId_createdAt_idx" ON "Pqrsd"("usuarioId", "createdAt");
CREATE INDEX IF NOT EXISTS "Pqrsd_tipo_estado_idx" ON "Pqrsd"("tipo", "estado");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Pqrsd_usuarioId_fkey'
  ) THEN
    ALTER TABLE "Pqrsd" ADD CONSTRAINT "Pqrsd_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
