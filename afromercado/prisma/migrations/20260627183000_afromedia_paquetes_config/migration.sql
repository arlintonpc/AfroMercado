-- CreateTable
CREATE TABLE "PublicidadPaqueteConfig" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "ideal" TEXT,
    "precioBaseCOP" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "duracionDias" INTEGER NOT NULL DEFAULT 7,
    "cuposSugeridos" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "recomendado" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicidadPaqueteConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicidadPaqueteConfig_codigo_key" ON "PublicidadPaqueteConfig"("codigo");

-- CreateIndex
CREATE INDEX "PublicidadPaqueteConfig_activo_orden_idx" ON "PublicidadPaqueteConfig"("activo", "orden");

-- SeedData
INSERT INTO "PublicidadPaqueteConfig"
("codigo", "nombre", "descripcion", "ideal", "precioBaseCOP", "duracionDias", "cuposSugeridos", "activo", "recomendado", "orden", "color", "createdAt", "updatedAt")
VALUES
('IMPULSO_PRODUCTO', 'Impulso Producto', 'Aparece como producto patrocinado en catalogo y categorias relevantes.', 'Para vender stock disponible rapido.', 15000, 7, 12, true, true, 10, 'from-[#2D6A4F] to-[#52B788]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('HOME_DESTACADO', 'Home Destacado', 'Visibilidad fuerte en la portada, con contexto de tienda o producto.', 'Para lanzamientos, temporada o productos estrella.', 35000, 7, 6, true, true, 20, 'from-[#9B7300] to-[#D4A017]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('VIDEO_HISTORIA', 'Video Historia', 'Destaca un video corto de tu finca, cocina, taller, tienda o producto.', 'Para turismo, gastronomia y productos con historia.', 45000, 10, 4, true, false, 30, 'from-[#7B241C] to-[#C0392B]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('TEMPORADA_REGIONAL', 'Temporada Regional', 'Participa en rutas y vitrinas como Sabores del Pacifico o Artesanias del Choco.', 'Para vender por region, cultura o temporada.', 60000, 14, 5, true, false, 40, 'from-[#1A1A1A] to-[#2D6A4F]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('MARCA_ALIADA', 'Marca Aliada', 'Campana de posicionamiento para aliados, instituciones o marcas con afinidad cultural.', 'Para patrocinios, alianzas y contenido institucional.', 90000, 15, 3, true, false, 50, 'from-[#102018] to-[#D4A017]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
