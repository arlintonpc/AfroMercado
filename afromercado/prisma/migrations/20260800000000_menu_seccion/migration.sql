-- CreateTable
CREATE TABLE IF NOT EXISTS "MenuSeccion" (
    "id" SERIAL NOT NULL,
    "configExpressId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "icono" TEXT NOT NULL DEFAULT '🍽️',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MenuSeccion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "menuSeccionId" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MenuSeccion_configExpressId_activo_idx" ON "MenuSeccion"("configExpressId", "activo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Producto_menuSeccionId_idx" ON "Producto"("menuSeccionId");

-- AddForeignKey
ALTER TABLE "MenuSeccion" ADD CONSTRAINT "MenuSeccion_configExpressId_fkey"
    FOREIGN KEY ("configExpressId") REFERENCES "ConfigExpress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_menuSeccionId_fkey"
    FOREIGN KEY ("menuSeccionId") REFERENCES "MenuSeccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
