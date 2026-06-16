-- CreateTable: VistaProducto para tracking de vistas orgánicas por producto
CREATE TABLE "VistaProducto" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "comercioId" INTEGER NOT NULL,
    "sesionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VistaProducto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VistaProducto_productoId_createdAt_idx" ON "VistaProducto"("productoId", "createdAt");
CREATE INDEX "VistaProducto_comercioId_createdAt_idx" ON "VistaProducto"("comercioId", "createdAt");

-- AddForeignKey
ALTER TABLE "VistaProducto" ADD CONSTRAINT "VistaProducto_productoId_fkey"
    FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VistaProducto" ADD CONSTRAINT "VistaProducto_comercioId_fkey"
    FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
