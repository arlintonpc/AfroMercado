-- Comparte tu Chocó: publicaciones comunitarias de foto(s)/video de sitios
-- turísticos o historia cultural, sin moderación previa. Control reactivo:
-- cualquiera puede denunciar; un admin desestima la denuncia u oculta la
-- publicación (no hay bloqueo de cuenta en este flujo).

CREATE TABLE IF NOT EXISTS "PublicacionCultural" (
  "id"           SERIAL PRIMARY KEY,
  "autorId"      INTEGER NOT NULL,
  "titulo"       TEXT NOT NULL,
  "descripcion"  TEXT,
  "fotoUrls"     TEXT[] NOT NULL DEFAULT '{}',
  "videoUrl"     TEXT,
  "departamento" TEXT NOT NULL,
  "municipio"    TEXT,
  "activa"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PublicacionCultural_activa_departamento_createdAt_idx" ON "PublicacionCultural"("activa", "departamento", "createdAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PublicacionCultural_autorId_fkey') THEN
    ALTER TABLE "PublicacionCultural" ADD CONSTRAINT "PublicacionCultural_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MotivoDenunciaPublicacion') THEN
    CREATE TYPE "MotivoDenunciaPublicacion" AS ENUM ('CONTENIDO_INAPROPIADO','SPAM','DERECHOS_DE_AUTOR','NO_RELACIONADO','OTRO');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoDenunciaPublicacion') THEN
    CREATE TYPE "EstadoDenunciaPublicacion" AS ENUM ('PENDIENTE','DESESTIMADA','PUBLICACION_OCULTADA');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "DenunciaPublicacionCultural" (
  "id"                    SERIAL PRIMARY KEY,
  "publicacionCulturalId" INTEGER NOT NULL,
  "denuncianteId"         INTEGER NOT NULL,
  "motivo"                "MotivoDenunciaPublicacion" NOT NULL,
  "descripcion"           TEXT,
  "estado"                "EstadoDenunciaPublicacion" NOT NULL DEFAULT 'PENDIENTE',
  "revisadoPor"           INTEGER,
  "revisadoAt"            TIMESTAMP(3),
  "notaRevision"          TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "DenunciaPublicacionCultural_publicacionCulturalId_denuncian_key" ON "DenunciaPublicacionCultural"("publicacionCulturalId", "denuncianteId");
CREATE INDEX IF NOT EXISTS "DenunciaPublicacionCultural_estado_createdAt_idx" ON "DenunciaPublicacionCultural"("estado", "createdAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DenunciaPublicacionCultural_publicacionCulturalId_fkey') THEN
    ALTER TABLE "DenunciaPublicacionCultural" ADD CONSTRAINT "DenunciaPublicacionCultural_publicacionCulturalId_fkey" FOREIGN KEY ("publicacionCulturalId") REFERENCES "PublicacionCultural"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DenunciaPublicacionCultural_denuncianteId_fkey') THEN
    ALTER TABLE "DenunciaPublicacionCultural" ADD CONSTRAINT "DenunciaPublicacionCultural_denuncianteId_fkey" FOREIGN KEY ("denuncianteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
