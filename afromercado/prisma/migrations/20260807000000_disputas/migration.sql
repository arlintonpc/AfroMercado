-- Sistema de reclamos/disputas post-compra (Fase 1: reporte + mediacion,
-- sin reversa automatica de pago -- ver comentario en schema.prisma).

DO $$ BEGIN
  CREATE TYPE "EstadoDisputa" AS ENUM (
    'ABIERTA', 'RESPONDIDA_COMERCIO', 'RESUELTA_RECHAZADA',
    'RESUELTA_REEMBOLSO_TOTAL', 'RESUELTA_REEMBOLSO_PARCIAL', 'CERRADA_SIN_RESPUESTA'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MotivoDisputa" AS ENUM (
    'PRODUCTO_NO_LLEGO', 'PRODUCTO_DEFECTUOSO_O_DANADO', 'PRODUCTO_INCOMPLETO',
    'PRODUCTO_DIFERENTE_AL_PEDIDO', 'CALIDAD_NO_CONFORME', 'SERVICIO_NO_PRESTADO',
    'COBRO_INCORRECTO', 'OTRO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Disputa" (
  "id" SERIAL NOT NULL,
  "moduloOrigen" TEXT NOT NULL,
  "referenciaId" INTEGER NOT NULL,
  "compradorId" INTEGER NOT NULL,
  "comercioId" INTEGER NOT NULL,
  "motivo" "MotivoDisputa" NOT NULL,
  "descripcion" TEXT NOT NULL,
  "evidenciaUrls" TEXT[] NOT NULL DEFAULT '{}',
  "montoOriginal" DECIMAL(12,2) NOT NULL,
  "montoNetoOriginal" DECIMAL(12,2) NOT NULL,
  "montoReembolsoSolicitado" DECIMAL(12,2),
  "estado" "EstadoDisputa" NOT NULL DEFAULT 'ABIERTA',
  "respuestaComercio" TEXT,
  "respuestaComercioUrls" TEXT[] NOT NULL DEFAULT '{}',
  "respondidoPor" INTEGER,
  "respondidoAt" TIMESTAMP(3),
  "resolucion" TEXT,
  "montoReembolsoAprobado" DECIMAL(12,2),
  "montoDescuentoComercio" DECIMAL(12,2),
  "resueltoPor" INTEGER,
  "resueltoAt" TIMESTAMP(3),
  "notaCreditoAplicada" BOOLEAN NOT NULL DEFAULT false,
  "notaCreditoLiquidacionId" INTEGER,
  "reembolsoTransferidoAt" TIMESTAMP(3),
  "reembolsoTransferidoPor" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Disputa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Disputa_moduloOrigen_referenciaId_idx" ON "Disputa"("moduloOrigen", "referenciaId");
CREATE INDEX IF NOT EXISTS "Disputa_comercioId_estado_idx" ON "Disputa"("comercioId", "estado");
CREATE INDEX IF NOT EXISTS "Disputa_compradorId_createdAt_idx" ON "Disputa"("compradorId", "createdAt");
CREATE INDEX IF NOT EXISTS "Disputa_estado_createdAt_idx" ON "Disputa"("estado", "createdAt");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Disputa_compradorId_fkey'
  ) THEN
    ALTER TABLE "Disputa" ADD CONSTRAINT "Disputa_compradorId_fkey"
      FOREIGN KEY ("compradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Disputa_comercioId_fkey'
  ) THEN
    ALTER TABLE "Disputa" ADD CONSTRAINT "Disputa_comercioId_fkey"
      FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
