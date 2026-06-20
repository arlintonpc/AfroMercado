-- Agregar costoEnvio a Pedido
ALTER TABLE "Pedido"
  ADD COLUMN IF NOT EXISTS "costoEnvio" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS "Pedido_compradorId_idx" ON "Pedido"("compradorId");
CREATE INDEX IF NOT EXISTS "SubPedido_comercioId_idx" ON "SubPedido"("comercioId");
CREATE INDEX IF NOT EXISTS "SubPedido_pedidoId_idx" ON "SubPedido"("pedidoId");
CREATE INDEX IF NOT EXISTS "Entrega_repartidorId_idx" ON "Entrega"("repartidorId");
CREATE INDEX IF NOT EXISTS "Pago_pedidoId_idx" ON "Pago"("pedidoId");
