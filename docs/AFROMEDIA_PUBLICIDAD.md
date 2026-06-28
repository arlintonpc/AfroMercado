# AfroMedia by AfroMercado

## Objetivo

AfroMedia es el modulo de publicidad nativa de AfroMercado. Su proposito es generar ingresos por visibilidad pagada sin danar la confianza del comprador ni convertir la plataforma en un sitio lleno de anuncios invasivos.

El modelo recomendado es retail media propio: productos, tiendas, videos, rutas, turismo, gastronomia y campanas regionales patrocinadas dentro del flujo natural de compra.

## Implementado

### Base de datos

Se agrego el modelo `SolicitudPublicidad`, se extendio `VisibilidadPagada` con metricas comerciales y se agrego `PublicidadPaqueteConfig` para precios configurables.

Archivo:

- `afromercado/prisma/schema.prisma`

Migracion:

- `afromercado/prisma/migrations/20260627153000_afromedia_solicitudes_publicidad/migration.sql`
- `afromercado/prisma/migrations/20260627170000_afromedia_metricas_visibilidad/migration.sql`
- `afromercado/prisma/migrations/20260627183000_afromedia_paquetes_config/migration.sql`
- `afromercado/prisma/migrations/20260627193000_afromedia_politicas_cupos/migration.sql`
- `afromercado/prisma/migrations/20260628100000_afromedia_atribucion_clicks/migration.sql`
- `afromercado/prisma/migrations/20260628103000_afromedia_cobro_pauta/migration.sql`

Campos principales:

- `comercioId`
- `productoId`
- `paquete`
- `objetivo`
- `presupuestoCOP`
- `inicio`
- `fin`
- `mensaje`
- `estado`
- `notasAdmin`
- `politicaAceptada`
- `politicaVersion`
- `politicaAceptadaAt`
- `politicaIp`
- `pagoEstado`
- `pagoMontoCOP`
- `pagoReferencia`
- `pagoProveedor`
- `pagoCheckoutUrl`
- `pagoProviderPaymentId`
- `pagoProviderReference`
- `pagoProviderStatus`
- `pagoProviderPayload`
- `pagoConfirmadoAt`
- `pagoExpiraAt`
- `pagoNotas`
- `revisadoPor`
- `revisadoAt`

Estados actuales:

- `PENDIENTE`
- `APROBADA`
- `RECHAZADA`
- `CONVERTIDA`

Estados de cobro publicitario:

- `PENDIENTE`: la solicitud aun no tiene checkout abierto.
- `EN_CHECKOUT`: la pasarela recibio la intencion de pago y se espera confirmacion.
- `PAGADA`: la pasarela o conciliacion admin confirmo el cobro.
- `FALLIDA`: la pasarela rechazo o fallo el pago.
- `VENCIDA`: el checkout expiro.
- `ANULADA`: el equipo anuló el cobro.
- `CORTESIA`: excepcion administrativa; permite activar sin cobro.

Metricas agregadas a `VisibilidadPagada`:

- `vistas`
- `clics`
- `carritos`
- `pedidosAtribuidos`
- `unidadesAtribuidas`
- `gmvAtribuido`

Modelos de atribucion:

- `PublicidadEvento`: registra eventos patrocinados `CLIC` y `CARRITO`.
- `PublicidadAtribucion`: registra que un item de pedido fue atribuido a una pauta.
- La clave unica `pedidoItemId + modelo` evita doble conteo por webhooks o reprocesos.

Campos principales de `PublicidadPaqueteConfig`:

- `codigo`
- `nombre`
- `descripcion`
- `ideal`
- `precioBaseCOP`
- `duracionDias`
- `cuposSugeridos`
- `activo`
- `recomendado`
- `orden`
- `color`

### Backend

Controlador:

- `afromercado/src/controllers/publicidad.controller.js`

Rutas de comerciante:

- `GET /api/publicidad/politicas`
- `GET /api/publicidad/paquetes`
- `GET /api/publicidad/mis-solicitudes`
- `POST /api/publicidad/solicitudes`
- `POST /api/publicidad/solicitudes/:id/pago/iniciar`

Rutas de administrador:

- `GET /api/admin/publicidad/resumen`
- `GET /api/admin/publicidad/analitica`
- `GET /api/admin/publicidad/exportar`
- `GET /api/admin/publicidad/paquetes`
- `PUT /api/admin/publicidad/paquetes/:codigo`
- `GET /api/admin/publicidad/solicitudes`
- `PATCH /api/admin/publicidad/solicitudes/:id`
- `PATCH /api/admin/publicidad/solicitudes/:id/pago`
- `POST /api/admin/publicidad/solicitudes/:id/convertir`

Rutas de medicion de pauta:

- `POST /api/productos/:id/vista`
- `POST /api/productos/:id/clic-patrocinado`
- `POST /api/productos/:id/carrito-patrocinado`

Reglas de seguridad aplicadas:

- Solo comercios aprobados y verificados pueden solicitar publicidad.
- El comercio debe tener cuenta de dispersion verificada.
- Si se pauta un producto, debe pertenecer al comercio.
- El producto debe estar activo y con stock.
- La solicitud no activa pauta automaticamente; queda pendiente de revision admin.
- Una solicitud aprobada puede convertirse automaticamente en visibilidad o campana desde el panel admin.
- Los clics y carritos solo se registran cuando el producto esta en una pauta activa.
- Las ventas se atribuyen cuando el pago queda confirmado.
- La atribucion principal usa ultimo clic patrocinado de los ultimos 7 dias.
- Si no hay clic atribuible, se conserva fallback por pauta activa al confirmar pago.
- Si el comerciante no envia presupuesto, se usa el precio base del paquete.
- Si el comerciante envia inicio pero no fin, se calcula el fin con la duracion configurada del paquete.
- Toda solicitud requiere aceptacion de politicas de publicidad.
- El backend guarda version, fecha e IP de aceptacion.
- El backend bloquea solicitudes, aprobaciones y conversiones si el paquete no tiene cupos disponibles.
- El comerciante solo puede iniciar pago cuando la solicitud esta `APROBADA`.
- La conversion a pauta activa exige `pagoEstado = PAGADA` o `pagoEstado = CORTESIA`.
- Wompi/Sandbox generan checkout propio para publicidad, separado de pedidos.
- El webhook de pagos tambien busca referencias de publicidad y confirma automaticamente la solicitud.
- La conciliacion admin existe como herramienta de soporte, no como flujo manual recomendado.

### Frontend comerciante

Pagina nueva:

- `afromercado-web/app/comerciante/publicidad/page.tsx`

Menu actualizado:

- `afromercado-web/app/comerciante/layout.tsx`

La pagina permite:

- Ver paquetes de AfroMedia.
- Ver precios y duraciones configuradas desde administracion.
- Ver cupos disponibles por paquete.
- Revisar checklist de elegibilidad.
- Seleccionar producto o tienda completa.
- Enviar objetivo, presupuesto, fechas y mensaje.
- Aceptar politicas de publicidad antes de enviar.
- Consultar historial de solicitudes.
- Ver notas del equipo AfroMedia.
- Ver estado de cobro, referencia y monto de la pauta.
- Iniciar pago de la pauta cuando la solicitud queda aprobada.
- Ver rendimiento de pautas activas desde el dashboard del comerciante: vistas, clics, carritos y GMV atribuido.

Paquetes iniciales:

- `IMPULSO_PRODUCTO`
- `HOME_DESTACADO`
- `VIDEO_HISTORIA`
- `TEMPORADA_REGIONAL`
- `MARCA_ALIADA`

### Frontend admin

Pagina nueva:

- `afromercado-web/app/admin/afromedia/page.tsx`

Menu actualizado:

- `afromercado-web/app/admin/layout.tsx`

La pagina permite:

- Ver resumen publicitario.
- Filtrar analitica por fechas.
- Exportar Excel de AfroMedia.
- Configurar paquetes, precios base, duracion, cupos, estado activo y recomendado.
- Ver cupos ocupados, libres y solicitudes pendientes por paquete.
- Ver ingresos publicitarios confirmados y cartera pendiente.
- Ver estado de pago, monto, proveedor y referencia por solicitud.
- Conciliar pago de soporte o marcar cortesia cuando aplique.
- Bloquear aprobacion de solicitudes sin aceptacion de politicas.
- Ver rankings por region, categoria, producto y comercio.
- Ver solicitudes recientes.
- Aprobar solicitudes.
- Rechazar solicitudes.
- Crear pauta desde una solicitud aprobada y con pago confirmado/cortesia.
- Marcar solicitudes como convertidas cuando se crea la pauta.
- Acceder rapido a visibilidad, campanas y configuracion del hero.
- Revisar rendimiento de pauta: CTR, carritos, pedidos atribuidos, GMV atribuido, inversion registrada y ROAS.

Conversion automatica:

- `IMPULSO_PRODUCTO` con producto crea `VisibilidadPagada` tipo `CATALOGO`.
- `HOME_DESTACADO` con producto crea `VisibilidadPagada` tipo `HOME_DESTACADO`.
- Solicitudes sin producto o paquetes de historia/ruta/marca crean `CampanaHero`.
- La etiqueta por defecto de visibilidad creada desde AfroMedia es `Patrocinado`.
- Las campanas creadas desde AfroMedia usan tipo `PUBLICIDAD`.

Medicion automatica:

- Las tarjetas patrocinadas del catalogo registran clic al abrir el producto.
- Las tarjetas patrocinadas del catalogo registran carrito al agregar producto.
- La seccion horizontal de inicio registra clic si el producto proviene de visibilidad pagada.
- Los eventos patrocinados envian `afm_sid` y token si el usuario esta autenticado.
- Cuando un pago digital o manual queda confirmado, AfroMercado atribuye la venta a la pauta activa del producto.
- La atribucion preferida es `ULTIMO_CLIC_7D`.
- La atribucion fallback es `PAUTA_ACTIVA_CONFIRMACION`.
- El ROAS se calcula como `gmvAtribuido / inversionRegistrada`.

Analitica implementada:

- `porRegion`: rendimiento por municipio del comercio.
- `porCategoria`: rendimiento por categoria del producto pautado.
- `porProducto`: productos o tiendas con mejor retorno.
- `porComercio`: comercios con mayor impacto publicitario.
- `porPaquete`: demanda comercial por paquete, estado y presupuesto solicitado.
- `porPaquete`: incluye pagos confirmados, pagos pendientes, ingreso pagado e ingreso pendiente.
- `campanas`: vistas, clics, CTR e inversion de campanas hero.

Exporte Excel:

- Hoja `Resumen`
- Hoja `Paquetes`
- Hoja `Solicitudes`
- La hoja `Solicitudes` incluye estado de pago, monto, proveedor, referencia y fecha de confirmacion.
- Hoja `Pautas`
- Hoja `Por region`
- Hoja `Por categoria`
- Hoja `Por producto`
- Hoja `Por comercio`
- Hoja `Campanas`

Politicas:

- Pagina publica: `afromercado-web/app/publicidad/politicas/page.tsx`
- Version vigente: `2026-06-27`
- Principio rector: no se vende confianza.
- El comerciante debe aceptar las politicas antes de crear solicitud.
- Admin ve si la solicitud tiene politicas aceptadas.

### Cliente API frontend

Archivo nuevo:

- `afromercado-web/components/publicidad/api.ts`

Funciones principales:

- `listarPaquetesPublicidad`
- `listarPaquetesPublicidadAdmin`
- `actualizarPaquetePublicidadAdmin`
- `obtenerAnaliticaAfroMediaAdmin`
- `crearSolicitudPublicidad`
- `listarMisSolicitudesPublicidad`
- `obtenerResumenAfroMediaAdmin`
- `listarSolicitudesPublicidadAdmin`
- `revisarSolicitudPublicidadAdmin`
- `convertirSolicitudPublicidadAdmin`

## Flujo operativo

1. El comerciante entra a `Comerciante > Publicidad`.
2. La plataforma valida si su tienda esta aprobada y su cuenta de dispersion esta verificada.
3. El comerciante selecciona paquete, producto opcional, objetivo, presupuesto y fechas.
4. La solicitud queda en estado `PENDIENTE`.
5. El administrador entra a `Admin > AfroMedia`.
6. El administrador revisa stock, calidad, legalidad, promesa comercial y coherencia cultural.
7. El administrador aprueba o rechaza.
8. Si se aprueba, el comerciante inicia pago de pauta desde su historial.
9. La pasarela genera checkout y confirma por webhook cuando el pago se aprueba.
10. El administrador pulsa `Crear pauta` solo si el pago esta `PAGADA` o `CORTESIA`.
11. AfroMedia crea automaticamente `VisibilidadPagada` o `CampanaHero`.
12. La solicitud queda en estado `CONVERTIDA`.
13. La pauta empieza a acumular vistas, clics, carritos y ventas atribuidas.
14. Admin puede revisar rankings y exportar Excel desde `Admin > AfroMedia`.
15. Si un paquete alcanza su limite de cupos, nuevas solicitudes y aprobaciones quedan bloqueadas.

## Reglas de producto

- La publicidad no debe aparecer como contenido organico.
- Todo contenido pagado debe estar etiquetado como `Patrocinado`, `Publicidad`, `Promocionado` o `Comunidad`.
- El hero marca campanas pagadas como `Publicidad`.
- Las tarjetas destacadas por visibilidad usan `Patrocinado` por defecto.
- No se debe vender visibilidad a comercios sin verificacion.
- No se debe pautar producto sin stock.
- No se debe permitir publicidad en checkout, salvo beneficios transaccionales como cupon real o envio.
- No se debe usar segmentacion basada en datos sensibles.

## Verificacion realizada

Comandos ejecutados:

- `npx prisma validate`
- `npm run prisma:generate`
- `npx prisma migrate deploy`
- `npm test`
- `npm run lint`
- `npm run build`

Resultado:

- Prisma valido.
- Cliente Prisma generado.
- Migraciones aplicadas.
- Backend tests pasaron.
- Frontend lint paso.
- Frontend build paso.

## Siguientes pasos recomendados

1. Crear centro de politicas de publicidad y patrocinados.
2. Agregar graficas de tendencia diaria/semanal.
3. Crear simulador de presupuesto recomendado por paquete.
4. Refinar cupos por region/categoria ademas de paquete global.
5. Crear auditoria de cambios de paquetes, cobros, exportes y decisiones editoriales.
6. Agregar conciliacion avanzada contra reportes descargados de Wompi.
