CREATE TABLE IF NOT EXISTS "TourLugar" (
  "id" SERIAL PRIMARY KEY,
  "configTourId" INTEGER NOT NULL,
  "titulo" TEXT NOT NULL,
  "descripcion" TEXT,
  "tipo" TEXT,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "duracionMinutos" INTEGER,
  "recomendaciones" TEXT,
  "latitud" DOUBLE PRECISION,
  "longitud" DOUBLE PRECISION,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "destacado" BOOLEAN NOT NULL DEFAULT false,
  "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TourLugar_configTourId_fkey"
    FOREIGN KEY ("configTourId") REFERENCES "ConfigTour"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "TourLugarMedia" (
  "id" SERIAL PRIMARY KEY,
  "tourLugarId" INTEGER NOT NULL,
  "tipo" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "posterUrl" TEXT,
  "titulo" TEXT,
  "descripcion" TEXT,
  "plataforma" TEXT,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "publicId" TEXT,
  "duracionSegundos" DOUBLE PRECISION,
  "bytes" INTEGER,
  "formato" TEXT,
  "mimeType" TEXT,
  "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TourLugarMedia_tourLugarId_fkey"
    FOREIGN KEY ("tourLugarId") REFERENCES "TourLugar"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TourLugar_configTourId_orden_idx"
  ON "TourLugar"("configTourId", "orden");

CREATE INDEX IF NOT EXISTS "TourLugar_configTourId_activo_idx"
  ON "TourLugar"("configTourId", "activo");

CREATE INDEX IF NOT EXISTS "TourLugarMedia_tourLugarId_orden_idx"
  ON "TourLugarMedia"("tourLugarId", "orden");

CREATE INDEX IF NOT EXISTS "TourLugarMedia_tipo_idx"
  ON "TourLugarMedia"("tipo");
