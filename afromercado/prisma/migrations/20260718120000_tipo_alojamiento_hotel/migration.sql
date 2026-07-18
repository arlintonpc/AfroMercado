-- Módulo Hotel: permite publicar categorías de alojamiento distintas a
-- "habitación de hotel" (cabaña, apartamento, casa completa, finca, glamping,
-- posada). Vive en HabitacionTipo (no en ConfigHotel) porque un mismo
-- comercio puede mezclar tipos — ej. una finca con habitaciones en la casa
-- principal y cabañas independientes en el mismo predio.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoAlojamiento') THEN
    CREATE TYPE "TipoAlojamiento" AS ENUM ('HABITACION', 'CABANA', 'APARTAMENTO', 'CASA_COMPLETA', 'FINCA', 'GLAMPING', 'POSADA');
  END IF;
END $$;

ALTER TABLE "HabitacionTipo" ADD COLUMN IF NOT EXISTS "tipoAlojamiento" "TipoAlojamiento" NOT NULL DEFAULT 'HABITACION';
