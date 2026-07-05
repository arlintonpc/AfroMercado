-- IVA configurable por comercio (Fase 1.1). Apagado por defecto; solo ADMIN
-- lo activa via ConfigFiscalComercio. Empieza por el modulo Pedido (marketplace);
-- Express/Hotel/Tour/Transporte/Cultura reciben su propio campo "iva" en una
-- migracion separada cuando se cablee cada uno.

CREATE TABLE IF NOT EXISTS "ConfigFiscalComercio" (
  "id"                SERIAL NOT NULL,
  "comercioId"        INTEGER NOT NULL,
  "ivaActivo"         BOOLEAN NOT NULL DEFAULT false,
  "ivaPorcentaje"     DECIMAL(5,2) NOT NULL DEFAULT 19.00,
  "regimenTributario" TEXT,
  "activadoPor"       INTEGER,
  "activadoAt"        TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ConfigFiscalComercio_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConfigFiscalComercio_comercioId_key" ON "ConfigFiscalComercio"("comercioId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ConfigFiscalComercio_comercioId_fkey'
  ) THEN
    ALTER TABLE "ConfigFiscalComercio" ADD CONSTRAINT "ConfigFiscalComercio_comercioId_fkey"
      FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Pedido" ADD COLUMN IF NOT EXISTS "ivaTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "SubPedido" ADD COLUMN IF NOT EXISTS "iva" DECIMAL(12,2) NOT NULL DEFAULT 0;
