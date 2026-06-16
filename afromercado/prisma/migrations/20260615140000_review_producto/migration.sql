CREATE TABLE "ReviewProducto" (
    "id"           SERIAL PRIMARY KEY,
    "productoId"   INTEGER NOT NULL,
    "compradorId"  INTEGER NOT NULL,
    "calificacion" INTEGER NOT NULL,
    "comentario"   TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewProducto_productoId_fkey"  FOREIGN KEY ("productoId")  REFERENCES "Producto"("id"),
    CONSTRAINT "ReviewProducto_compradorId_fkey" FOREIGN KEY ("compradorId") REFERENCES "Usuario"("id"),
    CONSTRAINT "ReviewProducto_compradorId_productoId_key" UNIQUE ("compradorId", "productoId")
);

CREATE INDEX "ReviewProducto_productoId_idx" ON "ReviewProducto"("productoId");
