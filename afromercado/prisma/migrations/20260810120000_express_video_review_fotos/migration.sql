-- Rediseño de Express: video de la tienda (columnas faltantes que ya usaba el
-- codigo) + fotos en reseñas de Express (mismo patron que ReviewCultura)
ALTER TABLE "ConfigExpress" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;
ALTER TABLE "ConfigExpress" ADD COLUMN IF NOT EXISTS "videoPosterUrl" TEXT;
ALTER TABLE "ReviewExpress" ADD COLUMN IF NOT EXISTS "fotoUrls" TEXT[] NOT NULL DEFAULT '{}';
