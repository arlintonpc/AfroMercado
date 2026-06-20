-- Agregar municipio al perfil del usuario
ALTER TABLE "Usuario"
  ADD COLUMN IF NOT EXISTS "municipio" TEXT;
