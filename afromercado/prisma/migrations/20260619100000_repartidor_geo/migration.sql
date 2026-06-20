-- Zona de cobertura geográfica para repartidores
ALTER TABLE "SolicitudRepartidor"
  ADD COLUMN IF NOT EXISTS "municipioBase"   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "municipiosExtra" TEXT[] NOT NULL DEFAULT '{}';
