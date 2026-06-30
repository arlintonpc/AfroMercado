-- Sprint 1: política de pagos configurable y cancelación con penalización

ALTER TABLE "ConfigHotel"
  ADD COLUMN IF NOT EXISTS "permitePagarAlLlegar"   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "permiteDeposito30"       BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "permiteTotal"            BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "horasLibresCancelacion"  INTEGER NOT NULL DEFAULT 48,
  ADD COLUMN IF NOT EXISTS "pctPenalidadCancelacion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ReservaHotel"
  ADD COLUMN IF NOT EXISTS "montoDescuento"  DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "montoPenalidad"  DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "montoReembolso"  DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "codigoCupon"     TEXT;
