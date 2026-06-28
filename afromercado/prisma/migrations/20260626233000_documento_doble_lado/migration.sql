ALTER TABLE "Comercio"
  ADD COLUMN "fotoDocumentoFrenteUrl" TEXT,
  ADD COLUMN "fotoDocumentoReversoUrl" TEXT;

UPDATE "Comercio"
SET "fotoDocumentoFrenteUrl" = "fotoDocumentoUrl"
WHERE "fotoDocumentoUrl" IS NOT NULL
  AND "fotoDocumentoFrenteUrl" IS NULL;
