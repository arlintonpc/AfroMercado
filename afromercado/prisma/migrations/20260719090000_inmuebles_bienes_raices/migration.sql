-- Módulo Bienes Raíces / Inmuebles (vitrina, sin transacción). Cualquier
-- Usuario puede publicar (mismo espíritu que Empleo), pero a diferencia de
-- Empleo la moderación NUNCA se salta: un admin siempre debe verificar el
-- documento de soporte (evidencia de título, privado) antes de aprobar. El
-- contacto es siempre por WhatsApp, nunca hay pago dentro de la plataforma.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoInmueble') THEN
    CREATE TYPE "TipoInmueble" AS ENUM ('LOTE', 'CASA', 'APARTAMENTO', 'FINCA', 'LOCAL_COMERCIAL', 'BODEGA', 'OTRO');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoOperacionInmueble') THEN
    CREATE TYPE "TipoOperacionInmueble" AS ENUM ('VENTA', 'ARRIENDO');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoInmueble') THEN
    CREATE TYPE "EstadoInmueble" AS ENUM ('BORRADOR', 'PUBLICADO', 'PAUSADO', 'CERRADO');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MotivoDenunciaInmueble') THEN
    CREATE TYPE "MotivoDenunciaInmueble" AS ENUM ('PUBLICACION_FALSA', 'TIERRA_EN_DISPUTA', 'ESTAFA_DINERO', 'DOCUMENTO_FALSO', 'CONTENIDO_INAPROPIADO', 'OTRO');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoDenunciaInmueble') THEN
    CREATE TYPE "EstadoDenunciaInmueble" AS ENUM ('PENDIENTE', 'DESESTIMADA', 'PUBLICACION_BLOQUEADA', 'CUENTA_BLOQUEADA');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Inmueble" (
  "id"                      SERIAL NOT NULL,
  "publicadorId"            INTEGER NOT NULL,
  "comercioId"              INTEGER,
  "titulo"                  TEXT NOT NULL,
  "descripcion"             TEXT,
  "tipoInmueble"            "TipoInmueble" NOT NULL,
  "tipoOperacion"           "TipoOperacionInmueble" NOT NULL,
  "precio"                  DECIMAL(14,2) NOT NULL,
  "areaM2"                  DOUBLE PRECISION,
  "habitaciones"            INTEGER,
  "banos"                   INTEGER,
  "departamento"            TEXT NOT NULL,
  "municipio"               TEXT NOT NULL,
  "vereda"                  TEXT,
  "direccionReferencia"     TEXT,
  "latitud"                 DOUBLE PRECISION,
  "longitud"                DOUBLE PRECISION,
  "fotoUrls"                TEXT[] NOT NULL DEFAULT '{}',
  "folioMatricula"          TEXT,
  "documentoSoporteUrl"     TEXT,
  "contactoWhatsapp"        TEXT,
  "estado"                  "EstadoInmueble" NOT NULL DEFAULT 'BORRADOR',
  "estadoModeracion"        TEXT NOT NULL DEFAULT 'PENDIENTE',
  "revisadoPor"             INTEGER,
  "revisadoAt"              TIMESTAMP(3),
  "motivoRechazoModeracion" TEXT,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,
  "deletedAt"               TIMESTAMP(3),

  CONSTRAINT "Inmueble_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Inmueble_departamento_municipio_idx" ON "Inmueble"("departamento", "municipio");
CREATE INDEX IF NOT EXISTS "Inmueble_tipoInmueble_tipoOperacion_idx" ON "Inmueble"("tipoInmueble", "tipoOperacion");
CREATE INDEX IF NOT EXISTS "Inmueble_estado_estadoModeracion_idx" ON "Inmueble"("estado", "estadoModeracion");
CREATE INDEX IF NOT EXISTS "Inmueble_publicadorId_idx" ON "Inmueble"("publicadorId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Inmueble_publicadorId_fkey') THEN
    ALTER TABLE "Inmueble" ADD CONSTRAINT "Inmueble_publicadorId_fkey"
      FOREIGN KEY ("publicadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Inmueble_comercioId_fkey') THEN
    ALTER TABLE "Inmueble" ADD CONSTRAINT "Inmueble_comercioId_fkey"
      FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "DenunciaInmueble" (
  "id"            SERIAL NOT NULL,
  "inmuebleId"    INTEGER NOT NULL,
  "denuncianteId" INTEGER NOT NULL,
  "motivo"        "MotivoDenunciaInmueble" NOT NULL,
  "descripcion"   TEXT,
  "estado"        "EstadoDenunciaInmueble" NOT NULL DEFAULT 'PENDIENTE',
  "revisadoPor"   INTEGER,
  "revisadoAt"    TIMESTAMP(3),
  "notaRevision"  TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DenunciaInmueble_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DenunciaInmueble_inmuebleId_denuncianteId_key" ON "DenunciaInmueble"("inmuebleId", "denuncianteId");
CREATE INDEX IF NOT EXISTS "DenunciaInmueble_estado_createdAt_idx" ON "DenunciaInmueble"("estado", "createdAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DenunciaInmueble_inmuebleId_fkey') THEN
    ALTER TABLE "DenunciaInmueble" ADD CONSTRAINT "DenunciaInmueble_inmuebleId_fkey"
      FOREIGN KEY ("inmuebleId") REFERENCES "Inmueble"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DenunciaInmueble_denuncianteId_fkey') THEN
    ALTER TABLE "DenunciaInmueble" ADD CONSTRAINT "DenunciaInmueble_denuncianteId_fkey"
      FOREIGN KEY ("denuncianteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
