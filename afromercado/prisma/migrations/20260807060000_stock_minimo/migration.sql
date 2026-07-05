-- Alertas de stock bajo (Fase 5.3). stockBajoNotificadoAt evita re-notificar
-- en cada venta mientras el stock siga bajo; se resetea a NULL cuando se
-- repone stock por encima del minimo (ver producto.service.js).

ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "stockMinimo" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "stockBajoNotificadoAt" TIMESTAMP(3);
