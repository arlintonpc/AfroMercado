-- Likes de publicaciones comunitarias ("Comparte tu Chocó"): permite a un
-- usuario marcar/desmarcar "me gusta" en una publicación, mismo patrón que
-- FavoritoCultura.

CREATE TABLE IF NOT EXISTS "LikePublicacionCultural" (
  "id"                    SERIAL PRIMARY KEY,
  "usuarioId"             INTEGER NOT NULL,
  "publicacionCulturalId" INTEGER NOT NULL,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "LikePublicacionCultural_usuarioId_publicacionCulturalId_key" ON "LikePublicacionCultural"("usuarioId", "publicacionCulturalId");
CREATE INDEX IF NOT EXISTS "LikePublicacionCultural_publicacionCulturalId_idx" ON "LikePublicacionCultural"("publicacionCulturalId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LikePublicacionCultural_usuarioId_fkey') THEN
    ALTER TABLE "LikePublicacionCultural" ADD CONSTRAINT "LikePublicacionCultural_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LikePublicacionCultural_publicacionCulturalId_fkey') THEN
    ALTER TABLE "LikePublicacionCultural" ADD CONSTRAINT "LikePublicacionCultural_publicacionCulturalId_fkey" FOREIGN KEY ("publicacionCulturalId") REFERENCES "PublicacionCultural"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
