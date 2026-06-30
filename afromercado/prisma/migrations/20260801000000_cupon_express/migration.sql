-- CreateTable CuponExpress
CREATE TABLE IF NOT EXISTS "CuponExpress" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'PORCENTAJE',
    "valor" DECIMAL(10,2) NOT NULL,
    "minimoSubtotal" DECIMAL(10,2),
    "usosMaximos" INTEGER,
    "usosActuales" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "configExpressId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CuponExpress_pkey" PRIMARY KEY ("id")
);

-- CreateTable CuponExpressUso
CREATE TABLE IF NOT EXISTS "CuponExpressUso" (
    "id" SERIAL NOT NULL,
    "cuponExpressId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "pedidoExpressId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CuponExpressUso_pkey" PRIMARY KEY ("id")
);

-- AlterTable PedidoExpress
ALTER TABLE "PedidoExpress" ADD COLUMN IF NOT EXISTS "montoDescuento" DECIMAL(10,2);
ALTER TABLE "PedidoExpress" ADD COLUMN IF NOT EXISTS "codigoCupon" TEXT;

-- Unique & Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "CuponExpress_codigo_key" ON "CuponExpress"("codigo");
CREATE UNIQUE INDEX IF NOT EXISTS "CuponExpressUso_pedidoExpressId_key" ON "CuponExpressUso"("pedidoExpressId");
CREATE INDEX IF NOT EXISTS "CuponExpress_codigo_activo_idx" ON "CuponExpress"("codigo", "activo");
CREATE INDEX IF NOT EXISTS "CuponExpress_activo_fin_idx" ON "CuponExpress"("activo", "fin");
CREATE INDEX IF NOT EXISTS "CuponExpress_configExpressId_idx" ON "CuponExpress"("configExpressId");
CREATE INDEX IF NOT EXISTS "CuponExpressUso_cuponExpressId_clienteId_idx" ON "CuponExpressUso"("cuponExpressId", "clienteId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CuponExpress_configExpressId_fkey'
  ) THEN
    ALTER TABLE "CuponExpress" ADD CONSTRAINT "CuponExpress_configExpressId_fkey"
      FOREIGN KEY ("configExpressId") REFERENCES "ConfigExpress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CuponExpressUso_cuponExpressId_fkey'
  ) THEN
    ALTER TABLE "CuponExpressUso" ADD CONSTRAINT "CuponExpressUso_cuponExpressId_fkey"
      FOREIGN KEY ("cuponExpressId") REFERENCES "CuponExpress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CuponExpressUso_clienteId_fkey'
  ) THEN
    ALTER TABLE "CuponExpressUso" ADD CONSTRAINT "CuponExpressUso_clienteId_fkey"
      FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CuponExpressUso_pedidoExpressId_fkey'
  ) THEN
    ALTER TABLE "CuponExpressUso" ADD CONSTRAINT "CuponExpressUso_pedidoExpressId_fkey"
      FOREIGN KEY ("pedidoExpressId") REFERENCES "PedidoExpress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
