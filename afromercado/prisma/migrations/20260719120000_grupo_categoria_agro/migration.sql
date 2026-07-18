-- Agrega AGRO a GrupoCategoria para que el vertical de productores
-- agropecuarios (Capítulo 3 del Proyecto Maestro, sección 3.4.1) reutilice
-- la misma plomería ya construida para "Tienda Local" (filtro en
-- GET /api/productos, selector admin, toggle en /buscar) en vez de un
-- módulo transaccional paralelo.

ALTER TYPE "GrupoCategoria" ADD VALUE IF NOT EXISTS 'AGRO';
