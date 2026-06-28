DO $$ BEGIN
  CREATE TYPE "ProveedorPago" AS ENUM ('SANDBOX', 'WOMPI', 'PAYU', 'EPAYCO', 'MERCADOPAGO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TipoCuentaDispersion" AS ENUM ('AHORROS', 'CORRIENTE', 'BILLETERA_DIGITAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EstadoCuentaDispersion" AS ENUM ('PENDIENTE_VERIFICACION', 'VERIFICADA', 'RECHAZADA', 'SUSPENDIDA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EstadoDispersionPago" AS ENUM ('PENDIENTE', 'PROGRAMADA', 'ENVIADA', 'CONFIRMADA', 'FALLIDA', 'CANCELADA', 'REVERTIDA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "MetodoPago" ADD VALUE IF NOT EXISTS 'PASARELA';

ALTER TABLE "Pago"
  ADD COLUMN IF NOT EXISTS "proveedor" "ProveedorPago",
  ADD COLUMN IF NOT EXISTS "moneda" TEXT NOT NULL DEFAULT 'COP',
  ADD COLUMN IF NOT EXISTS "providerPaymentId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerCheckoutUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "providerReference" TEXT,
  ADD COLUMN IF NOT EXISTS "providerStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "providerPayload" JSONB,
  ADD COLUMN IF NOT EXISTS "confirmadoAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expiraAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "CuentaDispersionComercio" (
  "id" SERIAL NOT NULL,
  "comercioId" INTEGER NOT NULL,
  "proveedor" "ProveedorPago" NOT NULL DEFAULT 'SANDBOX',
  "estado" "EstadoCuentaDispersion" NOT NULL DEFAULT 'PENDIENTE_VERIFICACION',
  "providerRecipientId" TEXT,
  "titularNombre" TEXT NOT NULL,
  "tipoDocumento" "TipoDocumento" NOT NULL,
  "numeroDocumento" TEXT NOT NULL,
  "bancoCodigo" TEXT NOT NULL,
  "bancoNombre" TEXT NOT NULL,
  "tipoCuenta" "TipoCuentaDispersion" NOT NULL,
  "numeroCuentaUltimos4" TEXT NOT NULL,
  "numeroCuentaHash" TEXT NOT NULL,
  "emailNotificacion" TEXT,
  "telefonoNotificacion" TEXT,
  "motivoRechazo" TEXT,
  "verificadaAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CuentaDispersionComercio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PagoEvento" (
  "id" SERIAL NOT NULL,
  "pagoId" INTEGER,
  "proveedor" "ProveedorPago" NOT NULL,
  "eventoId" TEXT,
  "tipo" TEXT NOT NULL,
  "estado" TEXT,
  "payload" JSONB NOT NULL,
  "firma" TEXT,
  "procesado" BOOLEAN NOT NULL DEFAULT false,
  "errorMensaje" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "PagoEvento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PagoDispersion" (
  "id" SERIAL NOT NULL,
  "pagoId" INTEGER NOT NULL,
  "subPedidoId" INTEGER NOT NULL,
  "comercioId" INTEGER NOT NULL,
  "cuentaDispersionId" INTEGER NOT NULL,
  "proveedor" "ProveedorPago" NOT NULL,
  "estado" "EstadoDispersionPago" NOT NULL DEFAULT 'PENDIENTE',
  "montoBruto" DECIMAL(12,2) NOT NULL,
  "comision" DECIMAL(12,2) NOT NULL,
  "montoNeto" DECIMAL(12,2) NOT NULL,
  "providerTransferId" TEXT,
  "providerStatus" TEXT,
  "errorMensaje" TEXT,
  "programadaAt" TIMESTAMP(3),
  "enviadaAt" TIMESTAMP(3),
  "confirmadaAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PagoDispersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Pago_providerPaymentId_key" ON "Pago"("providerPaymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "Pago_providerReference_key" ON "Pago"("providerReference");

CREATE UNIQUE INDEX IF NOT EXISTS "CuentaDispersionComercio_comercioId_key" ON "CuentaDispersionComercio"("comercioId");
CREATE UNIQUE INDEX IF NOT EXISTS "CuentaDispersionComercio_providerRecipientId_key" ON "CuentaDispersionComercio"("providerRecipientId");
CREATE INDEX IF NOT EXISTS "CuentaDispersionComercio_estado_idx" ON "CuentaDispersionComercio"("estado");
CREATE INDEX IF NOT EXISTS "CuentaDispersionComercio_proveedor_providerRecipientId_idx" ON "CuentaDispersionComercio"("proveedor", "providerRecipientId");

CREATE UNIQUE INDEX IF NOT EXISTS "PagoEvento_proveedor_eventoId_key" ON "PagoEvento"("proveedor", "eventoId");
CREATE INDEX IF NOT EXISTS "PagoEvento_pagoId_createdAt_idx" ON "PagoEvento"("pagoId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "PagoDispersion_subPedidoId_key" ON "PagoDispersion"("subPedidoId");
CREATE UNIQUE INDEX IF NOT EXISTS "PagoDispersion_providerTransferId_key" ON "PagoDispersion"("providerTransferId");
CREATE INDEX IF NOT EXISTS "PagoDispersion_comercioId_estado_idx" ON "PagoDispersion"("comercioId", "estado");
CREATE INDEX IF NOT EXISTS "PagoDispersion_pagoId_estado_idx" ON "PagoDispersion"("pagoId", "estado");

DO $$ BEGIN
  ALTER TABLE "CuentaDispersionComercio"
    ADD CONSTRAINT "CuentaDispersionComercio_comercioId_fkey"
    FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PagoEvento"
    ADD CONSTRAINT "PagoEvento_pagoId_fkey"
    FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PagoDispersion"
    ADD CONSTRAINT "PagoDispersion_pagoId_fkey"
    FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PagoDispersion"
    ADD CONSTRAINT "PagoDispersion_subPedidoId_fkey"
    FOREIGN KEY ("subPedidoId") REFERENCES "SubPedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PagoDispersion"
    ADD CONSTRAINT "PagoDispersion_comercioId_fkey"
    FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PagoDispersion"
    ADD CONSTRAINT "PagoDispersion_cuentaDispersionId_fkey"
    FOREIGN KEY ("cuentaDispersionId") REFERENCES "CuentaDispersionComercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
