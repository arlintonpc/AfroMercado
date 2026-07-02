-- Biblioteca reutilizable de complementos Express.
-- Permite crear grupos una sola vez por comercio y vincularlos a muchos platos.

CREATE TABLE IF NOT EXISTS "GrupoComplementoBiblioteca" (
  "id" SERIAL PRIMARY KEY,
  "comercioId" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "minimo" INTEGER NOT NULL DEFAULT 0,
  "maximo" INTEGER NOT NULL DEFAULT 1,
  "requerido" BOOLEAN NOT NULL DEFAULT false,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GrupoComplementoBiblioteca_comercioId_fkey"
    FOREIGN KEY ("comercioId") REFERENCES "Comercio"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ItemComplementoBiblioteca" (
  "id" SERIAL PRIMARY KEY,
  "grupoBibliotecaId" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "icono" TEXT,
  "imagenUrl" TEXT,
  "precio" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "disponible" BOOLEAN NOT NULL DEFAULT true,
  "orden" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ItemComplementoBiblioteca_grupoBibliotecaId_fkey"
    FOREIGN KEY ("grupoBibliotecaId") REFERENCES "GrupoComplementoBiblioteca"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ProductoGrupoComplemento" (
  "id" SERIAL PRIMARY KEY,
  "productoId" INTEGER NOT NULL,
  "grupoBibliotecaId" INTEGER NOT NULL,
  "minimoOverride" INTEGER,
  "maximoOverride" INTEGER,
  "requeridoOverride" BOOLEAN,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductoGrupoComplemento_productoId_fkey"
    FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductoGrupoComplemento_grupoBibliotecaId_fkey"
    FOREIGN KEY ("grupoBibliotecaId") REFERENCES "GrupoComplementoBiblioteca"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "GrupoComplementoBiblioteca_comercioId_nombre_key"
  ON "GrupoComplementoBiblioteca"("comercioId", "nombre");
CREATE INDEX IF NOT EXISTS "GrupoComplementoBiblioteca_comercioId_idx"
  ON "GrupoComplementoBiblioteca"("comercioId");
CREATE INDEX IF NOT EXISTS "ItemComplementoBiblioteca_grupoBibliotecaId_idx"
  ON "ItemComplementoBiblioteca"("grupoBibliotecaId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductoGrupoComplemento_productoId_grupoBibliotecaId_key"
  ON "ProductoGrupoComplemento"("productoId", "grupoBibliotecaId");
CREATE INDEX IF NOT EXISTS "ProductoGrupoComplemento_productoId_idx"
  ON "ProductoGrupoComplemento"("productoId");
CREATE INDEX IF NOT EXISTS "ProductoGrupoComplemento_grupoBibliotecaId_idx"
  ON "ProductoGrupoComplemento"("grupoBibliotecaId");
