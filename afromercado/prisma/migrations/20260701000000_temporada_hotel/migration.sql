CREATE TABLE IF NOT EXISTS "TemporadaHotel" (
  "id"               SERIAL PRIMARY KEY,
  "configHotelId"    INTEGER NOT NULL REFERENCES "ConfigHotel"("id") ON DELETE CASCADE,
  "habitacionTipoId" INTEGER REFERENCES "HabitacionTipo"("id") ON DELETE SET NULL,
  "nombre"           TEXT NOT NULL,
  "inicio"           TIMESTAMP(3) NOT NULL,
  "fin"              TIMESTAMP(3) NOT NULL,
  "precioPorNoche"   DECIMAL(12,2) NOT NULL,
  "activo"           BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "TemporadaHotel_configHotelId_activo_idx" ON "TemporadaHotel"("configHotelId","activo");
CREATE INDEX IF NOT EXISTS "TemporadaHotel_habitacionTipoId_activo_idx" ON "TemporadaHotel"("habitacionTipoId","activo");
CREATE INDEX IF NOT EXISTS "TemporadaHotel_inicio_fin_idx" ON "TemporadaHotel"("inicio","fin");
