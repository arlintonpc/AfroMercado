-- Favoritos para el modulo Empleo (mismo patron que FavoritoHotel/FavoritoTour).

CREATE TABLE IF NOT EXISTS "FavoritoOfertaEmpleo" (
  "id"             SERIAL PRIMARY KEY,
  "usuarioId"      INTEGER NOT NULL,
  "ofertaEmpleoId" INTEGER NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "FavoritoOfertaEmpleo_usuarioId_ofertaEmpleoId_key" ON "FavoritoOfertaEmpleo"("usuarioId", "ofertaEmpleoId");
CREATE INDEX IF NOT EXISTS "FavoritoOfertaEmpleo_usuarioId_idx" ON "FavoritoOfertaEmpleo"("usuarioId");
CREATE INDEX IF NOT EXISTS "FavoritoOfertaEmpleo_ofertaEmpleoId_idx" ON "FavoritoOfertaEmpleo"("ofertaEmpleoId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FavoritoOfertaEmpleo_usuarioId_fkey') THEN
    ALTER TABLE "FavoritoOfertaEmpleo" ADD CONSTRAINT "FavoritoOfertaEmpleo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FavoritoOfertaEmpleo_ofertaEmpleoId_fkey') THEN
    ALTER TABLE "FavoritoOfertaEmpleo" ADD CONSTRAINT "FavoritoOfertaEmpleo_ofertaEmpleoId_fkey" FOREIGN KEY ("ofertaEmpleoId") REFERENCES "OfertaEmpleo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
