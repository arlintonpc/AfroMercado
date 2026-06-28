-- CreateTable
CREATE TABLE "SolicitudPublicidad" (
    "id" SERIAL NOT NULL,
    "comercioId" INTEGER NOT NULL,
    "productoId" INTEGER,
    "paquete" TEXT NOT NULL,
    "objetivo" TEXT NOT NULL,
    "presupuestoCOP" DECIMAL(12,2),
    "inicio" TIMESTAMP(3),
    "fin" TIMESTAMP(3),
    "mensaje" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "notasAdmin" TEXT,
    "revisadoPor" INTEGER,
    "revisadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitudPublicidad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitudPublicidad_estado_createdAt_idx" ON "SolicitudPublicidad"("estado", "createdAt");

-- CreateIndex
CREATE INDEX "SolicitudPublicidad_comercioId_createdAt_idx" ON "SolicitudPublicidad"("comercioId", "createdAt");

-- CreateIndex
CREATE INDEX "SolicitudPublicidad_productoId_idx" ON "SolicitudPublicidad"("productoId");

-- AddForeignKey
ALTER TABLE "SolicitudPublicidad" ADD CONSTRAINT "SolicitudPublicidad_comercioId_fkey" FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudPublicidad" ADD CONSTRAINT "SolicitudPublicidad_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudPublicidad" ADD CONSTRAINT "SolicitudPublicidad_revisadoPor_fkey" FOREIGN KEY ("revisadoPor") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
