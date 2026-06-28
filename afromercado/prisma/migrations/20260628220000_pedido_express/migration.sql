-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ModalidadExpress" AS ENUM ('DOMICILIO', 'RECOGER', 'MESA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EstadoPedidoExpress" AS ENUM ('PENDIENTE', 'ACEPTADO', 'EN_PREPARACION', 'LISTO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO', 'RECHAZADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MetodoPagoExpress" AS ENUM ('EFECTIVO', 'NEQUI', 'WOMPI');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable ConfigExpress
CREATE TABLE IF NOT EXISTS "ConfigExpress" (
  "id"                     SERIAL NOT NULL,
  "comercioId"             INTEGER NOT NULL,
  "activo"                 BOOLEAN NOT NULL DEFAULT false,
  "abierto"                BOOLEAN NOT NULL DEFAULT false,
  "horarioApertura"        TEXT,
  "horarioCierre"          TEXT,
  "tiempoPrepMinutos"      INTEGER NOT NULL DEFAULT 20,
  "municipiosEntrega"      TEXT[] DEFAULT ARRAY[]::TEXT[],
  "modalidades"            "ModalidadExpress"[] DEFAULT ARRAY[]::"ModalidadExpress"[],
  "costoEnvioBase"         DECIMAL(10,2) NOT NULL DEFAULT 3000,
  "limiteCreditoEfectivo"  DECIMAL(10,2) NOT NULL DEFAULT 30000,
  "deudaEfectivoActual"    DECIMAL(10,2) NOT NULL DEFAULT 0,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConfigExpress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConfigExpress_comercioId_key" ON "ConfigExpress"("comercioId");
CREATE INDEX IF NOT EXISTS "ConfigExpress_activo_abierto_idx" ON "ConfigExpress"("activo", "abierto");

DO $$ BEGIN
  ALTER TABLE "ConfigExpress" ADD CONSTRAINT "ConfigExpress_comercioId_fkey"
    FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable PedidoExpress
CREATE TABLE IF NOT EXISTS "PedidoExpress" (
  "id"                SERIAL NOT NULL,
  "codigo"            TEXT NOT NULL,
  "comercioId"        INTEGER NOT NULL,
  "clienteId"         INTEGER NOT NULL,
  "repartidorId"      INTEGER,
  "configExpressId"   INTEGER NOT NULL,
  "modalidad"         "ModalidadExpress" NOT NULL,
  "estado"            "EstadoPedidoExpress" NOT NULL DEFAULT 'PENDIENTE',
  "metodoPago"        "MetodoPagoExpress" NOT NULL,
  "pagoConfirmado"    BOOLEAN NOT NULL DEFAULT false,
  "subtotal"          DECIMAL(12,2) NOT NULL,
  "costoEnvio"        DECIMAL(12,2) NOT NULL DEFAULT 0,
  "comision"          DECIMAL(12,2) NOT NULL,
  "total"             DECIMAL(12,2) NOT NULL,
  "direccionTexto"    TEXT,
  "municipioEntrega"  TEXT,
  "notaCliente"       TEXT,
  "motivoCancelacion" TEXT,
  "tiempoEstimadoMin" INTEGER NOT NULL DEFAULT 30,
  "tiempoAjustadoMin" INTEGER,
  "creadoAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "aceptadoAt"        TIMESTAMP(3),
  "preparandoAt"      TIMESTAMP(3),
  "listoAt"           TIMESTAMP(3),
  "enCaminoAt"        TIMESTAMP(3),
  "entregadoAt"       TIMESTAMP(3),
  "canceladoAt"       TIMESTAMP(3),
  "expiresAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PedidoExpress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PedidoExpress_codigo_key" ON "PedidoExpress"("codigo");
CREATE INDEX IF NOT EXISTS "PedidoExpress_comercioId_estado_idx" ON "PedidoExpress"("comercioId", "estado");
CREATE INDEX IF NOT EXISTS "PedidoExpress_clienteId_estado_idx"  ON "PedidoExpress"("clienteId",  "estado");
CREATE INDEX IF NOT EXISTS "PedidoExpress_estado_creadoAt_idx"   ON "PedidoExpress"("estado",     "creadoAt");

DO $$ BEGIN
  ALTER TABLE "PedidoExpress" ADD CONSTRAINT "PedidoExpress_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PedidoExpress" ADD CONSTRAINT "PedidoExpress_repartidorId_fkey"
    FOREIGN KEY ("repartidorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PedidoExpress" ADD CONSTRAINT "PedidoExpress_configExpressId_fkey"
    FOREIGN KEY ("configExpressId") REFERENCES "ConfigExpress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable ItemPedidoExpress
CREATE TABLE IF NOT EXISTS "ItemPedidoExpress" (
  "id"              SERIAL NOT NULL,
  "pedidoExpressId" INTEGER NOT NULL,
  "productoId"      INTEGER NOT NULL,
  "cantidad"        INTEGER NOT NULL,
  "precioUnitario"  DECIMAL(12,2) NOT NULL,
  "subtotal"        DECIMAL(12,2) NOT NULL,
  "nota"            TEXT,
  CONSTRAINT "ItemPedidoExpress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ItemPedidoExpress_pedidoExpressId_idx" ON "ItemPedidoExpress"("pedidoExpressId");

DO $$ BEGIN
  ALTER TABLE "ItemPedidoExpress" ADD CONSTRAINT "ItemPedidoExpress_pedidoExpressId_fkey"
    FOREIGN KEY ("pedidoExpressId") REFERENCES "PedidoExpress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ItemPedidoExpress" ADD CONSTRAINT "ItemPedidoExpress_productoId_fkey"
    FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
