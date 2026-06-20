-- AlterTable: añade código legible único a Pedido (AFM-YYMM-XXXX)
ALTER TABLE "Pedido" ADD COLUMN "codigo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_codigo_key" ON "Pedido"("codigo");
