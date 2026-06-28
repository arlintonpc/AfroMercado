ALTER TABLE "SolicitudPublicidad"
ADD COLUMN "pagoEstado" TEXT NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN "pagoMontoCOP" DECIMAL(12,2),
ADD COLUMN "pagoReferencia" TEXT,
ADD COLUMN "pagoProveedor" "ProveedorPago",
ADD COLUMN "pagoCheckoutUrl" TEXT,
ADD COLUMN "pagoProviderPaymentId" TEXT,
ADD COLUMN "pagoProviderReference" TEXT,
ADD COLUMN "pagoProviderStatus" TEXT,
ADD COLUMN "pagoProviderPayload" JSONB,
ADD COLUMN "pagoConfirmadoAt" TIMESTAMP(3),
ADD COLUMN "pagoExpiraAt" TIMESTAMP(3),
ADD COLUMN "pagoNotas" TEXT,
ADD COLUMN "pagoActualizadoPor" INTEGER,
ADD COLUMN "pagoActualizadoAt" TIMESTAMP(3);

UPDATE "SolicitudPublicidad"
SET "pagoMontoCOP" = "presupuestoCOP"
WHERE "pagoMontoCOP" IS NULL;

UPDATE "SolicitudPublicidad"
SET "pagoReferencia" = CONCAT('AFM-AD-', "id", '-', FLOOR(EXTRACT(EPOCH FROM "createdAt"))::bigint)
WHERE "pagoReferencia" IS NULL;

CREATE UNIQUE INDEX "SolicitudPublicidad_pagoReferencia_key"
ON "SolicitudPublicidad"("pagoReferencia");

CREATE UNIQUE INDEX "SolicitudPublicidad_pagoProviderPaymentId_key"
ON "SolicitudPublicidad"("pagoProviderPaymentId");

CREATE UNIQUE INDEX "SolicitudPublicidad_pagoProviderReference_key"
ON "SolicitudPublicidad"("pagoProviderReference");

CREATE INDEX "SolicitudPublicidad_pagoEstado_createdAt_idx"
ON "SolicitudPublicidad"("pagoEstado", "createdAt");

CREATE INDEX "SolicitudPublicidad_pagoProveedor_pagoEstado_idx"
ON "SolicitudPublicidad"("pagoProveedor", "pagoEstado");
