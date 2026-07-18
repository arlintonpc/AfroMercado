-- Anexo B, Fase 3 (unificación núcleo-vs-verticales): unifica los 7 modelos
-- de reseña (Review, ReviewProducto, ReviewHotel, ReviewTour,
-- ReviewTransporte, ReviewExpress, ReviewCultura) en un solo modelo
-- polimórfico, con comercioId desnormalizado para poder calcular la
-- calificación de un comercio con una sola query sin importar en cuántos
-- verticales opere. Migra los datos existentes antes de eliminar las tablas
-- viejas — nada se pierde.

-- 1. Enum del discriminador de tipo
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoEntidadResenable') THEN
    CREATE TYPE "TipoEntidadResenable" AS ENUM (
      'PEDIDO', 'PRODUCTO', 'RESERVA_HOTEL', 'RESERVA_TOUR',
      'RESERVA_TRANSPORTE', 'PEDIDO_EXPRESS', 'RESERVA_CULTURAL'
    );
  END IF;
END $$;

-- 2. Tabla unificada. [tipoEntidad, entidadId] por sí solo determina un único
--    autor posible en 6 de los 7 tipos (una reserva/pedido pertenece a un
--    cliente); PRODUCTO es la excepción real (muchos compradores distintos
--    pueden reseñar el mismo producto) — por eso autorId entra en la
--    restricción única, no solo el par [tipoEntidad, entidadId].
CREATE TABLE IF NOT EXISTS "Resena" (
  "id" SERIAL PRIMARY KEY,
  "tipoEntidad" "TipoEntidadResenable" NOT NULL,
  "entidadId" INTEGER NOT NULL,
  "comercioId" INTEGER,
  "autorId" INTEGER NOT NULL,
  "calificacion" INTEGER NOT NULL,
  "comentario" TEXT,
  "fotoUrls" TEXT[] NOT NULL DEFAULT '{}',
  "videoUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Resena_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Resena_comercioId_fkey" FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Resena_tipoEntidad_entidadId_autorId_key" UNIQUE ("tipoEntidad", "entidadId", "autorId")
);

CREATE INDEX IF NOT EXISTS "Resena_comercioId_idx" ON "Resena"("comercioId");
CREATE INDEX IF NOT EXISTS "Resena_tipoEntidad_entidadId_idx" ON "Resena"("tipoEntidad", "entidadId");

-- 3. Migrar filas de las 7 tablas viejas (solo si todavía existen — en un
--    entorno donde ya se corrió esta migración antes, cada bloque se salta
--    sin error). LEFT JOIN a propósito: si la entidad padre (producto,
--    config, evento) ya fue borrada, la reseña igual se conserva con
--    comercioId NULL en vez de perderse.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Review') THEN
    INSERT INTO "Resena" ("tipoEntidad", "entidadId", "comercioId", "autorId", "calificacion", "comentario", "createdAt")
      SELECT 'PEDIDO', "pedidoId", "comercioId", "compradorId", "calificacion", "comentario", "createdAt" FROM "Review"
      ON CONFLICT ("tipoEntidad", "entidadId", "autorId") DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReviewProducto') THEN
    INSERT INTO "Resena" ("tipoEntidad", "entidadId", "comercioId", "autorId", "calificacion", "comentario", "createdAt")
      SELECT 'PRODUCTO', rp."productoId", p."comercioId", rp."compradorId", rp."calificacion", rp."comentario", rp."createdAt"
      FROM "ReviewProducto" rp LEFT JOIN "Producto" p ON p."id" = rp."productoId"
      ON CONFLICT ("tipoEntidad", "entidadId", "autorId") DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReviewHotel') THEN
    INSERT INTO "Resena" ("tipoEntidad", "entidadId", "comercioId", "autorId", "calificacion", "comentario", "createdAt")
      SELECT 'RESERVA_HOTEL', rh."reservaHotelId", ch."comercioId", rh."clienteId", rh."calificacion", rh."comentario", rh."creadoAt"
      FROM "ReviewHotel" rh LEFT JOIN "ConfigHotel" ch ON ch."id" = rh."configHotelId"
      ON CONFLICT ("tipoEntidad", "entidadId", "autorId") DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReviewTour') THEN
    INSERT INTO "Resena" ("tipoEntidad", "entidadId", "comercioId", "autorId", "calificacion", "comentario", "createdAt")
      SELECT 'RESERVA_TOUR', rt."reservaTourId", ct."comercioId", rt."clienteId", rt."calificacion", rt."comentario", rt."creadoAt"
      FROM "ReviewTour" rt LEFT JOIN "ConfigTour" ct ON ct."id" = rt."configTourId"
      ON CONFLICT ("tipoEntidad", "entidadId", "autorId") DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReviewTransporte') THEN
    INSERT INTO "Resena" ("tipoEntidad", "entidadId", "comercioId", "autorId", "calificacion", "comentario", "createdAt")
      SELECT 'RESERVA_TRANSPORTE', rt."reservaTransporteId", ctr."comercioId", rt."clienteId", rt."calificacion", rt."comentario", rt."creadoAt"
      FROM "ReviewTransporte" rt LEFT JOIN "ConfigTransporte" ctr ON ctr."id" = rt."configTransporteId"
      ON CONFLICT ("tipoEntidad", "entidadId", "autorId") DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReviewExpress') THEN
    INSERT INTO "Resena" ("tipoEntidad", "entidadId", "comercioId", "autorId", "calificacion", "comentario", "fotoUrls", "createdAt")
      SELECT 'PEDIDO_EXPRESS', re."pedidoExpressId", ce."comercioId", re."clienteId", re."calificacion", re."comentario", re."fotoUrls", re."creadoAt"
      FROM "ReviewExpress" re LEFT JOIN "ConfigExpress" ce ON ce."id" = re."configExpressId"
      ON CONFLICT ("tipoEntidad", "entidadId", "autorId") DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ReviewCultura') THEN
    INSERT INTO "Resena" ("tipoEntidad", "entidadId", "comercioId", "autorId", "calificacion", "comentario", "fotoUrls", "videoUrl", "createdAt")
      SELECT 'RESERVA_CULTURAL', rc."reservaCulturalId", ev."comercioId", rc."clienteId", rc."calificacion", rc."comentario", rc."fotoUrls", rc."videoUrl", rc."creadoAt"
      FROM "ReviewCultura" rc LEFT JOIN "EventoCultural" ev ON ev."id" = rc."eventoCulturalId"
      ON CONFLICT ("tipoEntidad", "entidadId", "autorId") DO NOTHING;
  END IF;
END $$;

-- 4. Recalcular Comercio.calificacion/totalReviews desde Resena para todos
--    los comercios con al menos una reseña migrada. PRODUCTO se excluye a
--    propósito (nunca alimentó la calificación de la tienda, ni antes ni
--    ahora — es una reseña de un producto puntual, no del comercio).
--    Idempotente: recalcula desde el estado actual de Resena en cada corrida.
UPDATE "Comercio" c SET
  "calificacion" = sub.avg_cal,
  "totalReviews" = sub.cnt
FROM (
  SELECT "comercioId", ROUND(AVG("calificacion")::numeric, 2) AS avg_cal, COUNT(*)::int AS cnt
  FROM "Resena"
  WHERE "comercioId" IS NOT NULL AND "tipoEntidad" != 'PRODUCTO'
  GROUP BY "comercioId"
) sub
WHERE c."id" = sub."comercioId";

-- 5. Fuera las 7 tablas viejas, ya con sus datos migrados arriba.
DROP TABLE IF EXISTS "Review";
DROP TABLE IF EXISTS "ReviewProducto";
DROP TABLE IF EXISTS "ReviewHotel";
DROP TABLE IF EXISTS "ReviewTour";
DROP TABLE IF EXISTS "ReviewTransporte";
DROP TABLE IF EXISTS "ReviewExpress";
DROP TABLE IF EXISTS "ReviewCultura";
