-- RNT en ConfigHotel
ALTER TABLE "ConfigHotel"
  ADD COLUMN IF NOT EXISTS "rnt"          TEXT,
  ADD COLUMN IF NOT EXISTS "rntVerificado" BOOLEAN NOT NULL DEFAULT false;

-- Favoritos de hoteles
CREATE TABLE IF NOT EXISTS "FavoritoHotel" (
  "id"            SERIAL PRIMARY KEY,
  "usuarioId"     INTEGER NOT NULL REFERENCES "Usuario"("id") ON DELETE CASCADE,
  "configHotelId" INTEGER NOT NULL REFERENCES "ConfigHotel"("id") ON DELETE CASCADE,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "FavoritoHotel_usuarioId_configHotelId_key"
  ON "FavoritoHotel"("usuarioId","configHotelId");
CREATE INDEX IF NOT EXISTS "FavoritoHotel_usuarioId_idx" ON "FavoritoHotel"("usuarioId");
CREATE INDEX IF NOT EXISTS "FavoritoHotel_configHotelId_idx" ON "FavoritoHotel"("configHotelId");
