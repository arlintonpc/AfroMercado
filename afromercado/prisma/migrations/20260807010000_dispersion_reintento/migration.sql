-- Reintento de dispersiones fallidas (hallazgo del test de pago-digital.service.js):
-- hoy, si ejecutarDispersiones() falla, el pago/pedido ya quedan CONFIRMADO y no hay
-- ningun mecanismo que reintente -- solo una nota de texto libre. Estos campos permiten
-- que un job periodico identifique y reintente dispersiones FALLIDA con backoff.

ALTER TABLE "PagoDispersion" ADD COLUMN IF NOT EXISTS "intentosFallidos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PagoDispersion" ADD COLUMN IF NOT EXISTS "proximoReintentoAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "PagoDispersion_estado_proximoReintentoAt_idx" ON "PagoDispersion"("estado", "proximoReintentoAt");
