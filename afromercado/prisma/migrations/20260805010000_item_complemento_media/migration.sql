-- Completa columnas usadas por el gestor de complementos Express.
-- Algunas bases pudieron crear ItemComplemento con la migracion inicial,
-- antes de que el modelo incluyera icono e imagenUrl.

ALTER TABLE "ItemComplemento" ADD COLUMN IF NOT EXISTS "icono" TEXT;
ALTER TABLE "ItemComplemento" ADD COLUMN IF NOT EXISTS "imagenUrl" TEXT;
