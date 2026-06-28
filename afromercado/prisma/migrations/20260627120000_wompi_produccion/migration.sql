-- Campos seguros para operar dispersion real con proveedor productivo.
-- El numero completo de cuenta se guarda cifrado, nunca en claro.
ALTER TABLE "CuentaDispersionComercio"
ADD COLUMN "numeroCuentaCifrado" TEXT,
ADD COLUMN "providerBankId" TEXT,
ADD COLUMN "providerPayload" JSONB;

CREATE INDEX "CuentaDispersionComercio_providerBankId_idx"
ON "CuentaDispersionComercio"("providerBankId");
