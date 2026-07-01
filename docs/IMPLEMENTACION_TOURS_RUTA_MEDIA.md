# Implementacion: ruta, lugares y media para tours

Fecha: 2026-06-30

## Resumen

Se implemento la primera fase del modulo de turismo por lugares/paradas. El objetivo es que cada tour pueda contar una ruta completa, donde el comerciante agregue lugares con fotos, un video corto propio y varios enlaces de video externos desde redes sociales.

La solucion mantiene el video general del tour como pieza de portada, y agrega una estructura separada para los lugares del recorrido. Esto evita mezclar la narrativa principal del tour con el contenido especifico de cada parada.

## Decision tecnica

Se eligio una estructura flexible:

- `ConfigTour`: sigue representando el tour principal.
- `TourLugar`: representa una parada, lugar o experiencia dentro del tour.
- `TourLugarMedia`: representa fotos, video propio o enlaces externos asociados al lugar.

Tipos de media soportados:

- `FOTO`: imagen real del lugar.
- `VIDEO`: video corto propio subido a la plataforma.
- `VIDEO_LINK`: enlace externo a redes o plataformas de video.

## Base de datos

Archivos modificados:

- `afromercado/prisma/schema.prisma`
- `afromercado/prisma/migrations/20260804000000_tour_lugares_media/migration.sql`
- `afromercado/src/server.js`

Tablas nuevas:

- `TourLugar`
- `TourLugarMedia`

Indices agregados:

- `TourLugar(configTourId, orden)`
- `TourLugar(configTourId, activo)`
- `TourLugarMedia(tourLugarId, orden)`
- `TourLugarMedia(tipo)`

El `server.js` tambien incluye creacion defensiva de tablas e indices para entornos donde se usa auto-DDL.

## API backend

Archivos modificados:

- `afromercado/src/services/tour.service.js`
- `afromercado/src/controllers/tour.controller.js`
- `afromercado/src/routes/tour.routes.js`

Endpoints nuevos para comerciantes:

- `GET /tours/mi-tour/lugares`
- `POST /tours/mi-tour/lugares`
- `PATCH /tours/mi-tour/lugares/orden`
- `PATCH /tours/mi-tour/lugares/:id`
- `DELETE /tours/mi-tour/lugares/:id`
- `POST /tours/mi-tour/lugares/:id/fotos`
- `POST /tours/mi-tour/lugares/:id/video`
- `DELETE /tours/mi-tour/lugares/:id/video`
- `POST /tours/mi-tour/lugares/:id/video-link`
- `DELETE /tours/mi-tour/lugares/:id/media/:mediaId`

Reglas implementadas:

- Hasta 30 lugares activos por tour.
- Hasta 24 fotos por lugar.
- Hasta 8 enlaces externos de video por lugar.
- Un video propio activo por lugar.
- Eliminacion logica para lugares y media (`activo = false`).
- Validacion basica de enlaces `http` y `https`.
- Deteccion de plataforma para enlaces: YouTube, Instagram, TikTok, Facebook, Vimeo o Web.

## Frontend comerciante

Archivos modificados:

- `afromercado-web/lib/api/tour.ts`
- `afromercado-web/app/comerciante/tours/page.tsx`

Se agrego una nueva pestana:

- `Ruta`

Funciones disponibles:

- Crear lugar/parada.
- Editar nombre, tipo, descripcion, duracion, recomendaciones y destacado.
- Reordenar con botones `Subir` y `Bajar`.
- Subir fotos por lugar.
- Eliminar fotos, videos y enlaces.
- Subir video corto propio con el flujo existente de recorte hasta 45 segundos.
- Agregar multiples enlaces externos de video.

La interfaz se planteo como acordeon para evitar una pantalla pesada: cada lugar muestra resumen cerrado y al abrir expone sus controles.

## Frontend publico

Archivo modificado:

- `afromercado-web/app/tours/[id]/page.tsx`

Se agrego la seccion:

- `Ruta y lugares que vas a conocer`

Comportamiento:

- Muestra los lugares ordenados como linea de tiempo.
- Cada lugar presenta portada, descripcion corta, contadores de fotos/video/enlaces y duracion si existe.
- Al abrir un lugar se muestran recomendaciones, galeria, video corto propio y enlaces externos.
- Los enlaces externos se abren fuera de la plataforma para evitar iframes pesados en el render inicial.
- Las fotos de cada lugar pueden abrirse en el lightbox existente.

## Rendimiento

Decisiones tomadas:

- El listado publico de tours se mantiene liviano y no carga lugares.
- El detalle de un tour si carga `lugares` y `media`.
- Los videos externos no se embeben automaticamente.
- Las imagenes de lugares usan `loading="lazy"` en la vista publica.
- El video propio conserva el flujo de conversion/optimizacion existente.

## Verificacion

Comandos ejecutados:

- `npm.cmd run build` en `afromercado` para `prisma generate`.
- `npm.cmd run build` en `afromercado-web` para build de Next.js.
- `npm.cmd test` en `afromercado`.
- `node --check` en archivos backend modificados.
- `git diff --check`.

Resultado:

- Prisma Client generado correctamente.
- Build frontend de produccion exitoso.
- Pruebas backend existentes exitosas.
- Sintaxis backend correcta.
- `git diff --check` sin errores, solo avisos CRLF normales en Windows.

## Correccion posterior: uploads y guardado

Se corrigieron tres problemas detectados al probar en `localhost`:

- `apiFetch` ahora detecta `FormData` y no lo serializa como JSON. Esto permite subir fotos y videos correctamente.
- `subirFotosTour` ahora usa el cliente HTTP centralizado y la llave correcta del token (`afromercado_token`).
- `actualizarTour` ahora usa lista blanca de campos para evitar enviar relaciones como `comercio` o `lugares` a Prisma.

Tambien se ajusto el fallback local de videos para no borrar el archivo subido cuando Cloudinary no esta configurado.

## Correccion visual y subida de imagenes

Se agrego una segunda mejora al panel del comerciante:

- Las fotos de lugares ahora usan un boton real que abre un input oculto por referencia.
- Se valida en el navegador que cada archivo sea imagen y no supere 8 MB.
- El input de imagenes se limpia al terminar, permitiendo volver a subir el mismo archivo si hace falta.
- El backend devuelve un mensaje claro si no recibe imagenes validas.
- El bloque de media de cada lugar ahora muestra fotos y video en columnas equilibradas.
- El video de cada parada usa modo compacto para funcionar como mini video, sin dominar toda la pantalla.

## Notas operativas

Durante la generacion de Prisma fue necesario detener procesos locales Node del backend porque tenian bloqueado `query_engine-windows.dll.node`.

## Siguientes fases recomendadas

1. Agregar mapa por lugar usando latitud/longitud.
2. Permitir videos por lugar con titulo y descripcion visibles en publico.
3. Moderacion/admin de lugares destacados o reportados.
4. SEO estructurado para rutas turisticas.
5. Metricas por lugar: vistas, clics en enlaces, reproducciones y conversion a reserva.
