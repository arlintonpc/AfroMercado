-- Búsqueda insensible a acentos (español) + índices de catálogo.
-- Esta migración es idempotente: se puede aplicar varias veces sin error.

-- Extensión para búsqueda sin acentos: unaccent('Borojó') -> 'Borojo'
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Índices para filtros y orden del catálogo
CREATE INDEX IF NOT EXISTS idx_producto_activo_stock
  ON "Producto" (activo, stock, "deletedAt")
  WHERE activo = true AND "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_producto_precio
  ON "Producto" (precio)
  WHERE activo = true AND "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_comercio_municipio
  ON "Comercio" (municipio, activo)
  WHERE activo = true;

CREATE INDEX IF NOT EXISTS idx_producto_categoria
  ON "Producto" ("categoriaId", activo)
  WHERE activo = true;
