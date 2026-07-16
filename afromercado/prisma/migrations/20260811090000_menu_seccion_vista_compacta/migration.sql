-- Vista compacta para secciones de menú (ideal para bebidas: fila con
-- cantidad rápida, sin foto grande ni ficha de detalle)
ALTER TABLE "MenuSeccion" ADD COLUMN IF NOT EXISTS "vistaCompacta" BOOLEAN NOT NULL DEFAULT false;
