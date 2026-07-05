-- Mejoras al modulo Empleo: retirar postulacion, cierre automatico por
-- vacantes llenas y fecha limite de postulacion (fechaCierre ya existia
-- en el modelo pero no se usaba).

-- ALTER TYPE ... ADD VALUE no puede ejecutarse dentro de un bloque DO/transaccion
-- explicita; se usa la sintaxis nativa IF NOT EXISTS (soportada desde PG 9.6)
-- como sentencia suelta para que sea idempotente sin necesitar DO/EXCEPTION.
ALTER TYPE "EstadoPostulacionEmpleo" ADD VALUE IF NOT EXISTS 'RETIRADA';
