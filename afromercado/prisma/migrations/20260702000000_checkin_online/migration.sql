ALTER TABLE "ReservaHotel"
  ADD COLUMN IF NOT EXISTS "checkinOnlineAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "docTipo"               TEXT,
  ADD COLUMN IF NOT EXISTS "docNumero"             TEXT,
  ADD COLUMN IF NOT EXISTS "horaEstimadaLlegada"   TEXT,
  ADD COLUMN IF NOT EXISTS "solicitudesEspeciales" TEXT,
  ADD COLUMN IF NOT EXISTS "tokenCheckin"          TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS "ReservaHotel_tokenCheckin_idx" ON "ReservaHotel"("tokenCheckin");
