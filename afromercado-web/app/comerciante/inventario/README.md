# Interfaz de inventario operativo

Esta ruta entrega solamente la experiencia de comerciante en
`/comerciante/inventario`. No incluye cambios en backend, Prisma ni en la capa
API compartida.

## Contrato esperado

- `GET /api/inventario` devuelve `{ data: { resumen, productos, movimientosRecientes } }`.
- `GET /api/inventario/movimientos` acepta `productoId` y `tipo` opcionales.
- `POST /api/inventario/movimientos` recibe `productoId`, `tipo`, `cantidad`,
  `costoUnitario` opcional y `nota` opcional.

Las ventas se muestran en el historial, pero no pueden registrarse manualmente:
deben ser creadas por la confirmación transaccional del pedido. El backend de
Kardex definirá las validaciones, el costo promedio y la auditoría inmutable.
