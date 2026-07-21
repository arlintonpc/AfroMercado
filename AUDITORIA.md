# AfroMercado / Teravia — Auditoría técnica y plan de corrección

> Generado explorando el código real de `D:\AfroMercado` (backend `afromercado/`, frontend `afromercado-web/`) con 3 agentes de investigación en paralelo (seguridad/consistencia, TODOs/pendientes, frontend/UX), cruzado con `ARQUITECTURA.md`. Fecha: 2026-07-19.
>
> **Estado: Fase A, Fase B y la decisión de comisión de Transporte (Fase C) ya están implementadas y verificadas** (144 tests backend pasando, lint frontend sin nuevos errores, backend y frontend corriendo en local sin errores). Quedan pendientes de decisión: 2.2 (overrides de comisión en Hotel/Tour), 2.3 (cupón inválido en Tour), 2.6 (Alianzas/Cultura), y toda la Fase D (arquitectura a futuro). Ver checklist al final de cada sección.

## Cómo leer esto

- 🔴 **Crítico** — seguridad explotable o pérdida de dinero/datos activa.
- 🟠 **Alto** — funcionalidad rota en silencio o hueco de seguridad condicional (depende de config de entorno).
- 🟡 **Medio** — inconsistencia de negocio o validación débil, sin explotación directa conocida.
- ⚪ **Bajo** — deuda técnica, accesibilidad, mantenibilidad.
- 🤔 **Decisión de negocio requerida** — antes de "corregir" hay que confirmar si el comportamiento actual es un bug o una decisión intencional no documentada.

---

## 1. Seguridad

### 🟠 1.1 CORS: fallback abierto si falta `CORS_ORIGIN` en producción
`afromercado/src/app.js:19-31`. Si `CORS_ORIGIN` no está seteada (o queda vacía) en Render, `origin` cae a `true` — con `credentials: true` esto refleja dinámicamente cualquier origen, habilitando peticiones autenticadas cross-origin desde cualquier sitio (vector CSRF/robo de sesión). No hay guardia que aborte el arranque en producción si falta, a diferencia del patrón ya usado en `cuentas-dispersion.js` para `CUENTAS_DISPERSION_SECRET`.
**Fix**: en `NODE_ENV === "production"`, si `origenesPermitidos.length === 0`, lanzar error de arranque (mismo patrón que `obtenerClaveCifrado()`).

### 🟠 1.2 Rate limiting se desactiva si `NODE_ENV` no es exactamente `"production"`
`afromercado/src/app.js:132-134`. Un typo o falta de configuración en Render deja login/checkout sin límite de intentos, sin ningún aviso.
**Fix**: agregar un log de advertencia en arranque si `NODE_ENV !== "production"` en un host que no sea localhost, o hacer el rate limit opt-out explícito en vez de opt-in por valor exacto de string.

### 🟡 1.3 Secreto con fallback inseguro sin guardia de producción
`afromercado/src/utils/cuentas-dispersion.js:40` (`hashCuenta`) — fallback `"afromercado-dev"` si faltan `CUENTAS_DISPERSION_SECRET`/`JWT_SECRET`, sin el mismo guard que `obtenerClaveCifrado()` (líneas 50-56) ya tiene. Si falta en prod, los hashes de cuentas bancarias se generan con una clave conocida en el código fuente.
**Fix**: aplicar el mismo guard de `NODE_ENV === "production"` que ya existe 15 líneas más abajo en el mismo archivo.

### ⚪ 1.4 Patrón frágil de SQL interpolado (no explotable hoy)
`afromercado/src/controllers/publicidad.controller.js:1147,1155,1165` — `truncFn` se interpola directo en el SQL, protegido hoy por una whitelist de 2 valores. Si alguien agrega un tercer valor a la whitelist sin revisar este archivo, se abre la puerta a inyección. Sin acción urgente, dejar comentario de advertencia en el código.

**Sin hallazgos**: inyección SQL explotable, IDOR en los flujos auditados (Pedido/Producto/Comercio/Reservas), secretos de API hardcodeados, endpoints de mutación sin autenticación real.

---

## 2. Lógica de negocio / dinero — inconsistencias entre verticales

### 🔴 2.1 Transporte: sin comisión de plataforma + sin lock pesimista (race condition real)
`afromercado/src/services/transporte.service.js`. Dos problemas distintos en el mismo módulo:
- **Sin comisión**: `crearReserva` nunca calcula ni guarda `comision`/`tasaComision` — el modelo `ReservaTransporte` ni siquiera tiene esas columnas. Es el único de los 4 verticales de servicio sin comisión de plataforma.
- **Sin lock pesimista**: `verificarDisponibilidad` (líneas 98-112) se llama antes de abrir la transacción, y la creación dentro de `$transaction` (126-175) no usa `SELECT ... FOR UPDATE` ni un `UPDATE` atómico condicional. Dos reservas concurrentes sobre la misma ruta/fecha pueden ambas pasar la verificación y sobrevender asientos — confirmado como hueco real (contraste con Hotel/Tour que sí usan lock, y con Cultura que usa `UPDATE` atómico).

🤔 **Decisión de negocio**: ¿la ausencia de comisión en Transporte es intencional (ej. incentivo para operadores fluviales) o un olvido? Si es intencional, el lock pesimista igual debe agregarse (es un bug de concurrencia puro, no de negocio).

### 🟡 2.2 Hotel y Tour: comisión fija 10% hardcodeada, sin cascada de overrides
A diferencia de Express y el Marketplace general (que resuelven `ComisionComercio` → `Config` global → default), Hotel y Tour ignoran cualquier override específico por comercio.
🤔 **Decisión de negocio**: ¿se necesita que Hotel/Tour respeten overrides de comisión por comercio (ej. para alianzas institucionales o negociaciones especiales)? Si sí, es un fix de arquitectura (extraer `resolverTasaComision` a un util compartido y usarlo en los 4 módulos).

### 🟡 2.3 Tour: cupón inválido se ignora en silencio
El servicio de Tour, si el cupón no es válido, continúa la reserva sin descuento sin informar al usuario del motivo — a diferencia del resto de la plataforma, donde un cupón inválido rechaza el checkout con mensaje claro.
**Fix**: propagar el error de validación de cupón como en Hotel/Express/Marketplace, o al menos devolver un aviso explícito en la respuesta para que el frontend lo muestre.

### 🟡 2.4 Facturación: módulos sin `resolver` implementado explotan en runtime, no en build
`afromercado/src/services/facturacion.service.js:113` — si `moduloOrigen` está en el enum `MODULOS_VALIDOS` pero no tiene entrada en `RESOLVERS`, lanza error solo cuando se intenta facturar, no antes.
**Fix**: test que verifique en CI que todo `MODULOS_VALIDOS` tiene su `RESOLVERS[modulo]` correspondiente (previene que se repita al agregar el próximo módulo).

### 🟡 2.5 Validación de entrada débil en precio/stock y salario/vacantes
- `afromercado/src/services/producto.service.js:60-79` — `parseFloat(precio) <= 0` no captura `NaN` (string no numérico pasa sin error); `stock`/`stockMinimo` no se valida ≥ 0.
- `afromercado/src/services/empleo.service.js:72-115` — `salarioMin`/`salarioMax`/`vacantes` sin chequeo de `NaN` ni de negativos.
- Contraste: `afromercado/src/services/inmueble.service.js:33` sí usa `Number.isNaN(...) || ... <= 0`, patrón correcto a replicar.
**Fix**: extraer un helper `validarMontoPositivo(valor, nombreCampo)` reutilizable y aplicarlo en los 3 servicios (y cualquier otro con el mismo patrón).

### 🟡 2.6 Alianzas: TODO de negocio sin implementar
`afromercado/src/services/alianza.service.js:248-251` — un socio puede retirarse de una alianza aunque esté anclada a un evento de Cultura en curso, dejando el evento sin ese socio a mitad de campaña.
**Fix**: bloquear el retiro si existe un `EventoCultural` vinculado con estado activo/publicado dentro de la vigencia de la alianza (mismo patrón que ya existe para "no retirarse en los últimos 7 días").

### ⚪ 2.7 Validación DANE no aplicada de forma consistente
`afromercado/src/utils/ubicacion.js` (`validarUbicacion`) solo se invoca en `comercio.service.js` y `direccion.service.js`. Empleo, Inmueble, Cultura, Alianzas y los 4 verticales de servicio aceptan `departamento`/`municipio` como texto libre sin validar contra el catálogo en el backend (solo el dropdown del frontend lo restringe).
**Fix** (bajo riesgo, alto valor): aplicar `validarUbicacion` en los services de esos módulos — es una función ya existente, solo falta invocarla.

---

## 3. Funcionalidad rota en silencio

### 🟠 3.1 Push notifications nunca se muestran al usuario
`afromercado-web/public/sw.js` — no tiene `self.addEventListener('push', ...)` ni `notificationclick`. El backend (`utils/push.js`, vía `web-push`) envía correctamente, el frontend suscribe correctamente (`PushContext.tsx`), pero el navegador nunca recibe la instrucción de mostrar la notificación. **Toda la infraestructura de push está construida pero es invisible para el usuario final.**
**Fix**: agregar el listener `push` (parsear el payload JSON, llamar `self.registration.showNotification(titulo, {body, icon, data})`) y `notificationclick` (enfocar/abrir la `url` del payload). Es un cambio acotado a un archivo.

### 🟡 3.2 `cron.js:58` — catch completamente silencioso (sin log)
`afromercado/src/utils/cron.js:58`, dentro de `cancelarReservasExpiradas` (hotel): `catch {}` sin ningún `console.error`, inconsistente con el resto del archivo que sí loguea. Si falla la notificación de cancelación automática, no queda ningún rastro.
**Fix**: agregar `console.error` igual que los demás catches del archivo.

### ⚪ 3.3 Patrón de notificación fire-and-forget sin abstracción común
~30 sitios en services/controllers repiten el mismo `catch (e) { console.error("[NOTIF...]", e.message); }` sin relanzar (intencional — un fallo de notificación no debe tumbar la operación de negocio). Es correcto en espíritu pero está duplicado sin una función/wrapper común, lo que hace fácil que una copia nueva olvide el catch.
**Fix opcional**: extraer un wrapper `notificarSinFallar(fn, contexto)` reutilizable — ya existe algo similar en `notificacion.service.js` (`dispararNotificacion`), evaluar si se puede generalizar a los demás services.

---

## 4. Frontend — UX y manejo de errores

### 🟡 4.1 Errores de red tragados sin feedback al usuario
Patrón recurrente: `.catch(() => {})` o `catch { /* silencioso */ }` en decenas de páginas (`app/admin/categorias/page.tsx:50`, `app/admin/usuarios/page.tsx:70-71`, `app/empleo/page.tsx:60-61`, `app/hoteles/[id]/page.tsx:1115+`, `app/tours/[id]/page.tsx`, `app/express/[id]/page.tsx`, `app/comerciante/express|tours/page.tsx`, `app/pedido/[id]/page.tsx:134-137`, entre otros). El usuario ve una lista vacía o un estado congelado sin ninguna pista de que algo falló.

### 🟡 4.2 Spinners infinitos por `catch` faltante
`app/admin/hoteles/page.tsx:26`, `app/admin/tours/page.tsx:159`, `app/admin/transportes/page.tsx:15`, `app/tours/mis-reservas/page.tsx:49`, `app/comerciante/tours/page.tsx:82-101`, `app/comerciante/transportes/page.tsx:198-237` — si el fetch falla, `setCargando(false)` nunca se ejecuta porque no hay `.catch`/`finally`. La pantalla queda en spinner permanente, indistinguible de un cuelgue real.
**Fix**: patrón único `try/catch/finally` (con `finally { setCargando(false) }`) aplicado a estos ~10 puntos — es mecánico, buen candidato para un solo agente dedicado.

### ⚪ 4.3 Accesibilidad — labels sin `htmlFor`, galerías sin teclado
Patrón sistémico: de 71 archivos con `<label>`, solo 13 usan `htmlFor`/`id` (`components/empleo/FormularioOferta.tsx`, `components/bienes-raices/FormularioInmueble.tsx` entre los peores, 0 de ~16 labels asociados). Galerías de fotos con `<div onClick>` sin `role="button"`/`tabIndex`/`onKeyDown` en `hoteles/[id]`, `tours/[id]`, `transportes/[id]`. `app/checkout/page.tsx` es la excepción correcta a imitar.

### ⚪ 4.4 Total del checkout compuesto en el cliente
`app/checkout/page.tsx:684-688` — el total mostrado se suma en el frontend a partir de piezas obtenidas por separado (`validarCupon`, `calcularEnvio`), no de un único total devuelto por el backend. Riesgo bajo hoy, pero cualquier cambio de fórmula en el backend requiere recordar actualizar este cálculo también.

### ⚪ 4.5 Tipos `any` en la capa de API del frontend
`lib/api/transporte.ts:245`, `lib/api/tour.ts:387`, `lib/api/express.ts:241,398`, `lib/api/hotel.ts:457,514`, `lib/api/admin.ts` (varios), `lib/api/repartidor.ts` — justo donde el cliente HTTP debería garantizar tipos, la respuesta se tipa `any`. Bajo riesgo funcional, alto costo de mantenibilidad a largo plazo.

**Sin hallazgos relevantes**: rutas huérfanas/rotas, `console.log` de debug olvidados (cero encontrados), imágenes sin `alt` (solo 1 caso), layouts rotos en móvil.

---

## 5. Deuda de documentación (arreglo trivial, alto valor)

- `DEPLOY.md` (raíz) menciona `prisma migrate deploy` en el build de Render — **incorrecto y peligroso de seguir al pie de la letra**: el pooler de Neon lo bloquea; las migraciones reales se aplican en `aplicarMigraciones()` al arrancar. Ya señalado en `ARQUITECTURA.md:965`.
- `CLAUDE.md` dice "tests unitarios: comisión, productos, pago-repartidor" — en realidad hay **9 suites, 143 tests**, todos pasando (comisión, producto, pago-repartidor, pago-digital, hotel, tour, transporte, disputa, cultura).
- `.env.example` no incluye `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `SENTRY_DSN` — variables usadas en código real (ya señalado en `ARQUITECTURA.md:988-993`).
- `@next/font` en `afromercado-web/package.json` es una dependencia obsoleta (reemplazada por `next/font` integrado desde Next 13.2); convivir con Next 16 no tiene sentido, candidata a eliminar.

---

## 6. Huecos de arquitectura ya documentados (sin implementar)

Tomados de `ARQUITECTURA.md`, sección 11 — los incluyo aquí porque son candidatos reales a plan de trabajo, no solo notas:

1. **No existe rol institucional** (alcaldías/gobernaciones) — el Directorio B2G funciona hoy sin autenticación. Si el pivote institucional (ver memoria `strategic_pivot_institucional`) avanza, esto se vuelve bloqueante.
2. **ADMIN es monolítico** — sin `permisosAdmin String[]` ni separación de funciones. Hoy cualquier ADMIN puede tocar cualquier cosa (pagos, moderación, config global). Riesgo si el equipo de moderación crece más allá de 1-2 personas de confianza total.

---

## 7. Propuesta de arquitectura y diseño — a futuro

Estas son propuestas, no bugs — para decidir si entran al roadmap:

1. **Unificar comisión de plataforma en un solo util compartido** (`resolverTasaComision(comercioId, moduloOrigen)`) usado por Marketplace, Express, Hotel, Tour y (si se decide) Transporte, en vez de 4 implementaciones independientes con comportamiento distinto. Resuelve 2.1/2.2 de raíz y previene que el 5º módulo repita el problema.
2. **Rol institucional ligero** para el Directorio B2G: no necesita ser un `Rol` nuevo en el enum — podría bastar con una tabla `CuentaInstitucional` con su propio JWT de alcance reducido (solo lectura del directorio), evitando tocar el modelo de roles de comerciantes/compradores.
3. **`permisosAdmin` granular**: agregar `String[]` al `Usuario` (solo relevante para `rol: ADMIN`), con constantes tipo `MODERAR_DENUNCIAS`, `GESTIONAR_PAGOS`, `CONFIG_GLOBAL`, `VER_REPORTES`. Cambio de bajo riesgo (aditivo, con default "todos los permisos" para admins existentes, así no rompe nada retroactivamente).
4. **Validación de ubicación centralizada**: mover `validarUbicacion` a un middleware reutilizable (`validarUbicacionMiddleware(camposDept, camposMuni)`) en vez de exigir que cada service recuerde invocarla — reduce la brecha de 2.7 a nivel estructural, no solo parche puntual.
5. **Wrapper único para notificaciones fire-and-forget**: generalizar `dispararNotificacion` (ya existe en `notificacion.service.js`) para que todos los `setImmediate(async () => {...})` repetidos en 20+ services lo usen, en vez de reimplementar el mismo `try/catch` cada vez.
6. **Test de integridad schema↔migraciones**: un script simple (`npm run verificar-schema`) que parsee `schema.prisma` y el array de `aplicarMigraciones()` y falle si una columna del schema no tiene su `ALTER TABLE ADD COLUMN IF NOT EXISTS` — convierte el riesgo documentado en `ARQUITECTURA.md:103` en algo detectable en CI en vez de descubrirlo en producción.
7. **Service Worker**: además del listener `push` (fix 3.1), aprovechar para agregar `notificationclick` con deep-linking a la URL relevante (pedido, reserva, etc.) — ya hay un campo `url` en el modelo `Notificacion` listo para usarse.

---

## 8. Plan de corrección propuesto (por fases)

**Fase A — ✅ Implementada (2026-07-19):**
- ✅ 1.1 CORS guard en producción (`app.js`)
- ✅ 1.2 Advertencia de rate limiting si `NODE_ENV` no coincide (`app.js`)
- ✅ 1.3 Guard de secreto en `hashCuenta` (`cuentas-dispersion.js`)
- ✅ 3.1 Listener `push` + `notificationclick` en `sw.js`
- ✅ 3.2 Log en catch silencioso de `cron.js` (hotel)
- ✅ 2.5 Validación NaN/negativos en `producto.service.js` y `empleo.service.js`
- ✅ 2.7 `validarUbicacion` agregada en empleo, inmueble, cultura (eventos y publicaciones), alianzas — hotel/tour/express confirmados sin campo propio de ubicación (usan el de `comercio`, ya validado)
- ✅ 5.x Documentación: `DEPLOY.md`, `CLAUDE.md`, `.env.example`, `@next/font` eliminado de `package.json`

**Fase B — ✅ Implementada (2026-07-19):**
- ✅ 4.2 Corregidos los ~10 puntos de spinner infinito (try/catch/finally) en admin hoteles/tours/transportes, comerciante tours/transportes, tours/mis-reservas
- ✅ 4.1 Feedback visible agregado en categorías, usuarios, empleo, hoteles/[id], tours/[id], express/[id]
- ✅ 4.3 Labels asociados con `htmlFor` en `FormularioOferta.tsx` y `FormularioInmueble.tsx` (15/16 y 15/17 — los 2-3 restantes son encabezados de grupo de botones, no controles únicos)
- Verificado: `npm run lint` sin errores nuevos (mismo baseline: 140 preexistentes, ninguno introducido)

**Fase C — parcialmente resuelta:**
- ✅ **2.1 Transporte** — decisión tomada: agregar comisión (10%, igual que Hotel/Tour). Implementado: columnas `comision`/`tasaComision` en `ReservaTransporte` (schema + migración dual en `server.js`), lock pesimista (`SELECT ... FOR UPDATE` sobre `RutaTransporte` dentro de la transacción, cierra la condición de carrera de sobreventa), cálculo de comisión en `crearReserva`, estadísticas actualizadas (`comisionTotal`/`comisionMes`), `disputa.service.js` simplificado para usar la comisión ya guardada en vez del fallback por `ComisionComercio`. Test nuevo agregado y pasando (144 tests totales, 0 fallos).
- ⬜ 2.2 Hotel/Tour: ¿deben respetar overrides de comisión por comercio? — pendiente de tu decisión.
- ⬜ 2.3 Tour: cupón inválido → ¿rechazar el checkout o solo avisar sin bloquear? — pendiente de tu decisión.
- ⬜ 2.6 Alianzas: bloquear retiro durante evento Cultura activo — pendiente de tu decisión.

**Fase D — Arquitectura a futuro (roadmap, no urgente, sin empezar):**
- Sección 7 completa (unificación de comisión, rol institucional, permisos admin granulares, etc.)

---

## Cómo seguimos

Fases A y B completas y verificadas (tests + lint + servidores corriendo). Quedan 3 decisiones puntuales de Fase C (2.2, 2.3, 2.6) y la Fase D como roadmap a futuro — dime cuándo quieres retomarlas.
