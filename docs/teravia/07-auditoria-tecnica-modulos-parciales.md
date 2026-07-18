# Anexo Técnico — Auditoría de los 4 módulos parciales

*Documento institucional TERAVIA. Versión viva.*
*Última actualización: 2026-07-16.*

## Nota metodológica

Este anexo complementa el Capítulo 3 (Arquitectura del Ecosistema por Módulo) con el nivel de detalle necesario para planear implementación real, no solo para documentar el estado del producto. Se auditaron directamente los 4 módulos que el Capítulo 3 clasificó como "parciales": Transporte, Directorio B2G, Pagos/Wompi y Analítica territorial — con lectura directa de código, sin tocar ningún archivo.

---

## A.1 Pagos digitales (Wompi) — hallazgo revisado al alza

El Capítulo 3 lo describió como "código completo, activación no confirmada". La auditoría profunda confirma algo más preciso y más favorable:

- **Existe un panel admin completo** en `afromercado-web/app/admin/pagos-config/page.tsx` — formulario con campos de contraseña enmascarados para cada credencial de Wompi, tarjetas de estado (verde/ámbar) por variable, toggle de proveedor SANDBOX/WOMPI, y un botón "probar configuración" que valida sin necesidad de tocar el servidor.
- **`payment-config.service.js`** lee credenciales desde variables de entorno **o desde base de datos** (tabla de configuración) — activar Wompi no requiere redeploy, se puede hacer completando el formulario admin.
- **`wompi.provider.js`** (467 líneas) implementa: checkout con firma de integridad (SHA-256), validación de firma de webhook con comparación segura contra timing attacks (`crypto.timingSafeEqual`), y dispersión hacia comercios vía la API de Wompi Payouts con resolución de banco, manejo de tipos de cuenta y estados de dispersión. Es código de nivel producción.
- **Confirmado directamente en el `.env` del proyecto**: no existe ninguna variable `WOMPI_*` configurada hoy.

**Conclusión revisada:** activar pagos reales no es una tarea de desarrollo — es un trámite administrativo (obtener cuenta de comercio Wompi, típicamente exige NIT) seguido de completar un formulario que ya existe. No requiere escribir código.

## A.2 Directorio empresarial B2G → directorio general

- El endpoint (`directorio.controller.js`, `GET /directorio-compras-publicas`, sin autenticación) filtra por `disponibleComprasPublicas: true`, `verificado: true`, `activo: true` sobre el modelo `Comercio` genérico — **no existe tabla dedicada**.
- `verificado` se activa vía panel admin (revisión de identidad); `disponibleComprasPublicas` es autoservicio del propio comerciante desde su perfil, sin segunda aprobación — decisión de diseño ya documentada en el código.
- **Convertirlo en directorio general es, en esencia, un cambio de filtro**: quitar `disponibleComprasPublicas: true` del `where`, o crear un endpoint alterno con solo `verificado: true, activo: true` (patrón casi idéntico ya existe en `admin.controller.js` para asignación de subsidios).
- Huecos técnicos reales: sin paginación (`take: 200` fijo), sin caché, filtros de municipio/departamento por igualdad exacta de texto (sensibles a tildes/typos), sin endpoint de detalle individual, sin tests.

## A.3 Transporte — módulo sólido pero aislado del resto del ecosistema

- Modelo de datos completo para reserva de rutas fluviales (`ConfigTransporte`, `RutaTransporte`, `ReservaTransporte`, `ReviewTransporte`), con catálogo de tipos de embarcación (Lancha, Bote, Chalupa, Canoa, Piragua, Ferry).
- CRUD de rutas para comerciante completo; flujo de reserva funciona pero **el pago sigue siendo manual** (string libre `EFECTIVO`/`TRANSFERENCIA`, confirmación manual del operador, sin webhook).
- **Confirmado con evidencia de código: cero integración con Marketplace/Express.** `grep` de "transporte" en `pedido.service.js` y `express.service.js`: 0 coincidencias. `ReservaTransporte` no tiene FK hacia `Pedido`, `SubPedido` ni `PedidoExpress`.
- En paralelo, ya existe un sistema robusto de logística de última milla (modelo `Entrega`, con tracking en vivo lat/long, `SolicitudRepartidor`, `CalificacionRepartidor`) — **totalmente desconectado de Transporte**. Son dos silos de código independientes que resuelven, en esencia, el mismo problema (mover algo de un punto a otro) sin compartir una sola línea.
- No hay modelo de "salida/viaje" independiente de la ruta — la capacidad es fija por ruta, no por fecha/horario específico, lo que impide manejar excepciones (feriados, mantenimiento, clima).

## A.4 Analítica territorial — rica en funcionalidad, ciega geográficamente

- 14 endpoints admin (`reporte.repository.js`): dashboard con KPIs, series temporales, ranking de comercios, comercios en riesgo, cohortes de retención, ROI de cupones, reportes por categoría/producto/cliente, alertas accionables, exportación a Excel multi-hoja.
- **Toda la agregación geográfica es sobre texto libre sin normalizar** — `Comercio.municipio`/`departamento` y `Direccion.municipio`/`departamento` son campos de texto capturados en formularios, sin catálogo DANE ni coordenadas. `Comercio` sí tiene `latitud`/`longitud`, pero **no se usan en ningún reporte**.
- El frontend usa tablas + gráficos de barras SVG artesanales — **sin ninguna librería de mapas**, pese a que el proyecto ya tiene `leaflet`/`react-leaflet` instalados y en uso activo en 7 componentes de otros módulos (mapas de Tours, Hoteles, Cultura, seguimiento de repartidor).
- Exclusivamente interno (`autorizar("ADMIN")` en los 14 endpoints) — no hay variante para vender a terceros.
- Riesgo técnico real: las tablas `Pedido`/`SubPedido` no tienen índices que cubran los filtros usados en las queries admin (`estado`+`createdAt`); `Direccion` no tiene ningún índice pese a ser la tabla agrupada en los reportes territoriales — esto va a doler conforme crezca el volumen de datos.

---

## A.5 Síntesis y orden de trabajo propuesto

| Módulo | Esfuerzo real | Bloqueado por |
|---|---|---|
| Pagos (Wompi) | Ninguno (es trámite, no código) | Cuenta de comercio Wompi → requiere NIT → SAS (Cap. 4) |
| Directorio general | Bajo (cambio de filtro + paginación) | Nada — se puede hacer ya |
| Analítica con mapas | Medio (conectar Leaflet ya instalado + normalizar geografía) | Nada — se puede hacer ya |
| Transporte↔Entrega | Alto (nuevo modelo de "viaje", FK cruzadas, rediseño) | Decisión de diseño previa, no bloqueo externo |

---

*Referencia: [Capítulo 3 — Arquitectura del Ecosistema por Módulo](03-arquitectura-por-modulo.md) · [Capítulo 4 — Gobernanza (SAS)](04-gobernanza-marca-sostenibilidad.md)*
