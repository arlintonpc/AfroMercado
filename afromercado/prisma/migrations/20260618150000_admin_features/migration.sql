-- ============================================================
--  Migración: funcionalidades admin
--  - EstadoComerciante enum + flujo de aprobación
--  - WhatsApp visible por comerciante
--  - Comisión configurable por comerciante
--  - Bloqueo de usuario con motivo
--  - Log de acciones de moderación
--  - tasaComisionAplicada en SubPedido
-- ============================================================

-- 1. Enum EstadoComerciante
CREATE TYPE "EstadoComerciante" AS ENUM ('PENDIENTE_REVISION', 'APROBADO', 'RECHAZADO', 'SUSPENDIDO');

-- 2. Campos en Comercio
ALTER TABLE "Comercio"
  ADD COLUMN "estadoRegistro"      "EstadoComerciante" NOT NULL DEFAULT 'PENDIENTE_REVISION',
  ADD COLUMN "motivoRechazo"       TEXT,
  ADD COLUMN "revisadoPor"         INTEGER,
  ADD COLUMN "revisadoAt"          TIMESTAMP(3),
  ADD COLUMN "whatsappVisible"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "whatsappAprobadoPor" INTEGER,
  ADD COLUMN "whatsappAprobadoAt"  TIMESTAMP(3);

-- Aprobar todos los comercios existentes (no bloquear a vendedores actuales)
UPDATE "Comercio" SET "estadoRegistro" = 'APROBADO';

-- 3. Campos en Usuario
ALTER TABLE "Usuario"
  ADD COLUMN "motivoBloqueo" TEXT,
  ADD COLUMN "bloqueadoPor"  INTEGER,
  ADD COLUMN "bloqueadoAt"   TIMESTAMP(3);

-- 4. tasaComisionAplicada en SubPedido
ALTER TABLE "SubPedido"
  ADD COLUMN "tasaComisionAplicada" DECIMAL(5,4);

-- 5. Tabla ComisionComercio
CREATE TABLE "ComisionComercio" (
  "id"         SERIAL PRIMARY KEY,
  "comercioId" INTEGER NOT NULL,
  "tasa"       DECIMAL(5,4) NOT NULL,
  "motivo"     TEXT,
  "desde"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "hasta"      TIMESTAMP(3),
  "creadoPor"  INTEGER NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComisionComercio_comercioId_fkey"
    FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ComisionComercio_comercioId_hasta_idx" ON "ComisionComercio"("comercioId", "hasta");

-- 6. Tabla AccionModeracion
CREATE TABLE "AccionModeracion" (
  "id"         SERIAL PRIMARY KEY,
  "adminId"    INTEGER NOT NULL,
  "targetId"   INTEGER NOT NULL,
  "targetTipo" TEXT NOT NULL,
  "accion"     TEXT NOT NULL,
  "motivo"     TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AccionModeracion_targetId_targetTipo_createdAt_idx"
  ON "AccionModeracion"("targetId", "targetTipo", "createdAt");

-- 7. Insertar tasa global por defecto en Config (si no existe)
INSERT INTO "Config" ("clave", "valor", "updatedAt")
VALUES ('comision_global', '0.10', NOW())
ON CONFLICT ("clave") DO NOTHING;

INSERT INTO "Config" ("clave", "valor", "updatedAt")
VALUES ('whatsapp_boton_activo', 'false', NOW())
ON CONFLICT ("clave") DO NOTHING;
