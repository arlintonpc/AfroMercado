-- Favoritos de Cultura: permite a un usuario marcar/desmarcar eventos
-- culturales como favoritos, mismo patrón que FavoritoTour/FavoritoTransporte.

CREATE TABLE IF NOT EXISTS "FavoritoCultura" (
  "id"               SERIAL PRIMARY KEY,
  "usuarioId"        INTEGER NOT NULL,
  "eventoCulturalId" INTEGER NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "FavoritoCultura_usuarioId_eventoCulturalId_key" ON "FavoritoCultura"("usuarioId", "eventoCulturalId");
CREATE INDEX IF NOT EXISTS "FavoritoCultura_usuarioId_idx" ON "FavoritoCultura"("usuarioId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FavoritoCultura_usuarioId_fkey') THEN
    ALTER TABLE "FavoritoCultura" ADD CONSTRAINT "FavoritoCultura_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FavoritoCultura_eventoCulturalId_fkey') THEN
    ALTER TABLE "FavoritoCultura" ADD CONSTRAINT "FavoritoCultura_eventoCulturalId_fkey" FOREIGN KEY ("eventoCulturalId") REFERENCES "EventoCultural"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
