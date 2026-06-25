ALTER TYPE "EstadoLiquidacion" ADD VALUE IF NOT EXISTS 'CANCELADA';

ALTER TABLE "Entrega"
  ADD COLUMN IF NOT EXISTS "pagoRepartidor" DECIMAL(10,2);

WITH reglas AS (
  SELECT
    COALESCE(
      (SELECT "valor" FROM "Config" WHERE "clave" = 'repartidor_pago_modo' LIMIT 1),
      'fijo'
    ) AS modo,
    COALESCE(
      NULLIF((SELECT "valor" FROM "Config" WHERE "clave" = 'repartidor_pago_valor' LIMIT 1), '')::numeric,
      5000
    ) AS valor
),
subpedidos_por_pedido AS (
  SELECT "pedidoId", COUNT(*)::numeric AS cantidad
  FROM "SubPedido"
  GROUP BY "pedidoId"
)
UPDATE "Entrega" AS entrega
SET "pagoRepartidor" = CASE
  WHEN reglas.modo = 'porcentaje_envio' THEN
    ROUND(
      COALESCE(pedido."costoEnvio", 0) * (reglas.valor / 100)
      / GREATEST(conteo.cantidad, 1),
      0
    )
  ELSE ROUND(reglas.valor, 0)
END
FROM "SubPedido" AS subpedido
JOIN "Pedido" AS pedido ON pedido."id" = subpedido."pedidoId"
JOIN subpedidos_por_pedido AS conteo ON conteo."pedidoId" = pedido."id"
CROSS JOIN reglas
WHERE entrega."subPedidoId" = subpedido."id"
  AND entrega."estado" = 'ENTREGADA'
  AND entrega."pagoRepartidor" IS NULL;
