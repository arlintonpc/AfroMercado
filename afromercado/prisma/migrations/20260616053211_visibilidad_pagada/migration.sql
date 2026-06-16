-- DropForeignKey
ALTER TABLE "ReviewProducto" DROP CONSTRAINT "ReviewProducto_compradorId_fkey";

-- DropForeignKey
ALTER TABLE "ReviewProducto" DROP CONSTRAINT "ReviewProducto_productoId_fkey";

-- AlterTable
ALTER TABLE "Config" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "VisibilidadPagada" (
    "id" SERIAL NOT NULL,
    "comercioId" INTEGER NOT NULL,
    "productoId" INTEGER,
    "tipo" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "montoCOP" DECIMAL(10,2) NOT NULL,
    "notas" TEXT,
    "creadoPor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisibilidadPagada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisibilidadPagada_tipo_activa_fin_idx" ON "VisibilidadPagada"("tipo", "activa", "fin");

-- CreateIndex
CREATE INDEX "VisibilidadPagada_comercioId_idx" ON "VisibilidadPagada"("comercioId");

-- AddForeignKey
ALTER TABLE "ReviewProducto" ADD CONSTRAINT "ReviewProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewProducto" ADD CONSTRAINT "ReviewProducto_compradorId_fkey" FOREIGN KEY ("compradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisibilidadPagada" ADD CONSTRAINT "VisibilidadPagada_comercioId_fkey" FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisibilidadPagada" ADD CONSTRAINT "VisibilidadPagada_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisibilidadPagada" ADD CONSTRAINT "VisibilidadPagada_creadoPor_fkey" FOREIGN KEY ("creadoPor") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
