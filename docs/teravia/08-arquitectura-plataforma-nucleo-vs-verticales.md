# Anexo B — Arquitectura de Plataforma: Núcleo vs Verticales

*Documento técnico complementario del Proyecto Maestro TERAVIA. Versión viva.*
*Última actualización: 2026-07-17.*

## Propósito

Este documento responde a una decisión explícita del fundador: dejar de construir TERAVIA "por funcionalidades" (un módulo a la vez, cada uno resolviendo sus propios problemas desde cero) y empezar a construirla como lo hacen Amazon, Mercado Libre o Shopify — a partir de una **arquitectura de producto**: un núcleo de capacidades compartidas que todos los verticales consumen, y una capa de verticales que solo contiene lo que es genuinamente distinto de cada dominio.

No es una preferencia de estilo. Es un diagnóstico con evidencia exacta, extraída directamente de `schema.prisma` — no una opinión sobre cómo *debería* estar construido, sino una medición de cómo *está* construido hoy.

---

## 1. Diagnóstico: la duplicación real, con nombres y números

### 1.1 Reseñas — 7 modelos para el mismo concepto

```
Review            (Pedido de Marketplace — nivel orden completa)
ReviewProducto    (Producto individual de Marketplace)
ReviewHotel       (ReservaHotel)
ReviewTour        (ReservaTour)
ReviewTransporte  (ReservaTransporte)
ReviewExpress     (PedidoExpress)
ReviewCultura     (ReservaCultural)
```

Los siete comparten el mismo esqueleto (`calificacion Int`, `comentario String?`, relación a un autor y a la entidad calificada), pero **divergieron con el tiempo de forma no intencional**: `ReviewExpress` y `ReviewCultura` tienen `fotoUrls String[]`; `ReviewHotel`, `ReviewTour` y `ReviewTransporte` no. `ReviewCultura` además tiene `videoUrl`; ninguna otra lo tiene. No hay una razón de negocio para que un cliente pueda subir foto a la reseña de un tour cultural pero no a la de un hotel — es simplemente que se construyeron en momentos distintos, cada uno reinventando el mismo concepto.

### 1.2 Favoritos — 7 modelos para el mismo concepto

```
Favorito               (Producto de Marketplace)
FavoritoHotel          (ConfigHotel)
FavoritoExpress        (ConfigExpress)
FavoritoTour           (ConfigTour)
FavoritoTransporte     (ConfigTransporte)
FavoritoCultura        (EventoCultural)
FavoritoOfertaEmpleo   (OfertaEmpleo)
```

Los siete son, sin excepción, la misma estructura exacta: `usuarioId`, el id de la entidad favorita, `createdAt`, una restricción `@@unique([usuarioId, entidadId])`. Es el caso más puro de duplicación de todo el sistema — cero variación real entre las siete tablas.

### 1.3 Cupones — 11 modelos, con más divergencia real que Reseñas/Favoritos

```
Cupon + CuponUso + CuponComercio + CuponAsignacion     (Marketplace — el más completo)
CuponHotel + CuponHotelUso
CuponExpress + CuponExpressUso
CuponTour + CuponTourUso
CuponTransporte + CuponTransporteUso
```

Aquí la duplicación es real pero con más matices que Reseñas/Favoritos: `Cupon` (Marketplace) tiene `usosMaximosPorUsuario`, `soloNuevos`, `distribucion` (`TipoDistribucionCupon`) y `programaNombre` — funcionalidad que ningún cupón de servicio (`CuponHotel`, `CuponExpress`, etc.) tiene. Y los cupones de servicio usan `minimoNoches` (Hotel) o `minimoSubtotal` (Express) — el mismo concepto ("monto/cantidad mínima para aplicar") expresado con nombres distintos en cada tabla.

### 1.4 Logística — diagnóstico inicial corregido tras auditoría (ver sección 3.5)

El diagnóstico original (Anexo A) asumía que `Entrega`+`SolicitudRepartidor`+`CalificacionRepartidor` y `RutaTransporte`+`ReservaTransporte` eran dos implementaciones independientes del mismo problema. La auditoría de la sección 3.5 encontró que **no es así**: no comparten ni una línea de código porque no resuelven el mismo problema — uno es logística gig-economy con repartidor, tracking en vivo y pago por viaje; el otro es venta de cupos en un servicio que el propio comercio opera, sin repartidor ni tracking. El hallazgo real fue distinto: `PedidoExpress.repartidorId` existe pero está completamente muerto (usado por Marketplace, nunca conectado en Express) — ver sección 3.5 para el detalle y la recomendación.

### 1.5 Comisión — no es duplicación de modelo, es una inconsistencia peor: dos mecanismos activos a la vez

Existe `ComisionComercio` — un modelo general, ya bien diseñado, que permite al admin fijar una tasa de comisión por comercio con vigencia (`desde`/`hasta`) y motivo. El panel `/admin/comerciantes` ya lo usa y lo muestra.

Pero `express.service.js` línea 63 tiene `const TASA_COMISION = 0.10;` **hardcodeado**, y lo usa directamente en el cálculo de cada pedido Express (línea 247), **sin consultar `ComisionComercio` en absoluto**. Esto no es solo deuda técnica — es un bug latente: si un admin le asigna a un comercio una comisión distinta al 10% a través del panel (por ejemplo, una tarifa preferencial para un comercio en un municipio PDET, coherente con el Capítulo 2), esa tarifa **se respeta en Marketplace pero se ignora en Express** para el mismo comercio.

### 1.6 El contraejemplo positivo — la prueba de que el patrón correcto ya existe en el código

No todo está duplicado. `Producto` es un único modelo compartido entre Marketplace y Express: un producto se marca con `esExpress: true` para aparecer en el menú de un restaurante, reutilizando exactamente el mismo catálogo, las mismas fotos, el mismo stock. **Esto es exactamente el patrón que se necesita generalizar** — no es una propuesta teórica, es replicar una decisión que ya se tomó bien en un lugar del sistema.

### 1.7 Lo que ya está correctamente centralizado (no tocar)

- **Identidad**: `Usuario`, JWT, `autenticar`/`autorizar` — un solo sistema para los 8+ módulos.
- **Notificaciones**: `Notificacion` es un único modelo genérico (`tipo`, `titulo`, `mensaje`, `url`, `datos Json?`) que ya sirve a todos los módulos sin duplicación. Es el ejemplo a seguir para el diseño de Reseñas/Favoritos unificados.
- **Pagos (parcialmente)**: el proveedor Wompi (`wompi.provider.js`) y el modelo `Pago` están diseñados de forma genérica (reciben `{ pago, pedido }`, no están acoplados a un módulo). El problema no es el núcleo de pagos — es que Transporte no lo consume (usa un string libre `metodoPago`, ver Anexo A).

---

## 2. El núcleo propuesto

| Primitiva | Estado hoy | Acción |
|---|---|---|
| Identidad y roles | ✅ Ya centralizado | Ninguna |
| Notificaciones | ✅ Ya centralizado | Ninguna — usar como plantilla de diseño |
| Catálogo (Producto) | ✅ Ya compartido (Marketplace/Express vía `esExpress`) | Ninguna — replicar el patrón |
| Pagos | 🟡 Núcleo bien diseñado, subutilizado | Conectar Transporte al `Pago`/Wompi existente (ya identificado en Anexo A) |
| Reseñas | 🔴 7 modelos duplicados | Unificar en `Resena` polimórfica |
| Favoritos | 🔴 7 modelos duplicados | Unificar en `Favorito` polimórfico |
| Cupones | 🔴 11 modelos duplicados, con más lógica real que migrar | Unificar en `CuponUnificado` — la migración de mayor riesgo de las tres |
| Comisión | 🟡 Núcleo ya existe (`ComisionComercio`), Express lo ignora | Corregir Express para leer de `ComisionComercio` — no crear nada nuevo |
| Logística/Cumplimiento | 🟢 Auditado (sección 3.5) — no son 2 sistemas paralelos del mismo problema | Transporte no se toca (es reserva de capacidad, no reparto); conectar Express al `Entrega` de Marketplace, ya construido y funcionando |

---

## 3. Diseño de datos propuesto

### 3.1 Reseña unificada

```prisma
enum TipoEntidadResenable {
  PEDIDO               // Review actual — nivel orden completa de Marketplace
  PRODUCTO             // ReviewProducto
  RESERVA_HOTEL
  RESERVA_TOUR
  RESERVA_TRANSPORTE
  PEDIDO_EXPRESS
  RESERVA_CULTURAL
}

model Resena {
  id           Int                   @id @default(autoincrement())
  tipoEntidad  TipoEntidadResenable
  entidadId    Int                   // id del Pedido/Producto/Reserva/PedidoExpress calificado
  comercioId   Int?                  // desnormalizado a propósito: permite "todas las reseñas de este comercio" sin importar el tipo
  autorId      Int
  calificacion Int
  comentario   String?
  fotoUrls     String[]              @default([])
  videoUrl     String?
  createdAt    DateTime              @default(now())

  autor    Usuario   @relation(fields: [autorId], references: [id])
  comercio Comercio? @relation(fields: [comercioId], references: [id])

  @@unique([tipoEntidad, entidadId])
  @@index([comercioId])
  @@index([tipoEntidad, entidadId])
}
```

El campo `comercioId` desnormalizado es deliberado: hoy calcular "la calificación promedio de este comercio" requiere una query distinta por módulo (ver el hallazgo del Capítulo 3 sobre por qué un comercio que solo vende por Express nunca actualizaba `Comercio.calificacion`). Con `comercioId` en la tabla única, es una sola query agregada para cualquier comercio, sin importar en cuántos verticales opere.

### 3.2 Favorito unificado

```prisma
enum TipoEntidadFavorita {
  PRODUCTO
  CONFIG_HOTEL
  CONFIG_EXPRESS
  CONFIG_TOUR
  CONFIG_TRANSPORTE
  EVENTO_CULTURAL
  OFERTA_EMPLEO
}

model Favorito {
  id          Int                  @id @default(autoincrement())
  usuarioId   Int
  tipoEntidad TipoEntidadFavorita
  entidadId   Int
  createdAt   DateTime             @default(now())

  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  @@unique([usuarioId, tipoEntidad, entidadId])
  @@index([usuarioId])
  @@index([tipoEntidad, entidadId])
}
```

Sin campos adicionales — es literalmente la tabla que ya existe siete veces, con un discriminador de tipo agregado. Es, con evidencia, la migración más simple de las tres.

### 3.3 Cupón unificado (la migración de mayor riesgo — diseño preliminar, no definitivo)

```prisma
enum TipoEntidadCupon {
  GLOBAL            // Cupon actual — aplica a cualquier comercio de Marketplace
  CONFIG_HOTEL
  CONFIG_EXPRESS
  CONFIG_TOUR
  CONFIG_TRANSPORTE
}

model CuponUnificado {
  id                    Int                    @id @default(autoincrement())
  codigo                String                 @unique
  tipoEntidad           TipoEntidadCupon       @default(GLOBAL)
  entidadId             Int?                   // null si es GLOBAL
  tipo                  TipoOferta             // reutiliza el enum ya existente
  valor                 Decimal                @db.Decimal(10, 2)
  minimoAplicable        Decimal?               @db.Decimal(12, 2) // reemplaza minimoCompra/minimoNoches/minimoSubtotal con un solo nombre
  usosMaximos           Int?
  usosMaximosPorUsuario Int?
  usosActuales          Int                    @default(0)
  activo                Boolean                @default(true)
  inicio                DateTime
  fin                   DateTime
  soloNuevos            Boolean                @default(false)
  distribucion          TipoDistribucionCupon  @default(PUBLICO)
  programaNombre        String?
  createdAt             DateTime               @default(now())

  usos CuponUnificadoUso[]

  @@index([codigo, activo])
  @@index([tipoEntidad, entidadId, activo])
}
```

**Por qué esta es la migración más riesgosa de las tres:** a diferencia de Reseñas y Favoritos (donde los 7 modelos son prácticamente idénticos), los cupones de Marketplace ya tienen funcionalidad (`usosMaximosPorUsuario`, `distribucion`, `programaNombre` — usado para programas de subsidio institucional, conectado al Capítulo 1) que los cupones de servicio nunca tuvieron. Unificar significa decidir: ¿esa funcionalidad se activa también para Hotel/Tour/Express/Transporte, o se deja como campo presente pero sin usar en esos contextos? Esto es una decisión de producto, no solo una migración de esquema — por eso se recomienda dejarla para el final.

### 3.4 Comisión — no requiere diseño nuevo, solo corrección

No se propone un modelo nuevo. `ComisionComercio` ya es el diseño correcto. El cambio es en `express.service.js`: reemplazar `TASA_COMISION` hardcodeado por una consulta a `ComisionComercio` (la misma que probablemente ya usa `pedido.service.js` para Marketplace — verificar y replicar exactamente esa función, no inventar una nueva).

### 3.5 Logística/Cumplimiento — auditoría ejecutada, la premisa original no se sostuvo

Se ejecutó la sesión de auditoría propia que esta sección pedía (2026-07-18), con mapeo exhaustivo de campo/función de los dos sistemas antes de proponer nada. **Resultado: la premisa de "unificar Entrega y Transporte en un modelo de última milla" no se sostiene contra la evidencia.**

**`Entrega`/`SolicitudRepartidor`/`CalificacionRepartidor` (Marketplace)** es un sistema de logística gig-economy real y maduro: pool abierto de entregas (`repartidorId:null` → cualquier repartidor con rol `REPARTIDOR` la reclama por candado optimista, o un admin la asigna), máquina de estados (`ASIGNADA→RECOGIDA→EN_CAMINO→ENTREGADA`), tracking en vivo persistido (`ultimaLatitud/ultimaLongitud/ultimaUbicacionAt`, retransmitido por SSE), pago calculado por reglas de negocio (`pago-repartidor.service.js`), calificación propia del repartidor como persona (`CalificacionRepartidor`, deliberadamente no fusionada con `Resena` en la Fase 3 — calificar al repartidor no es calificar el pedido).

**`RutaTransporte`/`ReservaTransporte` (Transporte fluvial)** no tiene ningún concepto equivalente: sin repartidor/operador separado del comerciante (el mismo `Comercio` dueño de la ruta ejecuta las transiciones de estado directamente), sin tracking en vivo, sin pago-a-tercero (el comerciante cobra directo), sin calificación individual a un "piloto". Estructuralmente se parece mucho más al modelo de inventario de habitaciones de Hotel (`RutaTransporte.capacidad` + agregación dinámica de asientos reservados, igual que disponibilidad de `HabitacionTipo`) que a un problema de logística de reparto. **No hay duplicación real que consolidar** — forzar una unificación aquí inventaría estructura sin respaldo en la lógica de negocio real, el mismo error que ya se evitó en Cupones (sección 3.3) al no fusionar `Cupon` de Marketplace con los verticales.

**El hallazgo real y aprovechable, no el que se buscaba:** `PedidoExpress.repartidorId` existe en el schema pero está **completamente muerto** — confirmado por grep exhaustivo en `express.service.js`/`express.controller.js`/`express.routes.js`: cero lecturas, cero escrituras. Hoy, cuando un pedido Express avanza a `EN_CAMINO`/`ENTREGADO`, es el propio comerciante quien fuerza el cambio de estado manualmente — no hay repartidor real asignado, ni tracking en vivo, ni pago a domiciliario, pese a que el campo sugiere que esto se planeó y nunca se conectó. A diferencia de Transporte, Express **sí** es un problema de última milla con la misma forma exacta que Marketplace (comida de un restaurante a una casa) — es el candidato natural y de bajo riesgo para reusar el sistema `Entrega`/`repartidor.controller.js` ya construido, en vez de una unificación Entrega↔Transporte que la evidencia no respalda.

Transporte fluvial queda fuera de cualquier unificación de logística — es un modelo de reserva de capacidad, no de reparto, y se documenta aquí explícitamente para que no se reintente esta unificación sin evidencia nueva que la respalde.

### 3.5.1 Fase 5 — conectar Express a Entrega ✅ Ejecutada — 2026-07-18

Dos decisiones de producto reales se resolvieron antes de escribir código, con evidencia:

- **¿Pool de repartidores compartido o separado entre Marketplace y Express?** Compartido. Con cero repartidores activos y varios comercios que ya operan Express y Marketplace a la vez en pueblos chicos del Chocó (Tadó, Quibdó), separar el pool fragmentaría algo que hoy ni siquiera existe, sin ningún beneficio operativo real.
- **¿Los domicilios de comida (urgentes) compiten en igualdad con los de Marketplace (no urgentes)?** No — se agregó prioridad real: `disponibles` ordena primero por origen (Express antes que Marketplace) y luego por tiempo de espera, en vez de "más reciente primero" sin criterio.
- **Hallazgo adicional que amplió el alcance:** muchos restaurantes ya tienen su propio domiciliario y no deberían entrar al pool de la plataforma en absoluto. Se agregó `ConfigExpress.tipoEntregaDomicilio` (`PROPIO` por defecto — no rompe a nadie — o `PLATAFORMA`), más una válvula de escape para que un restaurante en modo `PROPIO` pase un pedido puntual al pool si su domiciliario no puede cubrirlo.

**Resultado real:** `Entrega` gana `pedidoExpressId` (nullable, único) junto a `subPedidoId` (ahora también nullable) — mutuamente excluyentes, reforzado con un `CHECK` a nivel de base de datos, no el patrón polimórfico `tipoEntidad`/`entidadId` de Reseñas/Favoritos/Cupones a propósito (aquí sí hacían falta relaciones reales de Prisma para los filtros de `repartidor.controller.js`, y no había 7 tablas duplicadas que consolidar). `PedidoExpress.repartidorId` — el campo muerto que originó esta fase — se eliminó, reemplazado por `Entrega.repartidorId` como única fuente de verdad. Al llegar a `LISTO` en modo `PLATAFORMA`, se crea la `Entrega` automáticamente (mismo disparador que Marketplace en `SubPedido→LISTO`); desde ahí, `LISTO→EN_CAMINO` deja de ser potestad del comercio y pasa al repartidor asignado.

`repartidor.controller.js` se generalizó con helpers (`compradorIdDe`, `pedidoIdDe`, `comercioDe`, `direccionDe`) que normalizan el acceso sin importar el origen, en vez de duplicar cada función. `pago-repartidor.service.js` y las notificaciones (`entregaRecogida`/`entregaEnCamino`/`pedidoEntregado`/`entregaFallida`, con `url` ahora configurable) se extendieron de la misma forma. Badge "Envío gratis" corregido en la tarjeta de restaurante cuando `costoEnvioBase = 0` (antes mostraba "🛵 $0").

Verificado extremo a extremo: `tsc --noEmit` y `node --check` limpios en todos los archivos tocados, dos reinicios consecutivos del backend sin error, y un script de prueba real que activó modo `PLATAFORMA`, creó un pedido, confirmó la `Entrega` automática al llegar a `LISTO`, confirmó que el comercio queda bloqueado de avanzar el estado él mismo, confirmó que la query del pool de repartidores encuentra la entrega, confirmó el cálculo de pago al repartidor, y probó la válvula de escape sobre un pedido en modo `PROPIO` — limpiando los datos de prueba al final.

**Segunda ronda de verificación — recorrido real en navegador (2026-07-18):** con datos de script no basta para confiar en un flujo de 3 roles; se creó un repartidor de prueba real (`SolicitudRepartidor` aprobada) y se recorrió el ciclo completo con clics reales: comprador pidió a domicilio → comerciante aceptó/preparó/marcó listo (la `Entrega` se creó sola) → el intento del comerciante de avanzar "En camino" mostró el mensaje de bloqueo real, no simulado → el repartidor vio el pedido en "Disponibles" mezclado con entregas reales de Marketplace preexistentes, con el pedido Express ordenado primero (prioridad por urgencia funcionando) → lo tomó y avanzó Recogida→En camino→Entregado desde la UI → en base de datos, `PedidoExpress.estado` quedó `ENTREGADO` y `Entrega.pagoRepartidor` calculado y congelado correctamente. Este recorrido fue el que expuso el bug de `misReservas`/`review` documentado en la Fase 3 (los logs de error aparecieron mientras se probaba una página completamente distinta) — confirma que la verificación en navegador encuentra fallas que `tsc`/`node --check`/scripts no pueden ver.

Pulido de UX aplicado en la misma ronda: el botón "En camino →" del comerciante ahora se oculta cuando ya existe una `Entrega` de plataforma para ese pedido (antes quedaba visible y clickeable aunque el backend lo bloqueara, obligando al comerciante a intentarlo y recibir un error para enterarse) — se agregó `entrega: {select:{id:true}}` al include de `listarPedidosComercio` para que el frontend pueda saberlo sin otra llamada.

---

## 4. Lo que NO se toca — la capa de verticales legítima

Para que quede explícito y no se interprete que "todo debe unificarse": lo siguiente es diferencia de negocio real, no duplicación accidental, y debe seguir siendo específico de cada módulo:

- `ConfigHotel`/`HabitacionTipo`/`HabitacionFisica` — la lógica de disponibilidad por habitación/noche no tiene equivalente en ningún otro vertical.
- `ConfigTour`/`TourLugar` — itinerario y lugares es exclusivo de Tours.
- `GrupoComplemento`/`ItemComplemento` de Express — los complementos de un plato no aplican a ningún otro vertical.
- `RutaTransporte` en sí (horarios, tipo de embarcación) — solo el *cumplimiento/logística* se unifica (sección 3.5), no la gestión de rutas.
- `HojaDeVida`/`PostulacionEmpleo` — exclusivo de Empleo.

---

## 5. Plan de migración incremental

**No se propone una reescritura de una sola vez.** Cada primitiva se migra por separado, en este orden, de menor a mayor riesgo:

### Fase 1 — Favoritos (piloto del patrón de migración) ✅ Ejecutada — 2026-07-17
El caso más simple: 7 tablas idénticas, sin lógica de negocio adicional que decidir. Sirvió para validar el patrón completo con el menor riesgo posible antes de aplicarlo a algo más delicado.

**Resultado real:** modelo `Favorito` unificado con `tipoEntidad`/`entidadId`, migración de datos idempotente (3 filas de Marketplace migradas sin pérdida; las 6 tablas de servicio nunca habían llegado a crearse en la base local, así que no había nada que migrar ahí — la migración maneja ambos casos con `IF EXISTS`), 6 servicios + 1 controlador reescritos consumiendo el modelo único **sin cambiar el contrato de la API** — cero cambios de frontend. Verificado en navegador: toggle en Marketplace (módulo con datos preexistentes) y en Express (módulo que partía de cero), más el listado "Mis favoritos" y la persistencia del estado al recargar. `tsc --noEmit` limpio sin tocar el frontend, confirmando que el contrato se preservó.

### Fase 2 — Comisión (no es migración de datos, es corrección de un bug) ✅ Ejecutada — 2026-07-17
Cambio más pequeño que Favoritos en superficie de código, pero corrige una inconsistencia real ya identificada. Bajo riesgo, alto valor — se pudo hacer en paralelo a la Fase 1.

**Resultado real:** `express.service.js` reemplazó `TASA_COMISION = 0.10` hardcodeado por `resolverTasaComision(comercioId)`, que replica exactamente la cascada que ya usaba `pedido.service.js` para Marketplace (`ComisionComercio` vigente por comercio → `Config["comision_global"]` → default de config/env). Verificado con un script directo contra Prisma: sin override resuelve 0.10 (default), con un override de prueba de 0.15 resuelve 0.15 — limpiado después de la prueba.

### Fase 3 — Reseñas ✅ Ejecutada — 2026-07-17
Más delicado que Favoritos porque hubo que decidir qué hacer con `Comercio.calificacion`/`totalReviews` (antes alimentados de forma inconsistente entre módulos, según el Capítulo 3) — la migración fue la oportunidad de resolver ese problema de raíz con el campo `comercioId` desnormalizado del diseño de la sección 3.1.

**Resultado real:** modelo `Resena` unificado (enum `TipoEntidadResenable`: `PEDIDO`, `PRODUCTO`, `RESERVA_HOTEL`, `RESERVA_TOUR`, `RESERVA_TRANSPORTE`, `PEDIDO_EXPRESS`, `RESERVA_CULTURAL`). Una desviación deliberada del diseño original de la sección 3.1: la restricción única quedó en `[tipoEntidad, entidadId, autorId]` en vez de `[tipoEntidad, entidadId]` — el diseño original habría limitado `PRODUCTO` a una sola reseña *por producto en total* (en vez de una por comprador), un bug real que se detectó antes de migrar datos, no después.

`Comercio.calificacion`/`totalReviews` se decidieron como **agregado recalculado por escritura** (`recalcularCalificacionComercio`, en `utils/resena.js`) sobre todas las reseñas no-`PRODUCTO` de ese comercio, cada vez que se crea o borra una reseña — generalizando el patrón que ya usaba Hotel/Marketplace (persistir en `Comercio`) en vez del que usaba Express (recalcular en caliente en cada listado, con una query `groupBy` extra por petición). Esto corrige de raíz el bug de Tour/Transporte (nunca actualizaban nada) y elimina el N+1 que tenía Express. Efecto secundario esperado y confirmado en la verificación: algunos comercios de datos de semilla tenían `calificacion`/`totalReviews` sembrados directamente sin reseñas reales detrás (ej. comercio "Asociación Campesina Atrato": 4.6★/8 reseñas fantasma) — la migración solo recalculó los comercios con reseñas reales migradas (1 sola fila real, de Express), dejando esos valores de semilla intactos; se confirmó con una prueba real que, en cuanto se crea una reseña real para uno de esos comercios, el recálculo los reemplaza por el valor real (comportamiento correcto, documentado aquí para que no sorprenda si aparece en otro comercio).

Migración de datos idempotente (mismo patrón `IF EXISTS`/`LEFT JOIN` que Favoritos, para no perder una reseña aunque su entidad padre ya no exista). Verificado extremo a extremo: `tsc --noEmit` limpio sin tocar el frontend (7 controladores/repositorios de backend reescritos preservando el contrato exacto de cada endpoint, incluyendo la inconsistencia histórica `creadoAt` vs `createdAt` entre módulos), reinicio del backend dos veces seguidas sin error (idempotencia real, no solo teórica), y prueba en navegador: reseña real migrada visible en `/express/15` con su promedio y fecha correctos, y el panel `/admin/reviews` (Productos y Tiendas) cargando sin errores tras el cambio.

**Bug real encontrado y corregido el 2026-07-18 (un día después, durante la verificación de Fase 5):** las 5 funciones `misReservas`/`listarPedidosCliente` de Hotel/Tour/Transporte/Cultura/Express (una por módulo, mostraban "¿ya calificaste este pedido?" al comprador) seguían con `include: { review: {...} } }`, apuntando a la relación `review` que esta misma Fase 3 eliminó del schema al migrar a `Resena`. `tsc --noEmit` y `node --check` no lo detectaron porque un `include` de Prisma con forma inválida solo falla en tiempo de ejecución, no en compilación — el primer indicio real fue un `[ERROR 500]` en los logs del backend mientras se probaba Fase 5 en el navegador, en una página completamente distinta (Express). Corregido reemplazando el `include` roto por una consulta en lote a `Resena` (mismo patrón `Map` por lote que ya usaba el resto de Fase 3), verificado cargando las 5 páginas `mis-reservas`/`mis-pedidos` reales en el navegador. Queda documentado como recordatorio: una migración de schema con `tsc`/`node --check` en verde **no** garantiza que cada `include`/`select` de Prisma en el resto del código siga siendo válido — hace falta ejercitar en tiempo de ejecución cada endpoint que toque el modelo migrado, no solo los que se tocaron directamente en la migración.

### Fase 4 — Cupones ✅ Ejecutada — 2026-07-18 (alcance revisado, ver abajo)
La de mayor riesgo, según lo explicado en la sección 3.3 — requirió decisión de producto antes de escribir una sola línea de migración. Se le preguntó al fundador y se ejecutó.

**Hallazgo que cambió el alcance respecto al diseño original de la sección 3.3:** `Cupon`/`CuponUso` de Marketplace no son solo un modelo de datos — tienen encima un sistema completo de analítica y detección de fraude (`cupon.repository.js`, ~950 líneas: métricas económicas, log de usos, ranking por usuario, 6 heurísticas de alertas de abuso, auditoría de integridad) con ~15 queries SQL crudas que referencian los nombres de tabla `"Cupon"`/`"CuponUso"` directamente. Hotel/Tour/Express/Transporte no tienen nada equivalente — son mucho más simples y sí eran casi idénticos entre sí (con dos campos "mínimo" adicionales no documentados originalmente: `minimoPersonas` en Tour, `minimoAsientos` en Transporte). Unificar todo en un `CuponUnificado` habría obligado a reescribir esas 15 queries financieras sin ninguna reducción real de duplicación a cambio.

**Decisión tomada:** unificar solo los 4 verticales de servicio (`CuponHotel`, `CuponExpress`, `CuponTour`, `CuponTransporte` + sus `*Uso` — 8 tablas) en un modelo `CuponVertical` polimórfico. `Cupon`/`CuponUso`/`CuponComercio`/`CuponAsignacion` de Marketplace quedan completamente intactos — cero riesgo sobre la analítica financiera existente. También se descubrió, sin haber estado documentado en este Anexo, que el descuento por Alianza Comercial (`esAlianza`) vive fuera de los 11 modelos de cupón (en `AlianzaComercial`/`AlianzaSocio`) y su lógica de fallback está duplicada casi idéntica en los 5 validadores — se dejó intacta (unificarla no era parte del alcance aprobado), documentada aquí como pendiente futuro de menor prioridad.

**Resultado real:** `CuponVertical` + `CuponVerticalUso` (enum `TipoEntidadCuponVertical`: `CONFIG_HOTEL`, `CONFIG_EXPRESS`, `CONFIG_TOUR`, `CONFIG_TRANSPORTE`), campo `minimoAplicable` único reemplazando `minimoNoches`/`minimoSubtotal`/`minimoPersonas`/`minimoAsientos`, `entidadId` nullable preservando la semántica de "aplica a todos los comercios de ese vertical" que ya existía (`configXId IS NULL`). Un helper compartido nuevo (`utils/cupon-vertical.js`) extrae solo las piezas mecánicas idénticas entre los 4 validadores (buscar cupón vigente, bloqueo pesimista opcional, chequeo de un-uso-por-cliente, fórmula de descuento, fallback a Alianza) — cada servicio conserva su propio texto de error y semántica de "cantidad mínima" (noches/subtotal/personas/asientos), y su propio nombre de campo de retorno (`totalConDescuento` en Hotel/Transporte, `subtotalConDescuento` en Express/Tour — inconsistencia histórica preexistente, preservada a propósito). 4 servicios reescritos (`hotel.service.js`, `express.service.js`, `tour.service.js`, `transporte.service.js`) sin cambiar ninguna firma de función pública ni contrato de API — cada `crearCuponX`/`listarCuponesX` remapea la fila interna al shape legado exacto que el frontend ya espera.

De paso se limpiaron 8 bloques `CREATE TABLE IF NOT EXISTS` ya obsoletos en `aplicarMigraciones()` (para las tablas que esta misma fase elimina) que habrían recreado tablas vacías en cada reinicio del backend antes de que el bloque de esta fase las volviera a borrar — desperdicio inofensivo pero innecesario. Se encontró el mismo problema, ya preexistente, para las tablas de Favoritos (Fase 1) y Reseñas (Fase 3); se dejó como tarea de limpieza aparte (no bloquea nada, no hay pérdida de datos).

Verificado extremo a extremo: `tsc --noEmit` limpio sin tocar el frontend, reinicio del backend dos veces seguidas sin error (idempotencia real), y un script de prueba real contra los 4 servicios (crear → listar → validar → rechazo por mínimo, y para Hotel además el descuento exacto) confirmando shape de respuesta correcto y cálculo de descuento correcto en los 4 verticales — limpiando los datos de prueba al final.

### Fase 5 — Logística/Cumplimiento
Fuera de alcance de este documento (sección 3.5) — diseño propio primero.

---

## 6. Regla para evitar que esto vuelva a pasar

A partir de este documento, cualquier función nueva que necesite Reseñas, Favoritos, Cupones o Logística **consume el núcleo unificado correspondiente** (una vez migrado) **o, si esa fase de migración aún no se ejecutó, se construye contra el modelo existente de Marketplace** (el más completo de los siete/once) en vez de crear una tabla nueva propia del módulo. Ningún módulo nuevo crea su propio `ReviewX`/`FavoritoX`/`CuponX` a partir de la fecha de este documento.

---

## 7. Riesgos de la migración, sin suavizarlos

- **Migración de datos real**: cada Fase implica mover filas de 5-7 tablas existentes a una tabla nueva, sin perder historial. Se necesita un script de migración probado en una copia de la base antes de correrlo en producción — no un `ALTER TABLE` simple como los que se han usado en este proyecto hasta ahora.
- **Cambio de superficie amplia**: cada Fase toca múltiples controladores, servicios y páginas de frontend simultáneamente — no es un cambio aislado como los del Sprint de 30 días anterior. El riesgo de romper algo que hoy funciona (particularmente Express, el módulo más maduro y con más tráfico de prueba) es real y debe mitigarse con verificación exhaustiva en navegador antes de dar cada fase por completa, no solo con `tsc`/`node --check`.
- **No se ejecuta ninguna fase sin aprobación explícita previa**, siguiendo el mismo patrón de todo este proyecto: plan primero, código después.

---

## 8. Pendientes — deuda técnica menor detectada durante la ejecución

Hallazgos reales, de bajo riesgo, encontrados mientras se ejecutaban las Fases 1-4. No bloquean nada ni corrompen datos — se documentan aquí para no perderlos, no para generar urgencia.

- ~~**Bloques `CREATE TABLE IF NOT EXISTS` obsoletos en `aplicarMigraciones()` (server.js) para Favoritos (Fase 1) y Reseñas (Fase 3).**~~ ✅ Resuelto — 2026-07-18. Se eliminaron los 11 bloques restantes (7 de Favoritos, 4 de Reseñas — incluyendo dos `ALTER TABLE ... ADD COLUMN` sueltos sobre `ReviewCultura`/`ReviewExpress` que no estaban co-ubicados con su `CREATE TABLE` original y que la primera pasada de limpieza no detectó), 163 líneas en total. Verificado con dos reinicios consecutivos del backend sin ningún error en `[MIGRACIÓN]`.
- **Lógica de descuento por Alianza Comercial (`esAlianza`) duplicada en los 5 validadores de cupón** (Marketplace + los 4 verticales), descubierto durante la Fase 4 pero fuera de su alcance aprobado (el usuario aprobó solo unificar los 4 verticales de servicio, no tocar Alianzas). Vive fuera de los 11/12 modelos de cupón, en `AlianzaComercial`/`AlianzaSocio`, con un patrón de fallback casi idéntico repetido en cada `*.service.js`. Candidato a extraer a un helper compartido en una sesión futura, con el mismo cuidado que ya se aplicó al helper `utils/cupon-vertical.js`.

---

*Referencia: [Capítulo 3 — Arquitectura del Ecosistema por Módulo](03-arquitectura-por-modulo.md) · [Anexo A — Auditoría técnica de los 4 módulos parciales](07-auditoria-tecnica-modulos-parciales.md)*
