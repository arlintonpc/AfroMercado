-- Imagen tipo banner opcional por vacante (rediseño de Empleo)
ALTER TABLE "OfertaEmpleo" ADD COLUMN IF NOT EXISTS "imagenUrl" TEXT;
