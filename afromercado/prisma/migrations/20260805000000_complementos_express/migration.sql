-- Complementos Express: grupos de add-ons por producto

ALTER TABLE "ItemPedidoExpress" ADD COLUMN IF NOT EXISTS "complementos" JSONB;

CREATE TABLE IF NOT EXISTS "GrupoComplemento" (
    "id"         SERIAL PRIMARY KEY,
    "productoId" INTEGER NOT NULL,
    "nombre"     TEXT NOT NULL,
    "minimo"     INTEGER NOT NULL DEFAULT 0,
    "maximo"     INTEGER NOT NULL DEFAULT 1,
    "requerido"  BOOLEAN NOT NULL DEFAULT false,
    "orden"      INTEGER NOT NULL DEFAULT 0,
    "activo"     BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "ItemComplemento" (
    "id"                 SERIAL PRIMARY KEY,
    "grupoComplementoId" INTEGER NOT NULL,
    "nombre"             TEXT NOT NULL,
    "precio"             DECIMAL(12,2) NOT NULL DEFAULT 0,
    "disponible"         BOOLEAN NOT NULL DEFAULT true,
    "orden"              INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "GrupoComplemento_productoId_idx" ON "GrupoComplemento"("productoId");
CREATE INDEX IF NOT EXISTS "ItemComplemento_grupoComplementoId_idx" ON "ItemComplemento"("grupoComplementoId");

ALTER TABLE "GrupoComplemento" ADD CONSTRAINT "GrupoComplemento_productoId_fkey"
  FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE;

ALTER TABLE "ItemComplemento" ADD CONSTRAINT "ItemComplemento_grupoComplementoId_fkey"
  FOREIGN KEY ("grupoComplementoId") REFERENCES "GrupoComplemento"("id") ON DELETE CASCADE;
