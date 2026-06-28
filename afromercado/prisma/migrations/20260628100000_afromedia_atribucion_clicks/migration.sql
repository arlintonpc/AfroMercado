-- CreateTable
CREATE TABLE "PublicidadEvento" (
    "id" SERIAL NOT NULL,
    "visibilidadId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "comercioId" INTEGER NOT NULL,
    "usuarioId" INTEGER,
    "sesionId" TEXT,
    "tipo" TEXT NOT NULL,
    "userAgent" TEXT,
    "referer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicidadEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicidadAtribucion" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "pedidoItemId" INTEGER NOT NULL,
    "visibilidadId" INTEGER NOT NULL,
    "publicidadEventoId" INTEGER,
    "productoId" INTEGER NOT NULL,
    "usuarioId" INTEGER,
    "sesionId" TEXT,
    "cantidad" INTEGER NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "modelo" TEXT NOT NULL DEFAULT 'ULTIMO_CLIC_7D',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicidadAtribucion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicidadEvento_visibilidadId_tipo_createdAt_idx" ON "PublicidadEvento"("visibilidadId", "tipo", "createdAt");

-- CreateIndex
CREATE INDEX "PublicidadEvento_productoId_tipo_createdAt_idx" ON "PublicidadEvento"("productoId", "tipo", "createdAt");

-- CreateIndex
CREATE INDEX "PublicidadEvento_usuarioId_productoId_tipo_createdAt_idx" ON "PublicidadEvento"("usuarioId", "productoId", "tipo", "createdAt");

-- CreateIndex
CREATE INDEX "PublicidadEvento_sesionId_productoId_tipo_createdAt_idx" ON "PublicidadEvento"("sesionId", "productoId", "tipo", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublicidadAtribucion_pedidoItemId_modelo_key" ON "PublicidadAtribucion"("pedidoItemId", "modelo");

-- CreateIndex
CREATE INDEX "PublicidadAtribucion_pedidoId_idx" ON "PublicidadAtribucion"("pedidoId");

-- CreateIndex
CREATE INDEX "PublicidadAtribucion_visibilidadId_createdAt_idx" ON "PublicidadAtribucion"("visibilidadId", "createdAt");

-- CreateIndex
CREATE INDEX "PublicidadAtribucion_usuarioId_productoId_createdAt_idx" ON "PublicidadAtribucion"("usuarioId", "productoId", "createdAt");
