-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TipoOferta" AS ENUM ('PORCENTAJE', 'VALOR_FIJO');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Oferta" (
    "id"          SERIAL         NOT NULL,
    "productoId"  INTEGER        NOT NULL,
    "tipo"        "TipoOferta"   NOT NULL,
    "valor"       DECIMAL(10,2)  NOT NULL,
    "etiqueta"    TEXT,
    "inicio"      TIMESTAMP(3)   NOT NULL,
    "fin"         TIMESTAMP(3)   NOT NULL,
    "activa"      BOOLEAN        NOT NULL DEFAULT true,
    "stockLimite" INTEGER,
    "stockUsado"  INTEGER        NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Oferta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Oferta_productoId_activa_fin_idx" ON "Oferta"("productoId", "activa", "fin");
CREATE INDEX IF NOT EXISTS "Oferta_activa_fin_idx"            ON "Oferta"("activa", "fin");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Oferta" ADD CONSTRAINT "Oferta_productoId_fkey"
    FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
