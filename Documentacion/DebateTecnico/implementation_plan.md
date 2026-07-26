# Plan De Implementacion: Mesa 11 - Fase 1

## Estado
`APROBADA` por el dueño del producto el 25 de julio de 2026.

La implementacion de tablas de Kardex y calculos de margen permanece
condicionada al cierre de la Fase 0 financiera.

## Prerrequisito: Fase 0 Financiera

Estado tecnico: `VERIFICADA`.

Estado de politica financiera de cupones: `BLOQUEADA` hasta decision del
dueno del producto.

Implementado en el arbol de trabajo:

- Propiedad de instrucciones de pago.
- Idempotencia aislada por usuario, pedido y operacion.
- Bloqueo de pedido para serializar pago, cancelacion, confirmacion y rechazo.
- Conciliacion segura de aprobaciones tardias sin descontar stock.
- Reintento de webhooks previamente registrados pero no procesados.
- Validacion de identificadores contradictorios de pasarela.
- Reclamo temporal e idempotente de dispersiones pendientes o fallidas.
- Historial de precios atomico y serializado.
- ROI de cupones agregado primero por pedido.

Evidencia de cierre tecnico:

- Auditoria independiente final sin bloqueadores altos ni criticos.
- QA independiente aprobado para correlacion de webhooks, aprobaciones
  tardias, reintentos, backoff e idempotencia de dispersiones.
- `npm run test:vitest`: 50/50; pruebas focalizadas finales: 23/23.
- `npm test`: 157/157.
- Pruebas operativas no destructivas contra PostgreSQL confirmaron espera de
  locks de pedido y producto, un solo reclamo de lease y ausencia de doble
  liberacion.
- Pendiente no bloqueante: E2E HTTP y validacion con sandbox real de Wompi.

Decision bloqueante del dueño del producto:

- Definir si el descuento lo financia Teravia, el comercio, un programa externo
  o una combinacion.
- Definir el momento de consumo y liberacion del cupon.
- Definir GMV y tratamiento de IVA de forma uniforme.
- Persistir la asignacion del descuento y su financiador por subpedido antes de
  calcular margen o modificar liquidaciones.

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
