-- Agrega el campo de video a CampanaHero: hasta ahora las solicitudes de
-- publicidad VIDEO_HISTORIA aprobadas y con video revisado editorialmente
-- (SolicitudPublicidad.videoUrl/videoAprobado) se convertian en una campana
-- viva que solo mostraba imagen, descartando el video pagado.

ALTER TABLE "CampanaHero" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;
