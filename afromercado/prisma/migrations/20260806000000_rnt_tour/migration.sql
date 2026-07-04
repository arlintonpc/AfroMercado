-- RNT en ConfigTour (mismo patron que ConfigHotel)
ALTER TABLE "ConfigTour"
  ADD COLUMN IF NOT EXISTS "rnt" TEXT,
  ADD COLUMN IF NOT EXISTS "rntVerificado" BOOLEAN NOT NULL DEFAULT false;
