-- AlterTable: add usuarioId to VistaProducto
ALTER TABLE "VistaProducto" ADD COLUMN "usuarioId" INTEGER;

-- AddForeignKey for VistaProducto.usuarioId
ALTER TABLE "VistaProducto" ADD CONSTRAINT "VistaProducto_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex for VistaProducto.usuarioId
CREATE INDEX "VistaProducto_usuarioId_createdAt_idx" ON "VistaProducto"("usuarioId", "createdAt");

-- CreateTable: Notificacion
CREATE TABLE "Notificacion" (
  "id" SERIAL NOT NULL,
  "usuarioId" INTEGER NOT NULL,
  "tipo" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "mensaje" TEXT NOT NULL,
  "leida" BOOLEAN NOT NULL DEFAULT false,
  "url" TEXT,
  "datos" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Notificacion_usuarioId_leida_createdAt_idx"
  ON "Notificacion"("usuarioId", "leida", "createdAt");

-- CreateTable: Favorito
CREATE TABLE "Favorito" (
  "id" SERIAL NOT NULL,
  "usuarioId" INTEGER NOT NULL,
  "productoId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Favorito_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Favorito" ADD CONSTRAINT "Favorito_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Favorito" ADD CONSTRAINT "Favorito_productoId_fkey"
  FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Favorito_usuarioId_productoId_key" ON "Favorito"("usuarioId", "productoId");
CREATE INDEX "Favorito_usuarioId_createdAt_idx" ON "Favorito"("usuarioId", "createdAt");

-- CreateTable: BusquedaHistorial
CREATE TABLE "BusquedaHistorial" (
  "id" SERIAL NOT NULL,
  "usuarioId" INTEGER,
  "sesionId" TEXT,
  "query" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusquedaHistorial_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BusquedaHistorial" ADD CONSTRAINT "BusquedaHistorial_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BusquedaHistorial_usuarioId_createdAt_idx" ON "BusquedaHistorial"("usuarioId", "createdAt");
CREATE INDEX "BusquedaHistorial_sesionId_createdAt_idx" ON "BusquedaHistorial"("sesionId", "createdAt");
