-- Anexo B, Fase 1 (piloto de migración núcleo-vs-verticales): unifica los 7
-- modelos de Favorito (Favorito + FavoritoHotel/Express/Tour/Transporte/
-- Cultura/OfertaEmpleo) en un solo modelo polimórfico. Migra los datos
-- existentes antes de eliminar las tablas viejas — nada se pierde.

-- 1. Enum del discriminador de tipo
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoEntidadFavorita') THEN
    CREATE TYPE "TipoEntidadFavorita" AS ENUM (
      'PRODUCTO', 'CONFIG_HOTEL', 'CONFIG_EXPRESS', 'CONFIG_TOUR',
      'CONFIG_TRANSPORTE', 'EVENTO_CULTURAL', 'OFERTA_EMPLEO'
    );
  END IF;
END $$;

-- 2. Nuevas columnas en Favorito (nullable de entrada, se llenan abajo)
ALTER TABLE "Favorito" ADD COLUMN IF NOT EXISTS "tipoEntidad" "TipoEntidadFavorita";
ALTER TABLE "Favorito" ADD COLUMN IF NOT EXISTS "entidadId" INTEGER;

-- 3. Backfill de las filas existentes (todas eran de Producto/Marketplace).
--    Guardado contra columna ya eliminada, para que sea idempotente incluso
--    después de que el paso 7 elimine "productoId" en una corrida anterior.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Favorito' AND column_name = 'productoId') THEN
    UPDATE "Favorito" SET "tipoEntidad" = 'PRODUCTO', "entidadId" = "productoId"
      WHERE "tipoEntidad" IS NULL AND "productoId" IS NOT NULL;
  END IF;
END $$;

-- 4. Índice único nuevo (necesario antes de los INSERT con ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS "Favorito_usuarioId_tipoEntidad_entidadId_key"
  ON "Favorito"("usuarioId", "tipoEntidad", "entidadId");

-- 5. Migrar filas de las 6 tablas viejas hacia la tabla unificada (solo si
--    esas tablas todavía existen — en un entorno donde ya se corrió esta
--    migración antes, el bloque se salta sin error).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FavoritoHotel') THEN
    INSERT INTO "Favorito" ("usuarioId", "tipoEntidad", "entidadId", "createdAt")
      SELECT "usuarioId", 'CONFIG_HOTEL', "configHotelId", "createdAt" FROM "FavoritoHotel"
      ON CONFLICT ("usuarioId", "tipoEntidad", "entidadId") DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FavoritoExpress') THEN
    INSERT INTO "Favorito" ("usuarioId", "tipoEntidad", "entidadId", "createdAt")
      SELECT "usuarioId", 'CONFIG_EXPRESS', "configExpressId", "createdAt" FROM "FavoritoExpress"
      ON CONFLICT ("usuarioId", "tipoEntidad", "entidadId") DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FavoritoTour') THEN
    INSERT INTO "Favorito" ("usuarioId", "tipoEntidad", "entidadId", "createdAt")
      SELECT "usuarioId", 'CONFIG_TOUR', "configTourId", "createdAt" FROM "FavoritoTour"
      ON CONFLICT ("usuarioId", "tipoEntidad", "entidadId") DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FavoritoTransporte') THEN
    INSERT INTO "Favorito" ("usuarioId", "tipoEntidad", "entidadId", "createdAt")
      SELECT "usuarioId", 'CONFIG_TRANSPORTE', "configTransporteId", "createdAt" FROM "FavoritoTransporte"
      ON CONFLICT ("usuarioId", "tipoEntidad", "entidadId") DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FavoritoCultura') THEN
    INSERT INTO "Favorito" ("usuarioId", "tipoEntidad", "entidadId", "createdAt")
      SELECT "usuarioId", 'EVENTO_CULTURAL', "eventoCulturalId", "createdAt" FROM "FavoritoCultura"
      ON CONFLICT ("usuarioId", "tipoEntidad", "entidadId") DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FavoritoOfertaEmpleo') THEN
    INSERT INTO "Favorito" ("usuarioId", "tipoEntidad", "entidadId", "createdAt")
      SELECT "usuarioId", 'OFERTA_EMPLEO', "ofertaEmpleoId", "createdAt" FROM "FavoritoOfertaEmpleo"
      ON CONFLICT ("usuarioId", "tipoEntidad", "entidadId") DO NOTHING;
  END IF;
END $$;

-- 6. tipoEntidad/entidadId ya no admiten null de aquí en adelante
ALTER TABLE "Favorito" ALTER COLUMN "tipoEntidad" SET NOT NULL;
ALTER TABLE "Favorito" ALTER COLUMN "entidadId" SET NOT NULL;

-- 7. Fuera lo viejo: constraint/columna de Producto específica de Marketplace,
--    y las 6 tablas por vertical, ya con sus datos migrados arriba.
ALTER TABLE "Favorito" DROP CONSTRAINT IF EXISTS "Favorito_productoId_fkey";
DROP INDEX IF EXISTS "Favorito_usuarioId_productoId_key";
ALTER TABLE "Favorito" DROP COLUMN IF EXISTS "productoId";

DROP TABLE IF EXISTS "FavoritoHotel";
DROP TABLE IF EXISTS "FavoritoExpress";
DROP TABLE IF EXISTS "FavoritoTour";
DROP TABLE IF EXISTS "FavoritoTransporte";
DROP TABLE IF EXISTS "FavoritoCultura";
DROP TABLE IF EXISTS "FavoritoOfertaEmpleo";
