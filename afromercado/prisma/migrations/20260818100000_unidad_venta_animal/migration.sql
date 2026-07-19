-- Agrega ANIMAL a UnidadVenta para vender animales de cría (gallinas,
-- cerdos, peces) por unidad, en vez de forzar UNIDAD generico.

ALTER TYPE "UnidadVenta" ADD VALUE IF NOT EXISTS 'ANIMAL';
