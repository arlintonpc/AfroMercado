-- Modulo Empleo / Bolsa de Trabajo comunitario (Fase 6). Cualquier Usuario
-- puede publicar y postularse; moderacion ligera antes de publicar; la hoja
-- de vida se snapshotea en cada postulacion.

DO $$ BEGIN
  CREATE TYPE "EstadoOfertaEmpleo" AS ENUM ('BORRADOR', 'PUBLICADA', 'PAUSADA', 'CERRADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TipoContratoEmpleo" AS ENUM ('TIEMPO_COMPLETO', 'MEDIO_TIEMPO', 'POR_DIAS', 'TEMPORAL', 'OTRO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EstadoPostulacionEmpleo" AS ENUM ('ENVIADA', 'VISTA', 'PRESELECCIONADO', 'RECHAZADA', 'CONTRATADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "OfertaEmpleo" (
  "id"                      SERIAL NOT NULL,
  "publicadoPorId"          INTEGER NOT NULL,
  "comercioId"              INTEGER,
  "titulo"                  TEXT NOT NULL,
  "descripcion"             TEXT NOT NULL,
  "categoria"               TEXT,
  "tipoContrato"            "TipoContratoEmpleo" NOT NULL,
  "municipio"               TEXT NOT NULL,
  "departamento"            TEXT,
  "salarioMin"              DECIMAL(12,2),
  "salarioMax"              DECIMAL(12,2),
  "salarioNegociable"       BOOLEAN NOT NULL DEFAULT false,
  "requisitos"              TEXT,
  "vacantes"                INTEGER NOT NULL DEFAULT 1,
  "estado"                  "EstadoOfertaEmpleo" NOT NULL DEFAULT 'BORRADOR',
  "estadoModeracion"        TEXT NOT NULL DEFAULT 'PENDIENTE',
  "revisadoPor"             INTEGER,
  "revisadoAt"              TIMESTAMP(3),
  "motivoRechazoModeracion" TEXT,
  "fechaCierre"             TIMESTAMP(3),
  "contactoWhatsapp"        TEXT,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,
  "deletedAt"               TIMESTAMP(3),

  CONSTRAINT "OfertaEmpleo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OfertaEmpleo_estado_estadoModeracion_municipio_createdAt_idx" ON "OfertaEmpleo"("estado", "estadoModeracion", "municipio", "createdAt");
CREATE INDEX IF NOT EXISTS "OfertaEmpleo_publicadoPorId_idx" ON "OfertaEmpleo"("publicadoPorId");
CREATE INDEX IF NOT EXISTS "OfertaEmpleo_comercioId_idx" ON "OfertaEmpleo"("comercioId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'OfertaEmpleo_publicadoPorId_fkey') THEN
    ALTER TABLE "OfertaEmpleo" ADD CONSTRAINT "OfertaEmpleo_publicadoPorId_fkey"
      FOREIGN KEY ("publicadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'OfertaEmpleo_comercioId_fkey') THEN
    ALTER TABLE "OfertaEmpleo" ADD CONSTRAINT "OfertaEmpleo_comercioId_fkey"
      FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "HojaDeVida" (
  "id"               SERIAL NOT NULL,
  "usuarioId"        INTEGER NOT NULL,
  "resumenPerfil"    TEXT,
  "telefonoContacto" TEXT NOT NULL,
  "experiencia"      JSONB NOT NULL,
  "educacion"        JSONB NOT NULL,
  "habilidades"      TEXT[] NOT NULL DEFAULT '{}',
  "disponibilidad"   TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HojaDeVida_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HojaDeVida_usuarioId_key" ON "HojaDeVida"("usuarioId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'HojaDeVida_usuarioId_fkey') THEN
    ALTER TABLE "HojaDeVida" ADD CONSTRAINT "HojaDeVida_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PostulacionEmpleo" (
  "id"              SERIAL NOT NULL,
  "ofertaEmpleoId"  INTEGER NOT NULL,
  "postulanteId"    INTEGER NOT NULL,
  "hojaDeVidaId"    INTEGER NOT NULL,
  "experienciaSnap" JSONB NOT NULL,
  "educacionSnap"   JSONB NOT NULL,
  "habilidadesSnap" TEXT[] NOT NULL DEFAULT '{}',
  "mensaje"         TEXT,
  "estado"          "EstadoPostulacionEmpleo" NOT NULL DEFAULT 'ENVIADA',
  "vistaAt"         TIMESTAMP(3),
  "notasPublicador" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PostulacionEmpleo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PostulacionEmpleo_ofertaEmpleoId_postulanteId_key" ON "PostulacionEmpleo"("ofertaEmpleoId", "postulanteId");
CREATE INDEX IF NOT EXISTS "PostulacionEmpleo_ofertaEmpleoId_estado_idx" ON "PostulacionEmpleo"("ofertaEmpleoId", "estado");
CREATE INDEX IF NOT EXISTS "PostulacionEmpleo_postulanteId_idx" ON "PostulacionEmpleo"("postulanteId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PostulacionEmpleo_ofertaEmpleoId_fkey') THEN
    ALTER TABLE "PostulacionEmpleo" ADD CONSTRAINT "PostulacionEmpleo_ofertaEmpleoId_fkey"
      FOREIGN KEY ("ofertaEmpleoId") REFERENCES "OfertaEmpleo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PostulacionEmpleo_postulanteId_fkey') THEN
    ALTER TABLE "PostulacionEmpleo" ADD CONSTRAINT "PostulacionEmpleo_postulanteId_fkey"
      FOREIGN KEY ("postulanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
