ALTER TABLE "PedidoItem" ADD COLUMN IF NOT EXISTS "ofertaId" INTEGER;

DO $$ BEGIN
  ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_ofertaId_fkey"
    FOREIGN KEY ("ofertaId") REFERENCES "Oferta"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "PedidoItem_ofertaId_idx" ON "PedidoItem"("ofertaId");
