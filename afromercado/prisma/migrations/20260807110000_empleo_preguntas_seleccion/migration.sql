-- Preguntas de seleccion por oferta (texto libre, si/no, opcion multiple),
-- y snapshot de las respuestas en cada postulacion.

ALTER TABLE "OfertaEmpleo" ADD COLUMN IF NOT EXISTS "preguntas" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "PostulacionEmpleo" ADD COLUMN IF NOT EXISTS "respuestas" JSONB NOT NULL DEFAULT '[]';
