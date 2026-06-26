# Implementacion de videos cortos en AfroMercado

Fecha: 2026-06-26

## Objetivo

Permitir que un producto o un comercio tenga un video corto adicional al catalogo de fotos, para mostrar mejor:

- el producto en uso
- la finca o el proceso de produccion
- el turismo
- la experiencia del comercio
- la gastronomia

La idea es que el video sea corto, liviano y util en la plataforma.

## Resultado funcional

Se implemento:

- subida de video para productos
- subida de video para comercios
- eliminacion o reemplazo del video
- vista publica del video en la pagina del producto
- vista publica del video en la pagina del comercio
- badge visual en tarjetas y dashboard cuando un producto tiene video
- validacion de duracion maxima de 45 segundos
- validacion de peso maximo de 100 MB
- conversion/optimizacion para reproduccion liviana
- guardado de metadatos tecnicos del video

## Reglas de negocio

- El video no puede superar 45 segundos.
- El archivo puede llegar en formatos de video comunes; el backend acepta archivos cuyo MIME sea `video/*` y tambien extensiones de video frecuentes.
- Si existe Cloudinary, el video se publica en una version optimizada para reproduccion.
- Si Cloudinary no esta disponible, el sistema conserva una ruta local como respaldo.
- Solo el propietario del producto o del comercio puede cambiar su video.

## Backend

### Nuevos archivos

- `afromercado/src/utils/video-media.js`
- `afromercado/prisma/migrations/20260626140000_video_media_fields/migration.sql`

### Archivos modificados

- `afromercado/src/utils/cloudinary.js`
- `afromercado/src/app.js`
- `afromercado/prisma/schema.prisma`
- `afromercado/src/controllers/producto.controller.js`
- `afromercado/src/controllers/comercio.controller.js`
- `afromercado/src/services/producto.service.js`
- `afromercado/src/services/comercio.service.js`
- `afromercado/src/repositories/producto.repository.js`
- `afromercado/src/routes/producto.routes.js`
- `afromercado/src/routes/comercio.routes.js`

### Que hace cada parte

- `src/utils/video-media.js`
  - crea el uploader de video con `multer`
  - valida tipo de archivo
  - extrae metadatos enviados desde el frontend
  - construye la URL local de respaldo
  - elimina archivos locales cuando ya no se usan

- `src/utils/cloudinary.js`
  - mantiene la subida de imagenes
  - agrega subida de video
  - agrega eliminacion de recursos de video
  - construye URL derivada optimizada:
    - formato `mp4`
    - calidad automatica
    - ancho maximo 960px
  - construye poster del video desde el segundo 1

- `src/controllers/producto.controller.js`
  - agrega `POST /api/productos/:id/video`
  - agrega `DELETE /api/productos/:id/video`
  - valida duracion antes y despues de subir
  - limpia el archivo temporal al terminar

- `src/controllers/comercio.controller.js`
  - agrega `POST /api/comercios/video`
  - agrega `DELETE /api/comercios/video`
  - valida duracion antes y despues de subir
  - limpia el archivo temporal al terminar

- `src/services/producto.service.js`
  - guarda el video en el producto
  - elimina el video anterior al reemplazarlo
  - limpia Cloudinary o almacenamiento local segun corresponda

- `src/services/comercio.service.js`
  - guarda el video en el comercio
  - elimina el video anterior al reemplazarlo
  - limpia Cloudinary o almacenamiento local segun corresponda

- `src/repositories/producto.repository.js`
  - expone los campos de video en consultas publicas y listados

- `src/app.js`
  - expone el directorio local de videos cuando se usa respaldo en disco

### Metadatos guardados

Se agregaron campos para producto y comercio:

- `videoUrl`
- `videoPosterUrl`
- `videoPublicId`
- `videoDuracionSegundos`
- `videoAncho`
- `videoAlto`
- `videoBytes`
- `videoFormato`
- `videoMimeType`

### Observacion sobre gastronomia

Si el producto es gastronomico, conviene conservar esa clasificacion como metadata de negocio. En esta version, eso puede vivir en la categoria/subcategoria existente del producto o del comercio. Si mas adelante se quiere filtrar mejor por turismo, cocina o experiencias, se puede agregar un campo semantico adicional sin romper esta implementacion.

## Base de datos

Se agregaron columnas nuevas en:

- `Comercio`
- `Producto`

La migracion queda en:

- `afromercado/prisma/migrations/20260626140000_video_media_fields/migration.sql`

## Frontend

### Nuevos archivos

- `afromercado-web/components/comerciante/SubidorVideo.tsx`
- `afromercado-web/components/catalogo/VideoDestacado.tsx`

### Archivos modificados

- `afromercado-web/components/comerciante/api.ts`
- `afromercado-web/lib/mapearProducto.ts`
- `afromercado-web/types/producto.ts`
- `afromercado-web/app/producto/[id]/page.tsx`
- `afromercado-web/app/producto/[id]/layout.tsx`
- `afromercado-web/app/comercio/[id]/page.tsx`
- `afromercado-web/app/comerciante/publicar/page.tsx`
- `afromercado-web/app/comerciante/productos/[id]/editar/page.tsx`
- `afromercado-web/app/comerciante/perfil/page.tsx`
- `afromercado-web/app/comerciante/dashboard/page.tsx`
- `afromercado-web/app/sitemap.ts`
- `afromercado-web/components/catalogo/TarjetaProducto.tsx`

### Que hace cada parte

- `components/comerciante/SubidorVideo.tsx`
  - muestra el video actual
  - permite subir o reemplazar video
  - permite eliminarlo
  - lee metadatos del archivo en el navegador
  - valida que no pase de 45 segundos
  - valida que no pase de 100 MB

- `components/catalogo/VideoDestacado.tsx`
  - muestra el video en paginas publicas
  - recibe poster, duracion y MIME

- `components/comerciante/api.ts`
  - agrega las funciones:
    - `subirVideoProducto`
    - `quitarVideoProducto`
    - `subirVideoComercio`
    - `quitarVideoComercio`
  - normaliza la respuesta del backend

- `lib/mapearProducto.ts` y `types/producto.ts`
  - incorporan los nuevos campos del video en el modelo del frontend

- Paginas actualizadas
  - al publicar un producto, ahora se puede subir video
  - al editar un producto, ahora se puede cambiar o quitar video
  - en el perfil del comerciante, ahora se puede subir video del comercio
  - en el detalle publico del producto, el video aparece debajo de la galeria
  - en el detalle publico del comercio, el video aparece en la cabecera

## Compatibilidad de reproduccion

- La subida acepta cualquier formato de video reconocido por el navegador y/o por la extension del archivo.
- La reproduccion publica usa la derivacion optimizada de Cloudinary:
  - `mp4`
  - calidad automatica
  - ancho maximo de 960px
- El poster se genera automaticamente para dar mejor carga inicial.

## Verificacion realizada

Se ejecuto validacion tecnica y quedo correcta:

- backend: `npm test`
- frontend: `npm run lint`

## Notas de implementacion

- El flujo esta pensado para no bloquear la experiencia publica del catalogo.
- El video es un recurso adicional, no reemplaza las fotos.
- La parte visual se mantuvo liviana para no afectar demasiado el rendimiento de carga.
- Los cambios dejan la base lista para futuras mejoras como:
  - recorte automatico
  - compresion mas agresiva
  - subtitulos
  - video destacado por categoria
  - analiticas de reproduccion

