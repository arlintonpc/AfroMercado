-- Validación de comerciante: RUT y Cámara de Comercio como requisito mínimo
-- para aprobar un comercio (reemplaza el modelo de dos niveles con aval
-- comunitario: en el territorio piloto la gran mayoría de comercios ya
-- tiene RUT, según validación de campo).
ALTER TABLE "Comercio" ADD COLUMN IF NOT EXISTS "rut" TEXT;
ALTER TABLE "Comercio" ADD COLUMN IF NOT EXISTS "camaraComercioNumero" TEXT;
ALTER TABLE "Comercio" ADD COLUMN IF NOT EXISTS "camaraComercioUrl" TEXT;
