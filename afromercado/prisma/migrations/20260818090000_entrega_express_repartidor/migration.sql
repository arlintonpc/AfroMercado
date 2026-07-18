-- Anexo B, Fase 5: conecta Express al sistema de Entrega/Repartidor que ya
-- usa Marketplace. Auditoría previa (docs/teravia/08-arquitectura-plataforma-
-- nucleo-vs-verticales.md, sección 3.5) descartó unificar con Transporte
-- fluvial (no hay solapamiento real) y encontró que PedidoExpress.repartidorId
-- existía en el schema pero nunca se leía ni escribía en ningún controller/
-- service — se elimina aquí como parte de conectar el mecanismo real.

-- 1. Modo de entrega por restaurante Express (PROPIO por defecto: el
--    comerciante ya tiene su propio domiciliario, sin cambio de comportamiento
--    para nadie hasta que decida activar PLATAFORMA).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoEntregaDomicilio') THEN
    CREATE TYPE "TipoEntregaDomicilio" AS ENUM ('PROPIO', 'PLATAFORMA');
  END IF;
END $$;
ALTER TABLE "ConfigExpress" ADD COLUMN IF NOT EXISTS "tipoEntregaDomicilio" "TipoEntregaDomicilio" NOT NULL DEFAULT 'PROPIO';

-- 2. Entrega gana un segundo origen válido (PedidoExpress), mutuamente
--    excluyente con subPedidoId. subPedidoId pasa a nullable (ya no es
--    obligatorio que toda Entrega venga de Marketplace).
ALTER TABLE "Entrega" ALTER COLUMN "subPedidoId" DROP NOT NULL;
ALTER TABLE "Entrega" ADD COLUMN IF NOT EXISTS "pedidoExpressId" INTEGER;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Entrega_pedidoExpressId_key') THEN
    ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_pedidoExpressId_key" UNIQUE ("pedidoExpressId");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Entrega_pedidoExpressId_fkey') THEN
    ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_pedidoExpressId_fkey" FOREIGN KEY ("pedidoExpressId") REFERENCES "PedidoExpress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
-- Exactamente uno de los dos orígenes debe estar presente — nunca ambos, nunca ninguno.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Entrega_origen_unico_check') THEN
    ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_origen_unico_check"
      CHECK (("subPedidoId" IS NOT NULL AND "pedidoExpressId" IS NULL) OR ("subPedidoId" IS NULL AND "pedidoExpressId" IS NOT NULL));
  END IF;
END $$;

-- 3. PedidoExpress.repartidorId — campo muerto (nunca leído ni escrito por
--    ningún controller/service), reemplazado por Entrega.repartidorId como
--    única fuente de verdad de quién entrega.
ALTER TABLE "PedidoExpress" DROP CONSTRAINT IF EXISTS "PedidoExpress_repartidorId_fkey";
ALTER TABLE "PedidoExpress" DROP COLUMN IF EXISTS "repartidorId";
