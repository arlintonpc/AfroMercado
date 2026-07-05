-- Adjuntar CV en PDF a la hoja de vida, y snapshot de foto+CV en la postulacion
-- (la foto reutiliza Usuario.avatarUrl, ya existente, en vez de duplicarlo).

ALTER TABLE "HojaDeVida" ADD COLUMN IF NOT EXISTS "cvUrl" TEXT;
ALTER TABLE "PostulacionEmpleo" ADD COLUMN IF NOT EXISTS "fotoSnapUrl" TEXT;
ALTER TABLE "PostulacionEmpleo" ADD COLUMN IF NOT EXISTS "cvSnapUrl" TEXT;
