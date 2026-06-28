ALTER TABLE "Producto"
  ADD COLUMN IF NOT EXISTS "esExpress"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "tiempoEntregaMin" INTEGER;

CREATE INDEX IF NOT EXISTS "Producto_esExpress_activo_idx" ON "Producto"("esExpress", "activo");
