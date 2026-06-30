CREATE TABLE IF NOT EXISTS "HabitacionFisica" (
  "id" SERIAL PRIMARY KEY,
  "configHotelId" INTEGER NOT NULL,
  "habitacionTipoId" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "piso" TEXT,
  "zona" TEXT,
  "estado" TEXT NOT NULL DEFAULT 'LIBRE',
  "notas" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HabitacionFisica_configHotelId_fkey" FOREIGN KEY ("configHotelId") REFERENCES "ConfigHotel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HabitacionFisica_habitacionTipoId_fkey" FOREIGN KEY ("habitacionTipoId") REFERENCES "HabitacionTipo"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "ReservaHotel"
  ADD COLUMN IF NOT EXISTS "habitacionFisicaId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ReservaHotel_habitacionFisicaId_fkey'
  ) THEN
    ALTER TABLE "ReservaHotel"
      ADD CONSTRAINT "ReservaHotel_habitacionFisicaId_fkey"
      FOREIGN KEY ("habitacionFisicaId") REFERENCES "HabitacionFisica"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "HabitacionFisica_habitacionTipoId_nombre_key"
  ON "HabitacionFisica"("habitacionTipoId", "nombre");

CREATE INDEX IF NOT EXISTS "HabitacionFisica_configHotelId_estado_idx"
  ON "HabitacionFisica"("configHotelId", "estado");

CREATE INDEX IF NOT EXISTS "HabitacionFisica_habitacionTipoId_activo_idx"
  ON "HabitacionFisica"("habitacionTipoId", "activo");

CREATE INDEX IF NOT EXISTS "ReservaHotel_habitacionFisicaId_idx"
  ON "ReservaHotel"("habitacionFisicaId");
