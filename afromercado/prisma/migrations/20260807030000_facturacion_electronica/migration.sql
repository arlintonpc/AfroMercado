-- Facturacion electronica DIAN (Fase 1.2). Abstraccion de proveedor externo;
-- hoy solo existe el proveedor no-op "NINGUNO" (ver services/facturacion/*).
-- Mismo patron polimorfico que Disputa (moduloOrigen/referenciaId).

DO $$ BEGIN
  CREATE TYPE "EstadoFactura" AS ENUM (
    'PENDIENTE', 'ENVIADA', 'ACEPTADA', 'RECHAZADA', 'ERROR', 'ANULADA', 'OMITIDA'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FacturaElectronica" (
  "id"                 SERIAL NOT NULL,
  "moduloOrigen"       TEXT NOT NULL,
  "referenciaId"       INTEGER NOT NULL,
  "comercioId"         INTEGER NOT NULL,
  "compradorId"        INTEGER NOT NULL,
  "proveedor"          TEXT NOT NULL DEFAULT 'NINGUNO',
  "estado"             "EstadoFactura" NOT NULL DEFAULT 'PENDIENTE',
  "subtotal"           DECIMAL(12,2) NOT NULL,
  "ivaTotal"           DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total"              DECIMAL(12,2) NOT NULL,
  "cufe"               TEXT,
  "numeroFactura"      TEXT,
  "pdfUrl"             TEXT,
  "xmlUrl"             TEXT,
  "providerFacturaId"  TEXT,
  "providerPayload"    JSONB,
  "errorMensaje"       TEXT,
  "intentosFallidos"   INTEGER NOT NULL DEFAULT 0,
  "proximoReintentoAt" TIMESTAMP(3),
  "anuladaPor"         INTEGER,
  "anuladaAt"          TIMESTAMP(3),
  "motivoAnulacion"    TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FacturaElectronica_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FacturaElectronica_cufe_key" ON "FacturaElectronica"("cufe");
CREATE UNIQUE INDEX IF NOT EXISTS "FacturaElectronica_moduloOrigen_referenciaId_key" ON "FacturaElectronica"("moduloOrigen", "referenciaId");
CREATE INDEX IF NOT EXISTS "FacturaElectronica_comercioId_estado_idx" ON "FacturaElectronica"("comercioId", "estado");
CREATE INDEX IF NOT EXISTS "FacturaElectronica_estado_proximoReintentoAt_idx" ON "FacturaElectronica"("estado", "proximoReintentoAt");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'FacturaElectronica_comercioId_fkey'
  ) THEN
    ALTER TABLE "FacturaElectronica" ADD CONSTRAINT "FacturaElectronica_comercioId_fkey"
      FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'FacturaElectronica_compradorId_fkey'
  ) THEN
    ALTER TABLE "FacturaElectronica" ADD CONSTRAINT "FacturaElectronica_compradorId_fkey"
      FOREIGN KEY ("compradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
