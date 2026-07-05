-- El panel del empleador no mostraba resumen de perfil ni disponibilidad
-- porque nunca se snapshoteaban en la postulacion (solo experiencia/educacion/
-- habilidades). Se agregan para completar la vista de hoja de vida del reclutador.

ALTER TABLE "PostulacionEmpleo" ADD COLUMN IF NOT EXISTS "resumenPerfilSnap" TEXT;
ALTER TABLE "PostulacionEmpleo" ADD COLUMN IF NOT EXISTS "disponibilidadSnap" TEXT;
