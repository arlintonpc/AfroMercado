-- Denuncias de ofertas de empleo (falsas, explotacion laboral, discriminatorias,
-- estafa, etc.). El admin puede desestimar, bloquear solo la oferta denunciada,
-- o bloquear la cuenta completa del publicador.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MotivoDenunciaEmpleo') THEN
    CREATE TYPE "MotivoDenunciaEmpleo" AS ENUM ('OFERTA_FALSA','EXPLOTACION_LABORAL','DISCRIMINATORIA','ESTAFA_DINERO','CONTENIDO_INAPROPIADO','OTRO');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoDenunciaEmpleo') THEN
    CREATE TYPE "EstadoDenunciaEmpleo" AS ENUM ('PENDIENTE','DESESTIMADA','OFERTA_BLOQUEADA','CUENTA_BLOQUEADA');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "DenunciaOfertaEmpleo" (
  "id"             SERIAL PRIMARY KEY,
  "ofertaEmpleoId" INTEGER NOT NULL,
  "denuncianteId"  INTEGER NOT NULL,
  "motivo"         "MotivoDenunciaEmpleo" NOT NULL,
  "descripcion"    TEXT,
  "estado"         "EstadoDenunciaEmpleo" NOT NULL DEFAULT 'PENDIENTE',
  "revisadoPor"    INTEGER,
  "revisadoAt"     TIMESTAMP(3),
  "notaRevision"   TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "DenunciaOfertaEmpleo_ofertaEmpleoId_denuncianteId_key" ON "DenunciaOfertaEmpleo"("ofertaEmpleoId", "denuncianteId");
CREATE INDEX IF NOT EXISTS "DenunciaOfertaEmpleo_estado_createdAt_idx" ON "DenunciaOfertaEmpleo"("estado", "createdAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DenunciaOfertaEmpleo_ofertaEmpleoId_fkey') THEN
    ALTER TABLE "DenunciaOfertaEmpleo" ADD CONSTRAINT "DenunciaOfertaEmpleo_ofertaEmpleoId_fkey" FOREIGN KEY ("ofertaEmpleoId") REFERENCES "OfertaEmpleo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DenunciaOfertaEmpleo_denuncianteId_fkey') THEN
    ALTER TABLE "DenunciaOfertaEmpleo" ADD CONSTRAINT "DenunciaOfertaEmpleo_denuncianteId_fkey" FOREIGN KEY ("denuncianteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
