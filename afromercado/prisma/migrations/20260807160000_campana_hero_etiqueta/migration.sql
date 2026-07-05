-- Agrega el texto del badge (etiqueta) a CampanaHero: hasta ahora el badge
-- "Patrocinado" (Irruptor) y "Comunidad"/"Publicidad" (HeroBanner) eran textos
-- fijos en el componente. Ahora es personalizable por campaña.

ALTER TABLE "CampanaHero" ADD COLUMN IF NOT EXISTS "etiqueta" TEXT NOT NULL DEFAULT 'Patrocinado';
