# Plan De Implementacion: Mesa 11 - Fase 1

## Estado
`APROBADA` por el dueño del producto el 25 de julio de 2026.

## Objetivo
Dar a cada comercio un control operativo verificable de inventario, costos y compras. No reemplaza la contabilidad legal, la facturacion electronica ni la conciliacion bancaria.

## Alcance
- Costo unitario vigente por producto y fecha de actualizacion.
- Compras manuales con proveedor opcional, comprobante y estado.
- Entrada de inventario al recibir una compra.
- Movimientos auditables: compra, ajuste, merma, devolucion y venta.
- Resumen: ventas confirmadas, costo de ventas estimado, margen bruto, valor estimado de inventario y alertas de stock.
- Reporte descargable de movimientos y compras de la Fase 1.

## Fuera De Alcance
- Libro diario, balance general o declaracion tributaria.
- Conciliacion bancaria automatica, retiros o cambios a Wompi.
- Bodegas multiples, variantes y traslados entre bodegas.
- PEPS: Fase 1 usara costo promedio vigente; PEPS requiere capas de inventario y una fase separada.

## Eventos Y Fuente De Verdad
- Las ventas se leen de subpedidos confirmados y no se duplican como compras manuales.
- El stock reservado mantiene su comportamiento actual.
- Todo ajuste manual crea un movimiento antes de modificar el stock.
- Una compra recibida crea una entrada y actualiza el costo promedio dentro de una transaccion.

## Responsables
- Propuesta UX y criterios visibles: Gemini.
- Implementacion e integracion: Codex.
- Revision de datos, DDL, permisos y concurrencia: Claude.
- Verificacion de cierre: Codex, con evidencia de API, pruebas y interfaz.

## Criterios De Cierre
- Un comerciante solo puede ver y modificar datos de su propio comercio.
- Un movimiento no puede dejar el stock por debajo de cero.
- Una recepcion de compra es idempotente y no duplica existencias.
- Las ventas confirmadas conservan el control atomico actual de stock.
- Se cubren pruebas de permisos, movimientos, costo promedio y resumen.
- Se validan lint, pruebas backend, TypeScript y una prueba manual de interfaz.

## Reversion
- Las nuevas tablas y campos se agregan sin alterar historicos.
- Los movimientos no se eliminan: se corrigen mediante movimiento compensatorio.
- Si se desactiva la interfaz, el stock y los pedidos actuales siguen operando con sus rutas existentes.
