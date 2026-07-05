-- Fidelizacion/referidos (Fase 5.2). Economia configurable via Config
-- ("fidelizacion.puntosPorCOP"), no hardcodeada.

DO $$ BEGIN
  CREATE TYPE "TipoMovimientoPuntos" AS ENUM ('GANADO_COMPRA', 'GANADO_REFERIDO', 'CANJEADO', 'AJUSTE_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PerfilFidelizacion" (
  "id"                    SERIAL NOT NULL,
  "usuarioId"             INTEGER NOT NULL,
  "puntos"                INTEGER NOT NULL DEFAULT 0,
  "puntosAcumuladosTotal" INTEGER NOT NULL DEFAULT 0,
  "codigoReferido"        TEXT NOT NULL,
  "referidoPorId"         INTEGER,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PerfilFidelizacion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PerfilFidelizacion_usuarioId_key" ON "PerfilFidelizacion"("usuarioId");
CREATE UNIQUE INDEX IF NOT EXISTS "PerfilFidelizacion_codigoReferido_key" ON "PerfilFidelizacion"("codigoReferido");
CREATE INDEX IF NOT EXISTS "PerfilFidelizacion_codigoReferido_idx" ON "PerfilFidelizacion"("codigoReferido");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PerfilFidelizacion_usuarioId_fkey') THEN
    ALTER TABLE "PerfilFidelizacion" ADD CONSTRAINT "PerfilFidelizacion_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PerfilFidelizacion_referidoPorId_fkey') THEN
    ALTER TABLE "PerfilFidelizacion" ADD CONSTRAINT "PerfilFidelizacion_referidoPorId_fkey"
      FOREIGN KEY ("referidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "MovimientoPuntos" (
  "id"           SERIAL NOT NULL,
  "perfilId"     INTEGER NOT NULL,
  "tipo"         "TipoMovimientoPuntos" NOT NULL,
  "puntos"       INTEGER NOT NULL,
  "moduloOrigen" TEXT,
  "referenciaId" INTEGER,
  "descripcion"  TEXT,
  "creadoPor"    INTEGER,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MovimientoPuntos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MovimientoPuntos_perfilId_createdAt_idx" ON "MovimientoPuntos"("perfilId", "createdAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'MovimientoPuntos_perfilId_fkey') THEN
    ALTER TABLE "MovimientoPuntos" ADD CONSTRAINT "MovimientoPuntos_perfilId_fkey"
      FOREIGN KEY ("perfilId") REFERENCES "PerfilFidelizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
