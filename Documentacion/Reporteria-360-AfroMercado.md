# Reporteria 360 AfroMercado

## Objetivo

Convertir el modulo de reportes en un centro de inteligencia para decidir crecimiento, operacion, pagos, confianza comercial, categorias y expansion territorial.

## Rol recomendado

**Product Analytics Lead para Marketplace AfroMercado**

Responsable de convertir datos de ventas, comercios, productos, pagos, clientes y logistica en decisiones accionables para administracion, crecimiento, operaciones y finanzas.

## Frentes implementados

### Dashboard ejecutivo

- Comision de plataforma.
- GMV.
- Pedidos confirmados.
- Ticket promedio.
- Comercios activos.
- Compradores nuevos.
- Neto a comercios.
- Pagos pendientes de verificacion.
- Lectura rapida de categoria, producto, territorio y comercio lider.

### Territorio

- Ventas por municipio del comercio.
- Ventas por departamento y municipio de destino del comprador.
- Compradores, comercios, pedidos, GMV, comision y ticket promedio por territorio.

### Categorias

- Ranking de categorias por GMV.
- Productos vendidos por categoria.
- Comercios participantes por categoria.
- Pedidos, unidades, GMV y comision estimada.

### Productos

- Ranking global de productos lideres.
- Categoria, comercio, municipio, pedidos, unidades, GMV, vistas y conversion.

### Comercios

- Ranking por comision generada.
- GMV, pedidos, neto y calificacion.
- Comercios en riesgo por baja o nula venta.

### Operacion

- Pagos por estado.
- Pagos por metodo.
- Dispersiones a comercios por estado.
- Entregas por estado.
- Zonas logisticas criticas.
- Productividad por repartidor.

### Alertas inteligentes

- Productos agotados con demanda reciente.
- Productos con muchas vistas pero sin venta.
- Pagos en estado de atencion.
- Dispersiones fallidas o pendientes por mas de 24 horas.
- Comercios con caida fuerte frente al periodo anterior.
- Zonas con tasa relevante de entregas fallidas.

### Clientes

- Compradores activos.
- Compradores nuevos.
- Compradores recurrentes.
- Pedidos, GMV y ticket promedio.
- Top compradores.
- Compradores por territorio.

### Campanas y retencion

- ROI de cupones.
- Resultado neto por campana.
- Cohortes de retencion por mes.

## Endpoints nuevos

- `GET /reportes/admin/categorias?desde&hasta&limite`
- `GET /reportes/admin/productos?desde&hasta&limite`
- `GET /reportes/admin/territorios?desde&hasta&limite`
- `GET /reportes/admin/pagos?desde&hasta`
- `GET /reportes/admin/logistica?desde&hasta&limite`
- `GET /reportes/admin/clientes?desde&hasta&limite`
- `GET /reportes/admin/alertas?desde&hasta`

## Exportacion Excel

El Excel maestro de admin ahora incluye hojas adicionales:

- `Categorias`
- `Productos top`
- `Territorios`
- `Pagos y dispersion`
- `Logistica`
- `Clientes`
- `Alertas`
- `Liquidacion`

## Validaciones realizadas

- `node --check` en controlador, repositorio, rutas y servicio Excel.
- `npm test` en backend.
- `npm run lint` en frontend.
- `npm run build` en frontend.
- Prueba de humo contra base local para los nuevos reportes admin.

## Siguiente fase recomendada

- Graficos mas visuales por categoria, territorio y producto.
- Filtros cruzados por categoria, municipio, comercio y metodo de pago.
- Mapas de calor por region.
- Alertas automaticas: comercio con caida de ventas, producto agotado con alta demanda, categoria creciendo, dispersion fallida.
- Exportes segmentados por rol: finanzas, operaciones, crecimiento y administracion.
