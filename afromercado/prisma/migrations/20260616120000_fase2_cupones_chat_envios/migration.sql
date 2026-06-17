-- AlterTable Usuario: avatarUrl
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

-- AlterTable Pedido: cupon fields
ALTER TABLE "Pedido" ADD COLUMN IF NOT EXISTS "cuponId" INTEGER;
ALTER TABLE "Pedido" ADD COLUMN IF NOT EXISTS "cuponDescuento" DECIMAL(12,2);

-- CreateTable Cupon
CREATE TABLE IF NOT EXISTS "Cupon" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoOferta" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "minimoCompra" DECIMAL(12,2),
    "usosMaximos" INTEGER,
    "usosActuales" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "soloNuevos" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable CuponUso
CREATE TABLE IF NOT EXISTS "CuponUso" (
    "id" SERIAL NOT NULL,
    "cuponId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuponUso_pkey" PRIMARY KEY ("id")
);

-- CreateTable Conversacion
CREATE TABLE IF NOT EXISTS "Conversacion" (
    "id" SERIAL NOT NULL,
    "compradorId" INTEGER NOT NULL,
    "comercioId" INTEGER NOT NULL,
    "ultimoMensAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable Mensaje
CREATE TABLE IF NOT EXISTS "Mensaje" (
    "id" SERIAL NOT NULL,
    "conversacionId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "contenido" TEXT NOT NULL,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable TarifaEnvio
CREATE TABLE IF NOT EXISTS "TarifaEnvio" (
    "id" SERIAL NOT NULL,
    "departamento" TEXT NOT NULL,
    "pesoMaxKg" DECIMAL(6,2) NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TarifaEnvio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex Cupon
CREATE UNIQUE INDEX IF NOT EXISTS "Cupon_codigo_key" ON "Cupon"("codigo");
CREATE INDEX IF NOT EXISTS "Cupon_codigo_activo_idx" ON "Cupon"("codigo", "activo");
CREATE INDEX IF NOT EXISTS "Cupon_activo_fin_idx" ON "Cupon"("activo", "fin");

-- CreateIndex CuponUso
CREATE UNIQUE INDEX IF NOT EXISTS "CuponUso_pedidoId_key" ON "CuponUso"("pedidoId");
CREATE INDEX IF NOT EXISTS "CuponUso_cuponId_usuarioId_idx" ON "CuponUso"("cuponId", "usuarioId");

-- CreateIndex Conversacion
CREATE UNIQUE INDEX IF NOT EXISTS "Conversacion_compradorId_comercioId_key" ON "Conversacion"("compradorId", "comercioId");
CREATE INDEX IF NOT EXISTS "Conversacion_compradorId_ultimoMensAt_idx" ON "Conversacion"("compradorId", "ultimoMensAt");
CREATE INDEX IF NOT EXISTS "Conversacion_comercioId_ultimoMensAt_idx" ON "Conversacion"("comercioId", "ultimoMensAt");

-- CreateIndex Mensaje
CREATE INDEX IF NOT EXISTS "Mensaje_conversacionId_createdAt_idx" ON "Mensaje"("conversacionId", "createdAt");
CREATE INDEX IF NOT EXISTS "Mensaje_autorId_idx" ON "Mensaje"("autorId");

-- CreateIndex TarifaEnvio
CREATE UNIQUE INDEX IF NOT EXISTS "TarifaEnvio_departamento_pesoMaxKg_key" ON "TarifaEnvio"("departamento", "pesoMaxKg");
CREATE INDEX IF NOT EXISTS "TarifaEnvio_departamento_activa_idx" ON "TarifaEnvio"("departamento", "activa");

-- AddForeignKey Cupon ← Pedido
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_cuponId_fkey"
    FOREIGN KEY ("cuponId") REFERENCES "Cupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey CuponUso
ALTER TABLE "CuponUso" ADD CONSTRAINT "CuponUso_cuponId_fkey"
    FOREIGN KEY ("cuponId") REFERENCES "Cupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CuponUso" ADD CONSTRAINT "CuponUso_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CuponUso" ADD CONSTRAINT "CuponUso_pedidoId_fkey"
    FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey Conversacion
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_compradorId_fkey"
    FOREIGN KEY ("compradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_comercioId_fkey"
    FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey Mensaje
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_conversacionId_fkey"
    FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_autorId_fkey"
    FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed TarifaEnvio — tabla base de tarifas de envío
INSERT INTO "TarifaEnvio" ("departamento", "pesoMaxKg", "precio")
VALUES
  ('Chocó', 1.00, 5000), ('Chocó', 5.00, 10000), ('Chocó', 10.00, 18000), ('Chocó', 20.00, 30000),
  ('Antioquia', 1.00, 8000), ('Antioquia', 5.00, 14000), ('Antioquia', 10.00, 22000), ('Antioquia', 20.00, 38000),
  ('Valle del Cauca', 1.00, 9000), ('Valle del Cauca', 5.00, 15000), ('Valle del Cauca', 10.00, 24000), ('Valle del Cauca', 20.00, 40000),
  ('Cundinamarca', 1.00, 10000), ('Cundinamarca', 5.00, 18000), ('Cundinamarca', 10.00, 28000), ('Cundinamarca', 20.00, 45000),
  ('Bogotá D.C.', 1.00, 10000), ('Bogotá D.C.', 5.00, 18000), ('Bogotá D.C.', 10.00, 28000), ('Bogotá D.C.', 20.00, 45000),
  ('Nacional', 1.00, 12000), ('Nacional', 5.00, 20000), ('Nacional', 10.00, 32000), ('Nacional', 20.00, 55000)
ON CONFLICT DO NOTHING;
