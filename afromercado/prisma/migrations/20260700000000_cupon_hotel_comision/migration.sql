-- Tabla de cupones de hotel
CREATE TABLE IF NOT EXISTS "CuponHotel" (
  "id"            SERIAL PRIMARY KEY,
  "codigo"        TEXT NOT NULL UNIQUE,
  "tipo"          TEXT NOT NULL DEFAULT 'PORCENTAJE',
  "valor"         DECIMAL(10,2) NOT NULL,
  "minimoNoches"  INTEGER,
  "usosMaximos"   INTEGER,
  "usosActuales"  INTEGER NOT NULL DEFAULT 0,
  "activo"        BOOLEAN NOT NULL DEFAULT true,
  "inicio"        TIMESTAMP(3) NOT NULL,
  "fin"           TIMESTAMP(3) NOT NULL,
  "configHotelId" INTEGER REFERENCES "ConfigHotel"("id") ON DELETE SET NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CuponHotel_codigo_activo_idx" ON "CuponHotel"("codigo", "activo");
CREATE INDEX IF NOT EXISTS "CuponHotel_activo_fin_idx" ON "CuponHotel"("activo", "fin");
CREATE INDEX IF NOT EXISTS "CuponHotel_configHotelId_idx" ON "CuponHotel"("configHotelId");

-- Tabla de usos de cupón
CREATE TABLE IF NOT EXISTS "CuponHotelUso" (
  "id"             SERIAL PRIMARY KEY,
  "cuponHotelId"   INTEGER NOT NULL REFERENCES "CuponHotel"("id"),
  "clienteId"      INTEGER NOT NULL REFERENCES "Usuario"("id"),
  "reservaHotelId" INTEGER NOT NULL UNIQUE REFERENCES "ReservaHotel"("id"),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CuponHotelUso_cuponHotelId_clienteId_idx" ON "CuponHotelUso"("cuponHotelId", "clienteId");

-- Columnas de comisión en ReservaHotel
ALTER TABLE "ReservaHotel"
  ADD COLUMN IF NOT EXISTS "comision"     DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "tasaComision" DECIMAL(5,4);
