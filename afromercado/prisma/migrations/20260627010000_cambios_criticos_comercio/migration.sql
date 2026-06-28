CREATE TABLE "CambioCriticoComercio" (
  "id" SERIAL NOT NULL,
  "comercioId" INTEGER NOT NULL,
  "tipo" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "accion" TEXT NOT NULL,
  "snapshotAnterior" JSONB NOT NULL,
  "snapshotNuevo" JSONB NOT NULL,
  "solicitadoPor" INTEGER,
  "revisadoPor" INTEGER,
  "motivo" TEXT,
  "productosDesactivados" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revisadoAt" TIMESTAMP(3),

  CONSTRAINT "CambioCriticoComercio_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CambioCriticoComercio_comercioId_estado_createdAt_idx"
  ON "CambioCriticoComercio"("comercioId", "estado", "createdAt");

CREATE INDEX "CambioCriticoComercio_estado_createdAt_idx"
  ON "CambioCriticoComercio"("estado", "createdAt");

ALTER TABLE "CambioCriticoComercio"
  ADD CONSTRAINT "CambioCriticoComercio_comercioId_fkey"
  FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
