-- Galería: varias imágenes por producto. Idempotente.
ALTER TABLE "Producto"
  ADD COLUMN IF NOT EXISTS "imagenes" TEXT[] NOT NULL DEFAULT '{}';
