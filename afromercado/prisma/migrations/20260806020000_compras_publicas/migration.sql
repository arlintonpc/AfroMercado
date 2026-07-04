-- Directorio de proveedores certificados para compra publica B2G (Modulo C)
ALTER TABLE "Comercio" ADD COLUMN IF NOT EXISTS "disponibleComprasPublicas" BOOLEAN NOT NULL DEFAULT false;
