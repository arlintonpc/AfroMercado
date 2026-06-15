-- Índices para búsqueda eficiente en AfroMercado
-- Ejecutar manualmente: psql -U postgres -d afromercado -f add_search_indexes.sql

-- Índice para filtros compuestos principales
CREATE INDEX IF NOT EXISTS idx_producto_activo_stock
ON "Producto" (activo, stock, "deletedAt")
WHERE activo = true AND "deletedAt" IS NULL;

-- Índice para precio
CREATE INDEX IF NOT EXISTS idx_producto_precio
ON "Producto" (precio)
WHERE activo = true AND "deletedAt" IS NULL;

-- Índice para municipio del comercio
CREATE INDEX IF NOT EXISTS idx_comercio_municipio
ON "Comercio" (municipio, activo)
WHERE activo = true;

-- Índice para categoría
CREATE INDEX IF NOT EXISTS idx_producto_categoria
ON "Producto" ("categoriaId", activo)
WHERE activo = true;
