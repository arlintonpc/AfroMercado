-- AlterTable
ALTER TABLE "Producto"
  ADD COLUMN IF NOT EXISTS "pesoKg" DECIMAL(6,2);
