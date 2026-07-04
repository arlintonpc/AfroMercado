-- Modulo E: Programas y Subsidios con Trazabilidad
-- Agrupa cupones de un mismo programa de subsidio (ej. "Semillas 2026").
ALTER TABLE "Cupon"
  ADD COLUMN IF NOT EXISTS "programaNombre" TEXT;
