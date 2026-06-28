-- Campos editoriales para paquete VIDEO_HISTORIA en SolicitudPublicidad
ALTER TABLE "SolicitudPublicidad"
ADD COLUMN IF NOT EXISTS "videoUrl"           TEXT,
ADD COLUMN IF NOT EXISTS "videoPortadaUrl"    TEXT,
ADD COLUMN IF NOT EXISTS "videoTexto"         TEXT,
ADD COLUMN IF NOT EXISTS "videoUbicacion"     TEXT,
ADD COLUMN IF NOT EXISTS "videoDestino"       TEXT,
ADD COLUMN IF NOT EXISTS "videoNotasComercio" TEXT,
ADD COLUMN IF NOT EXISTS "videoAprobado"      BOOLEAN,
ADD COLUMN IF NOT EXISTS "videoNotasRevision" TEXT,
ADD COLUMN IF NOT EXISTS "videoRevisadoPor"   INTEGER,
ADD COLUMN IF NOT EXISTS "videoRevisadoAt"    TIMESTAMP(3);

-- Tabla de auditoría de operaciones en AfroMedia
CREATE TABLE IF NOT EXISTS "AuditoriaAfroMedia" (
  "id"        SERIAL PRIMARY KEY,
  "tipo"      TEXT NOT NULL,
  "entidad"   TEXT NOT NULL,
  "entidadId" INTEGER,
  "usuarioId" INTEGER,
  "datos"     JSONB,
  "ip"        TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AuditoriaAfroMedia_tipo_createdAt_idx"
  ON "AuditoriaAfroMedia"("tipo", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditoriaAfroMedia_entidad_entidadId_createdAt_idx"
  ON "AuditoriaAfroMedia"("entidad", "entidadId", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditoriaAfroMedia_usuarioId_createdAt_idx"
  ON "AuditoriaAfroMedia"("usuarioId", "createdAt");
