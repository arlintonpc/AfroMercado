-- Anexo B, Fase 4 (unificación núcleo-vs-verticales): unifica los 8 modelos
-- de cupón de los verticales de servicio (CuponHotel/CuponExpress/CuponTour/
-- CuponTransporte + sus *Uso) en un solo par polimórfico. El Cupon/CuponUso
-- de Marketplace se deja intacto a propósito (tiene un sistema de analítica
-- y detección de fraude exclusivo, sin nada equivalente que unificar).
-- Migra los datos existentes antes de eliminar las tablas viejas.

-- 1. Enum del discriminador de tipo
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoEntidadCuponVertical') THEN
    CREATE TYPE "TipoEntidadCuponVertical" AS ENUM (
      'CONFIG_HOTEL', 'CONFIG_EXPRESS', 'CONFIG_TOUR', 'CONFIG_TRANSPORTE'
    );
  END IF;
END $$;

-- 2. Tablas unificadas
CREATE TABLE IF NOT EXISTS "CuponVertical" (
  "id"              SERIAL PRIMARY KEY,
  "codigo"          TEXT NOT NULL UNIQUE,
  "tipoEntidad"     "TipoEntidadCuponVertical" NOT NULL,
  "entidadId"       INTEGER,
  "tipo"            TEXT NOT NULL DEFAULT 'PORCENTAJE',
  "valor"           DECIMAL(10,2) NOT NULL,
  "minimoAplicable" DECIMAL(12,2),
  "usosMaximos"     INTEGER,
  "usosActuales"    INTEGER NOT NULL DEFAULT 0,
  "activo"          BOOLEAN NOT NULL DEFAULT true,
  "inicio"          TIMESTAMP(3) NOT NULL,
  "fin"             TIMESTAMP(3) NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CuponVertical_codigo_activo_idx" ON "CuponVertical"("codigo", "activo");
CREATE INDEX IF NOT EXISTS "CuponVertical_activo_fin_idx" ON "CuponVertical"("activo", "fin");
CREATE INDEX IF NOT EXISTS "CuponVertical_tipoEntidad_entidadId_idx" ON "CuponVertical"("tipoEntidad", "entidadId");

CREATE TABLE IF NOT EXISTS "CuponVerticalUso" (
  "id"          SERIAL PRIMARY KEY,
  "cuponId"     INTEGER NOT NULL,
  "clienteId"   INTEGER NOT NULL,
  "tipoEntidad" "TipoEntidadCuponVertical" NOT NULL,
  "entidadId"   INTEGER NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CuponVerticalUso_cuponId_fkey" FOREIGN KEY ("cuponId") REFERENCES "CuponVertical"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CuponVerticalUso_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CuponVerticalUso_tipoEntidad_entidadId_key" UNIQUE ("tipoEntidad", "entidadId")
);
CREATE INDEX IF NOT EXISTS "CuponVerticalUso_cuponId_clienteId_idx" ON "CuponVerticalUso"("cuponId", "clienteId");

-- 3. Migrar cupones (solo si las tablas viejas todavía existen). Si dos
--    verticales llegaron a compartir el mismo código (colisión real, nunca
--    posible antes porque cada tabla tenía su propio unique), la segunda
--    fila se descarta con ON CONFLICT — más seguro que reventar la migración.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CuponHotel') THEN
    INSERT INTO "CuponVertical" ("codigo","tipoEntidad","entidadId","tipo","valor","minimoAplicable","usosMaximos","usosActuales","activo","inicio","fin","createdAt")
      SELECT codigo, 'CONFIG_HOTEL', "configHotelId", tipo, valor, "minimoNoches"::decimal, "usosMaximos", "usosActuales", activo, inicio, fin, "createdAt"
      FROM "CuponHotel"
      ON CONFLICT (codigo) DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CuponExpress') THEN
    INSERT INTO "CuponVertical" ("codigo","tipoEntidad","entidadId","tipo","valor","minimoAplicable","usosMaximos","usosActuales","activo","inicio","fin","createdAt")
      SELECT codigo, 'CONFIG_EXPRESS', "configExpressId", tipo, valor, "minimoSubtotal", "usosMaximos", "usosActuales", activo, inicio, fin, "createdAt"
      FROM "CuponExpress"
      ON CONFLICT (codigo) DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CuponTour') THEN
    INSERT INTO "CuponVertical" ("codigo","tipoEntidad","entidadId","tipo","valor","minimoAplicable","usosMaximos","usosActuales","activo","inicio","fin","createdAt")
      SELECT codigo, 'CONFIG_TOUR', "configTourId", tipo, valor, "minimoPersonas"::decimal, "usosMaximos", "usosActuales", activo, inicio, fin, "createdAt"
      FROM "CuponTour"
      ON CONFLICT (codigo) DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CuponTransporte') THEN
    INSERT INTO "CuponVertical" ("codigo","tipoEntidad","entidadId","tipo","valor","minimoAplicable","usosMaximos","usosActuales","activo","inicio","fin","createdAt")
      SELECT codigo, 'CONFIG_TRANSPORTE', "configTransporteId", tipo, valor, "minimoAsientos"::decimal, "usosMaximos", "usosActuales", activo, inicio, fin, "createdAt"
      FROM "CuponTransporte"
      ON CONFLICT (codigo) DO NOTHING;
  END IF;
END $$;

-- 4. Migrar el log de usos, resolviendo el cuponId nuevo por código+tipo.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CuponHotelUso') THEN
    INSERT INTO "CuponVerticalUso" ("cuponId","clienteId","tipoEntidad","entidadId","createdAt")
      SELECT cv.id, u."clienteId", 'CONFIG_HOTEL', u."reservaHotelId", u."createdAt"
      FROM "CuponHotelUso" u
      JOIN "CuponHotel" c ON c.id = u."cuponHotelId"
      JOIN "CuponVertical" cv ON cv.codigo = c.codigo AND cv."tipoEntidad" = 'CONFIG_HOTEL'
      ON CONFLICT ("tipoEntidad", "entidadId") DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CuponExpressUso') THEN
    INSERT INTO "CuponVerticalUso" ("cuponId","clienteId","tipoEntidad","entidadId","createdAt")
      SELECT cv.id, u."clienteId", 'CONFIG_EXPRESS', u."pedidoExpressId", u."createdAt"
      FROM "CuponExpressUso" u
      JOIN "CuponExpress" c ON c.id = u."cuponExpressId"
      JOIN "CuponVertical" cv ON cv.codigo = c.codigo AND cv."tipoEntidad" = 'CONFIG_EXPRESS'
      ON CONFLICT ("tipoEntidad", "entidadId") DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CuponTourUso') THEN
    INSERT INTO "CuponVerticalUso" ("cuponId","clienteId","tipoEntidad","entidadId","createdAt")
      SELECT cv.id, u."clienteId", 'CONFIG_TOUR', u."reservaTourId", u."createdAt"
      FROM "CuponTourUso" u
      JOIN "CuponTour" c ON c.id = u."cuponTourId"
      JOIN "CuponVertical" cv ON cv.codigo = c.codigo AND cv."tipoEntidad" = 'CONFIG_TOUR'
      ON CONFLICT ("tipoEntidad", "entidadId") DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CuponTransporteUso') THEN
    INSERT INTO "CuponVerticalUso" ("cuponId","clienteId","tipoEntidad","entidadId","createdAt")
      SELECT cv.id, u."clienteId", 'CONFIG_TRANSPORTE', u."reservaTransporteId", u."createdAt"
      FROM "CuponTransporteUso" u
      JOIN "CuponTransporte" c ON c.id = u."cuponTransporteId"
      JOIN "CuponVertical" cv ON cv.codigo = c.codigo AND cv."tipoEntidad" = 'CONFIG_TRANSPORTE'
      ON CONFLICT ("tipoEntidad", "entidadId") DO NOTHING;
  END IF;
END $$;

-- 5. Fuera las 8 tablas viejas, ya con sus datos migrados arriba.
DROP TABLE IF EXISTS "CuponHotelUso";
DROP TABLE IF EXISTS "CuponHotel";
DROP TABLE IF EXISTS "CuponExpressUso";
DROP TABLE IF EXISTS "CuponExpress";
DROP TABLE IF EXISTS "CuponTourUso";
DROP TABLE IF EXISTS "CuponTour";
DROP TABLE IF EXISTS "CuponTransporteUso";
DROP TABLE IF EXISTS "CuponTransporte";
