CREATE TYPE "TipoLiquidacion"    AS ENUM ('COMERCIANTE', 'REPARTIDOR');
CREATE TYPE "EstadoLiquidacion" AS ENUM ('PENDIENTE', 'PAGADA');

CREATE TABLE "Liquidacion" (
    "id"             SERIAL              PRIMARY KEY,
    "tipo"           "TipoLiquidacion"   NOT NULL,
    "beneficiarioId" INTEGER             NOT NULL,
    "monto"          DECIMAL(10,2)       NOT NULL,
    "estado"         "EstadoLiquidacion" NOT NULL DEFAULT 'PENDIENTE',
    "periodoDesde"   TIMESTAMP(3)        NOT NULL,
    "periodoHasta"   TIMESTAMP(3)        NOT NULL,
    "cuentaDestino"  TEXT,
    "comprobante"    TEXT,
    "notas"          TEXT,
    "creadoPor"      INTEGER             NOT NULL,
    "pagadoPor"      INTEGER,
    "pagadoAt"       TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)        NOT NULL,

    CONSTRAINT "Liquidacion_beneficiarioId_fkey"
      FOREIGN KEY ("beneficiarioId") REFERENCES "Usuario"("id") ON UPDATE CASCADE,
    CONSTRAINT "Liquidacion_creadoPor_fkey"
      FOREIGN KEY ("creadoPor")      REFERENCES "Usuario"("id") ON UPDATE CASCADE,
    CONSTRAINT "Liquidacion_pagadoPor_fkey"
      FOREIGN KEY ("pagadoPor")      REFERENCES "Usuario"("id") ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX "Liquidacion_beneficiarioId_estado_idx" ON "Liquidacion"("beneficiarioId", "estado");
CREATE INDEX "Liquidacion_tipo_estado_createdAt_idx"  ON "Liquidacion"("tipo", "estado", "createdAt");
