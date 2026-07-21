# AfroMercado / Teravia — Documentación técnica completa

> **Qué es esto**: referencia técnica exhaustiva del proyecto, escrita para que cualquier agente de IA o persona humana sin contexto previo pueda entender la arquitectura completa y cada módulo sin tener que leer todo el código fuente. Generada explorando directamente el código real (no memoria ni suposiciones) en `D:\AfroMercado`.
>
> **Cómo mantenerla al día**: este documento describe el estado del código en el momento en que se escribió. El código evoluciona; si algo aquí contradice lo que ves en el repo, **confía en el código**. Antes de basar una decisión importante en una afirmación de aquí (un nombre de función, un endpoint, una regla de negocio), verifícala rápido con `grep`/lectura del archivo citado.

## Índice

0. [Visión general del proyecto](#0-visión-general-del-proyecto)
1. [Arquitectura del backend](#1-arquitectura-del-backend)
2. [Marketplace general (Pedido / Carrito)](#2-marketplace-general-pedido--carrito)
3. [Producto y Comercio](#3-producto-y-comercio)
4. [Categorías](#4-categorías)
5. [Denuncias](#5-denuncias)
6. [Reseñas, Favoritos y Cupones](#6-reseñas-favoritos-y-cupones)
7. [Pagos (Wompi)](#7-pagos-wompi--flujo-de-pago-y-dispersión)
8. [Servicios especializados: Express, Hotel, Tour, Transporte](#8-servicios-especializados)
9. [Módulos comunitarios/institucionales](#9-módulos-comunitariosinstitucionales)
10. [Arquitectura frontend](#10-arquitectura-frontend)
11. [Roles y permisos](#11-roles-y-permisos)
12. [Notificaciones](#12-notificaciones)
13. [Asistente de IA por WhatsApp](#13-asistente-de-ia-por-whatsapp)
14. [Seguridad y denuncias (resumen transversal)](#14-seguridad-y-denuncias-resumen-transversal)
15. [Deploy y entornos](#15-deploy-y-entornos)
16. [Convenciones de desarrollo](#16-convenciones-de-desarrollo)

---

## 0. Visión general del proyecto

**AfroMercado** (marca visible al usuario: **Teravia**) es un marketplace cultural y de servicios nacido para comunidades afrocolombianas del Chocó, en expansión hacia una plataforma regional/nacional. Combina un **marketplace de productos físicos** (estilo e-commerce clásico, con carrito/checkout/envío) con **cuatro verticales de servicios reservables** (Express/comida, Hoteles, Tours, Transporte) y una capa creciente de **módulos comunitarios/institucionales** (Empleo, Bienes Raíces, Cultura, Agro, Servicios Profesionales, Alianzas Comerciales) pensados para cubrir la economía informal y territorial que no encaja en un e-commerce tradicional (productores sin RUT, oferta de trabajo comunitaria, predios sin transacción formal, etc.).

**Stack:**
- Backend: Node.js + Express + Prisma ORM + PostgreSQL (Neon, serverless), en `D:\AfroMercado\afromercado`.
- Frontend: Next.js 16 (App Router) + React 19, todo `'use client'`, en `D:\AfroMercado\afromercado-web`.
- Imágenes/video: Cloudinary (subida firmada manual, sin SDK).
- Pagos: Wompi (Colombia), con arquitectura de proveedor intercambiable.
- WhatsApp: Baileys (WhatsApp Web no oficial) para notificaciones salientes y un piloto de asistente de IA (Claude/Anthropic) de solo lectura.
- Deploy: Vercel (frontend) + Render (backend) + Neon (DB).

**Principio de diseño recurrente** (verás este patrón repetirse en casi todos los módulos nuevos): antes de construir infraestructura nueva, el proyecto prefiere **reutilizar lo que ya existe** (Producto/Carrito/Checkout para Agro, `OfertaEmpleo` invertido para Servicios Profesionales, `GrupoCategoria` para Tienda Local/Agro, el patrón `Denuncia*` replicado por copia en cada vertical de riesgo). Esto reduce la superficie de mantenimiento a costa de que cada vertical no sea 100% independiente entre sí.

**Restricción de infraestructura que explica muchas decisiones de código**: la base de datos de producción (Neon) usa un *connection pooler* incompatible con el sistema de migraciones nativo de Prisma (`prisma migrate deploy`). La solución adoptada en todo el proyecto es el patrón de **migración dual**: cada cambio de schema se refleja tanto en `prisma/schema.prisma` (tipos del cliente) como en un array gigante de sentencias SQL idempotentes dentro de `aplicarMigraciones()` en `src/server.js`, que se ejecutan en cada arranque del servidor. Ver sección 1 para el detalle completo.

---

## 1. Arquitectura del backend

### Capas y enrutador raíz

El backend sigue estrictamente `routes → controllers → services → repositories → prisma`. Los controladores no acceden a Prisma directamente (salvo excepciones puntuales bien señaladas en el código); los repositorios son la única capa que llama `prisma.*`.

El enrutador raíz vive en `D:\AfroMercado\afromercado\src\routes\index.js` y monta **más de 30 subrouters** bajo `/api/`. Los más relevantes para el núcleo de la plataforma:

```js
router.use("/auth", authRoutes);
router.use("/usuario", usuarioRoutes);
router.use("/productos", productoRoutes);
router.use("/comercios", comercioRoutes);
router.use("/carrito", carritoRoutes);
router.use("/pedidos", pedidoRoutes);
router.use("/direcciones", direccionRoutes);
router.use("/reviews", reviewRoutes);
router.use("/categorias", require("./categorias.routes"));
router.use("/pagos", require("./pago.routes"));
router.use("/admin", require("./admin.routes"));
router.use("/config", require("./config.routes"));
router.use("/cupones", require("./cupon.routes"));
router.use("/favoritos", require("./favorito.routes"));
```

Después vienen los módulos de servicio (`/express`, `/hoteles`, `/tours`, `/transportes`, `/cultura`), los módulos institucionales/comunitarios (`/empleo` e `/inmueble`, montados sin prefijo propio vía `router.use("/", require("./empleo.routes"))` porque sus rutas ya incluyen el segmento en el propio archivo), `/disputas`, `config-fiscal.routes`, `facturacion.routes`, `pqrsd.routes` y `fidelizacion.routes`.

### `middlewares/auth.js`

Archivo: `D:\AfroMercado\afromercado\src\middlewares\auth.js`. Expone tres middlewares:

- **`autenticar`** — exige un JWT válido. Lo acepta de dos formas: header `Authorization: Bearer <token>` o querystring `?token=` (esto último **solo** está pensado para conexiones SSE/EventSource, que no pueden mandar headers custom). Además de validar la firma, vuelve a consultar el `Usuario` en BD para comprobar que siga `activo` y, crucialmente, compara `payload.iat` (fecha de emisión del token) contra `usuario.passwordCambiadoAt`: si el usuario cambió su contraseña **después** de que se emitió el token, la sesión se invalida aunque el JWT siga siendo criptográficamente válido. Esto cierra el hueco de "cambié mi contraseña pero mi sesión robada sigue viva".
- **`autorizar(...rolesPermitidos)`** — factory que devuelve un middleware de guarda de rol. Uso típico:
  ```js
  router.post("/productos", autenticar, autorizar("COMERCIANTE"), ProductoController.crear);
  router.get("/admin/denuncias", autenticar, autorizar("ADMIN"), ProductoController.listarDenunciasPendientes);
  ```
- **`autenticarOpcional`** — igual que `autenticar` pero nunca lanza error si no hay token; simplemente deja `req.usuario` como `null`/`undefined`. Se usa en endpoints públicos que cambian de comportamiento si el visitante está logueado (p. ej. mostrar si ya tiene un favorito marcado) sin bloquear el acceso anónimo.

En los tres casos, `req.usuario` queda con la forma `{ id, rol, nombre, comercio }` (nunca el objeto `Usuario` completo de Prisma).

### `config/index.js`

Archivo: `D:\AfroMercado\afromercado\src\config\index.js`. Distingue dos niveles de variables de entorno:

- **Obligatorias (`requerido()`)** — si faltan, **lanza excepción en el arranque** y el servidor no levanta. Hoy la única es `JWT_SECRET`.
- **Degradables (`advertirSiFalta()`)** — si faltan, el servidor arranca igual pero imprime un warning y la funcionalidad asociada queda apagada en runtime: `SENTRY_DSN` (reporte de errores), `CLOUDINARY_URL` (subida de imágenes/video), `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (push), `ANTHROPIC_API_KEY` (asistente de IA por WhatsApp).

También expone `config.comisionPorcentaje` (lee `COMISION_PORCENTAJE`, default `0.10`) y `config.jwt.expiraEn` (default `24h`).

Aparte, `src/server.js` tiene su propia función `verificarAdvertenciasArranque()` para advertencias que dependen de una consulta a BD (por ejemplo si SMTP está configurado vía la tabla `Config` en vez de variables de entorno) — se ejecuta **después** de `aplicarMigraciones()` porque necesita la tabla `Config` ya creada.

### Patrón de migraciones dual (`aplicarMigraciones()`)

Archivo: `D:\AfroMercado\afromercado\src\server.js`, función `aplicarMigraciones()`. Contiene un array `migraciones` con **más de 300 sentencias SQL individuales**, agrupadas por comentarios en bloques temáticos (Módulo Hotelería, Tours, Transporte fluvial, GrupoComplemento/Express, Cultura, Disputas, IVA, Empleo, Bienes Raíces, etc. — cada feature nueva del proyecto añade su bloque al final del array).

La razón de este patrón: el entorno de producción usa **Neon con connection pooler**, que es incompatible con `prisma migrate deploy` (el pooler no soporta el advisory lock que Prisma necesita para coordinar migraciones). La solución adoptada es ejecutar DDL crudo vía `$executeRawUnsafe` al arrancar el servidor, statement por statement, en vez de usar el sistema de migraciones de Prisma. `schema.prisma` sigue siendo la fuente de verdad para los **tipos** del cliente Prisma (hay que regenerarlo con `npx prisma generate` tras cada cambio), pero la base de datos real puede — y de hecho tiene — columnas que existen en producción antes de que alguien las añada a `schema.prisma`, o incluso columnas que solo existen en el `schema.prisma` para el tipado sin una migración correspondiente si el desarrollador olvidó añadirla al array (fuente de bugs sutiles: "el campo existe en el schema pero no en la BD real").

Cada sentencia es **idempotente por diseño** — se ejecuta en cada arranque del servidor, en cada entorno (dev y prod):

- `ALTER TABLE "X" ADD COLUMN IF NOT EXISTS "y" TIPO` — para columnas nuevas.
- `CREATE TABLE IF NOT EXISTS "X" (...)` — para tablas nuevas, con sus propias FK inline.
- `CREATE INDEX IF NOT EXISTS` / `CREATE UNIQUE INDEX IF NOT EXISTS` — para índices.

El caso más interesante es la creación de **enums Postgres** y de **constraints con nombre**, porque Postgres no soporta `CREATE TYPE IF NOT EXISTS` ni `ADD CONSTRAINT IF NOT EXISTS` de forma nativa. El proyecto resuelve esto con bloques `DO $$ ... END $$` que consultan el catálogo del sistema antes de actuar:

```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoReservaHotel') THEN
    CREATE TYPE "EstadoReservaHotel" AS ENUM ('PENDIENTE','CONFIRMADA','CHECKIN','CHECKOUT','CANCELADA','RECHAZADA');
  END IF;
END $$
```

y, para constraints con nombre:

```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ReservaHotel_habitacionFisicaId_fkey'
  ) THEN
    ALTER TABLE "ReservaHotel"
      ADD CONSTRAINT "ReservaHotel_habitacionFisicaId_fkey"
      FOREIGN KEY ("habitacionFisicaId") REFERENCES "HabitacionFisica"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$
```

El array también contiene `INSERT INTO "Categoria" (...) ON CONFLICT ("slug") DO NOTHING` (semillas de datos) y `UPDATE` puntuales de mantenimiento.

**Regla práctica**: si se modifica `prisma/schema.prisma`, hay que (a) detener el backend en Windows porque el proceso bloquea `query_engine-windows.dll.node`, (b) correr `npx prisma generate`, y (c) añadir la sentencia DDL equivalente al array de `aplicarMigraciones()` — un cambio de schema sin su contraparte DDL nunca llegará a la base de datos real.

### `utils/cloudinary.js`

Archivo: `D:\AfroMercado\afromercado\src\utils\cloudinary.js`. No usa el SDK oficial de Cloudinary: implementa la subida firmada a mano con `crypto` (SHA-1) + `fetch` nativo.

- `parseConfig()` — parsea `CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name`. Si la variable no está definida, todas las funciones públicas devuelven `null` en vez de lanzar, y el **llamador** es responsable del fallback (típicamente guardar el archivo en disco local).
- `firmarCampos(campos, apiSecret)` — ordena las claves alfabéticamente, las serializa, y firma con SHA-1 — algoritmo que exige la API de Cloudinary.
- `subirACloudinary(ruta, carpeta)` → `secure_url | null` — sube una imagen (carpeta por defecto `afromercado/productos`).
- `subirDocumentoACloudinary(ruta, carpeta)` — sube como `resource_type: "raw"` (PDFs de soporte).
- `subirVideoACloudinary(ruta, carpeta)` — sube como `resource_type: "video"`, devuelve `optimizedUrl` y `posterUrl` construidos vía manipulación de URL, sin llamadas adicionales a la API.
- `eliminarDeCloudinary(publicId, resourceType)` — borra un asset (usado al reemplazar video de producto/comercio).
- `cloudinaryActivo()` — helper booleano para saber si Cloudinary está configurado.

---

## 2. Marketplace general (Pedido / Carrito)

### Modelos Prisma clave

Archivo: `D:\AfroMercado\afromercado\prisma\schema.prisma`.

**`CarritoItem`** — una fila por `(usuarioId, productoId)` (`@@unique`). Guarda `cantidad` y `precioAlAgregar` (el precio vigente al momento de agregarlo, para detectar cambios de precio antes del checkout).

**`Direccion`** — `usuarioId`, `alias`, `linea1`, `barrio?`, `municipio`, `departamento` (ambos obligatorios, usados para cotizar el envío), `referencia?`, `telefono?`, `esPrincipal`, `deletedAt` (soft delete).

**`Pedido`** — cabecera de la compra completa de un comprador. Campos clave: `compradorId`, `direccionId?`/`direccionTexto` (siempre se guarda el texto, aunque venga de una `Direccion` guardada — es el snapshot inmutable de a dónde se envió), `estado` (`EstadoPedido`), `subtotal`, `comisionTotal`, `ivaTotal`, `total`, `costoEnvio`, `expiresAt` (30 minutos desde creación), `codigo` (único, formato `AFM-YYMM-XXXX`), `cuponId?`/`cuponDescuento?`.

```
enum EstadoPedido {
  PENDIENTE_PAGO
  VERIFICANDO_PAGO
  PAGO_FALLIDO
  CONFIRMADO
  CANCELADO
  EXPIRADO
  ENTREGADO
}
```

**`SubPedido`** — un `Pedido` se **parte automáticamente en un `SubPedido` por cada `comercioId` distinto** presente en el carrito. Cada `SubPedido` tiene su propio `subtotal`, `comision`, `tasaComisionAplicada`, `iva` y `neto` (lo que efectivamente recibe ese comerciante), y su propio ciclo de vida (`EstadoSubPedido`: `CONFIRMADO → EN_PREPARACION → LISTO → EN_CAMINO → ENTREGADO`, o `CANCELADO`). Esto es lo que le permite a cada comerciante gestionar su parte del pedido sin ver ni tocar la de los demás.

**`PedidoItem`** — línea de producto dentro de un `SubPedido`: `productoId`, `ofertaId?`, `cantidad`, `precioUnitario`, `subtotal`.

**`PagoDispersion`** — una fila por `SubPedido` (`@@unique([subPedidoId])`) que registra el envío del dinero neto (`montoNeto`) hacia la cuenta bancaria del comerciante, vía el proveedor de pagos (`ProveedorPago`: `SANDBOX | WOMPI | PAYU | EPAYCO | MERCADOPAGO`). Ver sección 7 para el flujo completo.

### Flujo de checkout — `PedidoService.checkout()`

Archivo: `D:\AfroMercado\afromercado\src\services\pedido.service.js`.

1. **Leer el carrito** y recalcular precio vigente de cada línea contra ofertas activas. Si el precio cambió respecto al `precioAlAgregar` guardado en el carrito, el checkout se rechaza pidiendo al usuario que revise el carrito.
2. **Agrupar por comercio** — esta agrupación es la que luego se convierte 1:1 en los `SubPedido`.
3. **Verificar stock disponible** fuera de la transacción (chequeo rápido, no atómico — la garantía real viene en el paso 5a).
4. **Calcular montos**: tasa de comisión en cascada — `ComisionComercio` (override específico por comercio, con vigencia `desde`/`hasta`) > `Config.comision_global` > `config.comisionPorcentaje` (env, 0.10 por defecto). **Candado explícito**: nadie puede comprar productos de su propia tienda.
5. **Costo de envío** (`calcularCostoEnvioServidor`) — resuelve el departamento de entrega y aplica en cascada: (a) envío gratis de plataforma si el subtotal general supera un umbral global; (b) política `por_comercio` vs consolidado; (c) envío gratis específico del vendedor si el subtotal de ese comercio supera el umbral que él mismo configuró.
6. **Transacción atómica** (`prisma.$transaction`):
   - **Reserva de stock** — `UPDATE "Producto" SET stockReservado = stockReservado + N WHERE id = X AND (stock - stockReservado) >= N`. Si `result === 0`, el stock se agotó entre el paso 3 y ahora — se lanza error. Este `UPDATE` condicional es el mecanismo real de exclusión mutua contra sobreventa concurrente (el chequeo del paso 3 es solo una optimización UX).
   - **Validación de cupón** dentro de la transacción (con bloqueo). Si el descuento no es combinable con oferta, solo aplica sobre el subtotal de ítems que **no** están en oferta.
   - **Regla `comision_base`**: si es `"post_descuento"` (default), la comisión de cada `SubPedido` se recalcula sobre el monto **ya descontado** por el cupón, prorrateando el descuento entre comercios.
   - **Crear el `Pedido`** con `expiresAt = ahora + 30 minutos` y sus `SubPedido`/`PedidoItem` anidados, en estado inicial `PENDIENTE_PAGO`.
   - Registrar uso de cupón e incrementar su contador; **vaciar el carrito**.
7. Fuera de la transacción: notificaciones asíncronas (`setImmediate`) al comprador y a cada comerciante.

### Cálculo de comisión — `utils/comision.js`

```js
function calcularDesglose(subtotal, porcentaje = config.comisionPorcentaje) {
  const comision = redondear(subtotal * porcentaje);
  const total = redondear(subtotal); // el comprador paga el subtotal; la comisión sale de ahí
  const montoComerciante = redondear(subtotal - comision);
  return { subtotal: redondear(subtotal), comision, total, montoComerciante };
}
```

Regla no obvia: **el comprador nunca paga la comisión como un cargo aparte** — paga el subtotal de los productos (más envío e IVA si aplica), y la comisión se descuenta del lado del comerciante al momento de la dispersión. `calcularDesgloseConIva()` añade el IVA (si el comercio lo tiene activo) como un cargo **adicional** para el comprador que no afecta ni la comisión ni el monto del comerciante.

### Dispersión de pagos

Cuando se confirma el pago del `Pedido`, por cada `SubPedido` se registra una fila `PagoDispersion` con `montoBruto`, `comision`, `montoNeto` y el estado de transferencia hacia la cuenta bancaria verificada del comerciante. Es decir: el `Pedido`/`Pago` es la relación con el **comprador** (un solo cobro por todo el carrito), y `PagoDispersion` es la relación con **cada comerciante** (tantas transferencias salientes como comercios distintos hubo en el pedido).

### Estados del pedido de principio a fin

```
PENDIENTE_PAGO  →  (checkout inicial, expira en 30 min si no se paga)
   │
   ├─ expira sin pago → EXPIRADO   (cron cada 5 min — libera stockReservado)
   ├─ cancelado por el comprador → CANCELADO
   │
   ▼
VERIFICANDO_PAGO  (Pago vía pasarela creado, en espera de confirmación)
   │
   ├─ pasarela rechaza → PAGO_FALLIDO  (libera stockReservado)
   ▼
CONFIRMADO  (pago aprobado: se descuenta stock real, se disparan dispersiones + facturación + fidelización)
   │
   ▼
ENTREGADO  (marcado cuando la entrega llega — dispara recordatorio de reseña 24h después)
```

`carrito.service.js` arma cada ítem del carrito con precio vigente/oferta ya resueltos, y valida en `agregar()`/`actualizarCantidad()` tanto el stock disponible como que el comercio del producto sea `comercioComprableEnPlataforma` (si no lo es, ni siquiera se puede agregar al carrito — ver sección 3).

---

## 3. Producto y Comercio

### Servicio de Productos — `producto.service.js`

Archivo: `D:\AfroMercado\afromercado\src\services\producto.service.js`.

- `crear()` exige que el usuario tenga un `Comercio` y que pase `assertPuedePublicar(comercio)`. Valida `unidad` (`KG, UNIDAD, LITRO, PAQUETE, DOCENA, MANOJO, ANIMAL`), `alcance` (`LOCAL, NACIONAL, AMBOS`), precio > 0, coherencia de días de alistamiento.
- `mapearComercioPublico(producto)` — se aplica a **toda** salida pública de un producto: calcula el campo derivado `producto.comercio.comprableEnPlataforma` y luego **elimina** del objeto expuesto los campos sensibles del comercio (`rut`, `cuentaDispersion`, `activo`, `estadoRegistro`, las tres URLs de documento de identidad). Es la barrera anti-fuga de datos internos hacia el catálogo público.
- Gestión de imágenes y video — todas verifican propiedad antes de tocar nada, y limpian el asset anterior en Cloudinary/disco antes de reemplazarlo.
- **Denuncias de producto** — ver sección 5.

### Servicio de Comercios — `comercio.service.js`

Archivo: `D:\AfroMercado\afromercado\src\services\comercio.service.js`.

- `registrar()` — cualquier `COMPRADOR` autenticado puede abrir tienda con la misma cuenta (se le cambia el rol a `COMERCIANTE` dentro de la misma transacción que crea el `Comercio`); un `ADMIN` **nunca** puede registrar un comercio para sí mismo (separación de privilegios explícita). Exige `tipoDocumento`/`numeroDocumento` del usuario y `departamento`/`municipio` válidos contra el catálogo DANE.
- `actualizar()` — solo permite tocar una lista blanca de campos editables (nombre, descripción, ubicación, historia, whatsapp, logo, vereda, RUT, cámara de comercio, fotos de documento). El RUT se valida con una regex colombiana.
- **Envío gratis del vendedor** — no tiene columna propia en `Comercio`; se guarda como fila en la tabla genérica `Config` bajo la clave `envio_gratis_comercio:<id>`, precisamente para evitar tener que agregar una migración de esquema por un dato tan puntual.
- `toggleComprasPublicas()` — opt-in al directorio de compras públicas (B2G): solo comercios ya `verificado=true` pueden activarlo.

### `comercio-publicacion.js` — los dos filtros y el gate de compra

Archivo: `D:\AfroMercado\afromercado\src\utils\comercio-publicacion.js`.

```js
/** Gate de "visible en catalogo" — sin exigir cuenta de dispersion. */
function filtroComercioVisible() {
  return {
    activo: true, verificado: true, estadoRegistro: "APROBADO",
    fotoDocumentoReversoUrl: { not: null },
    OR: [{ fotoDocumentoFrenteUrl: { not: null } }, { fotoDocumentoUrl: { not: null } }],
  };
}

/** Gate de "compra en plataforma" (carrito/checkout) — exige cuenta de dispersion. */
function filtroComercioPublicable() {
  return {
    ...filtroComercioVisible(),
    cuentaDispersion: { is: { estado: "VERIFICADA" } },
  };
}
```

- **`filtroComercioVisible`** — condición mínima para que un comercio (y por tanto sus productos) aparezca en el catálogo público: activo, verificado por admin, `estadoRegistro = APROBADO`, y documento de identidad completo.
- **`filtroComercioPublicable`** — mismo filtro **más** exigir que la `CuentaDispersionComercio` esté `VERIFICADA`. A pesar del nombre, no es la condición para *publicar* productos — es la condición para que esos productos entren al **carrito/checkout**. `comercioComprableEnPlataforma(comercio)` es la versión "objeto ya cargado" de este chequeo, y `requisitosPendientesPublicacion()`/`assertPuedePublicar()` son el gate de **publicación**, que deliberadamente **no** exige cuenta de dispersión verificada.

Esta separación (publicar ≠ ser comprable en plataforma) es la que habilita el sistema de **venta con contacto directo**.

### Venta con contacto directo (comercios sin RUT/cuenta bancaria)

Existe porque exigir RUT y cuenta bancaria verificada como requisito de publicación excluiría de entrada a productores informales del Chocó — el público objetivo del proyecto. La solución:

- Un comercio con documento de identidad válido pero **sin** cuenta de dispersión verificada puede publicar productos con normalidad.
- Ese mismo producto **no** puede agregarse al carrito de la plataforma — `CarritoService.agregar()` lanza `ErrorValidacion("Este producto no está disponible para compra en la plataforma. Contacta al vendedor por WhatsApp.")`.
- El frontend, apoyado en el campo derivado `producto.comercio.comprableEnPlataforma`, muestra un botón de contacto directo por WhatsApp en vez de "agregar al carrito".
- Como esta venta ocurre **fuera** de la plataforma (sin `Pedido`/`Pago`/`SubPedido`), el sistema de `Disputa` (que exige un `SubPedido` real) no cubre ningún problema que surja de ahí. Ese hueco de protección es exactamente lo que resuelve `DenunciaProducto` (sección 5).

---

## 4. Categorías

Modelos: `enum GrupoCategoria` y `model Categoria`:

```prisma
enum GrupoCategoria {
  ANCESTRAL
  LOCAL
  AGRO
}

model Categoria {
  id       Int            @id @default(autoincrement())
  nombre   String         @unique
  slug     String         @unique
  icono    String?
  activa   Boolean        @default(true)
  grupo    GrupoCategoria @default(ANCESTRAL)

  productos Producto[]
}
```

No existe un modelo `GrupoCategoria` separado — es un **enum** usado como campo (`Categoria.grupo`), no una tabla propia. Cada `Categoria` pertenece a exactamente un grupo:

- **`ANCESTRAL`** (default) — categorías del marketplace cultural original (artesanías, gastronomía tradicional, etc.).
- **`LOCAL`** — sección "Tienda Local" del marketplace.
- **`AGRO`** — módulo Agro, que **reutiliza** este mecanismo en vez de construir un módulo de datos aparte (mismo patrón que "Tienda Local").

El frontend filtra qué categorías mostrar en cada sección del marketplace consultando `Categoria` por su campo `grupo`, en vez de tener listas hardcodeadas por sección. Agregar una categoría nueva a "Tienda Local" o "Agro" es una operación de datos, no un cambio de código.

---

## 5. Denuncias

Se encontraron **cuatro** modelos `Denuncia*` — todos siguen el mismo patrón polimórfico-por-copia (no hay un modelo `Denuncia` genérico único; cada vertical replica la misma forma):

| Modelo | Entidad denunciada | Enum de motivo | Enum de estado |
|---|---|---|---|
| `DenunciaProducto` | `Producto` | `MotivoDenunciaProducto` | `EstadoDenunciaProducto` |
| `DenunciaOfertaEmpleo` | `OfertaEmpleo` | `MotivoDenunciaEmpleo` | `EstadoDenunciaEmpleo` |
| `DenunciaInmueble` | `Inmueble` | `MotivoDenunciaInmueble` | `EstadoDenunciaInmueble` |
| `DenunciaPublicacionCultural` | `PublicacionCultural` | `MotivoDenunciaPublicacion` | `EstadoDenunciaPublicacion` |

### Patrón común

```prisma
model DenunciaProducto {
  id            Int      @id @default(autoincrement())
  productoId    Int
  denuncianteId Int
  motivo        MotivoDenunciaProducto
  descripcion   String?
  estado        EstadoDenunciaProducto @default(PENDIENTE)
  revisadoPor   Int?
  revisadoAt    DateTime?
  notaRevision  String?
  createdAt     DateTime @default(now())

  producto    Producto @relation(fields: [productoId], references: [id], onDelete: Cascade)
  denunciante Usuario  @relation("DenunciasProductoHechas", fields: [denuncianteId], references: [id])

  @@unique([productoId, denuncianteId])
  @@index([estado, createdAt])
}
```

Elementos constantes en los cuatro:

- `@@unique([<entidadId>, denuncianteId])` — un mismo usuario no puede denunciar dos veces la misma entidad.
- `estado` arranca en `PENDIENTE` y solo un admin lo mueve.
- Los enums de estado siempre tienen la forma `PENDIENTE`, `DESESTIMADA`, y una o dos variantes de "bloqueo" (a nivel de la publicación individual y/o de toda la cuenta).
- El motivo `OTRO` siempre existe como catch-all, y casi siempre hay un motivo específico de fraude económico (`ESTAFA_DINERO`).

### Acciones de moderación admin

Tres acciones (implementadas en `ProductoService.resolverDenuncia` y replicadas por analogía en Empleo/Inmueble):

1. **`DESESTIMAR`** — se marca `DESESTIMADA` con nota opcional; no pasa nada más.
2. **Bloquear solo la publicación** — desactiva únicamente el `Producto`/`OfertaEmpleo`/`Inmueble`/`PublicacionCultural` denunciado y notifica al dueño con el motivo.
3. **Bloquear toda la cuenta** — suspende al comerciante/publicador completo (para `Producto` delega en `AdminService.verificarComerciante(..., accion: "SUSPENDER")`) y **resuelve en cascada** todas las demás denuncias pendientes de ese comercio/usuario, marcándolas `CUENTA_BLOQUEADA` — evita denuncias "huérfanas" contra una cuenta ya suspendida.

Endpoints (ejemplo Producto):

```
GET   /api/productos/admin/denuncias              (ADMIN) — listar pendientes
PATCH /api/productos/admin/denuncias/:id/resolver  (ADMIN) — { accion, motivo }
POST  /api/productos/:id/denunciar                 (autenticado) — { motivo, descripcion }
```

Caso especial: cuando el motivo de una `DenunciaProducto` es `ESTAFA_DINERO`, el servicio dispara (asíncrono, `setImmediate`) un mensaje de WhatsApp a todos los admins con teléfono registrado, vía `enviarMensajeWA` (independiente del asistente de IA, solo depende de que la sesión de WhatsApp esté conectada).

---

## 6. Reseñas, Favoritos y Cupones

### Resena — unificación (Anexo B, Fase 3)

`model Resena` reemplazó explícitamente siete modelos que existían antes por separado: `Review`, `ReviewProducto`, `ReviewHotel`, `ReviewTour`, `ReviewTransporte`, `ReviewExpress` y `ReviewCultura`. El propio comentario en el schema lo confirma:

```prisma
// Anexo B, Fase 3 (unificación núcleo-vs-verticales): reemplaza a Review,
// ReviewProducto, ReviewHotel, ReviewTour, ReviewTransporte, ReviewExpress
// y ReviewCultura — mismo patrón polimórfico usado en Favorito (Fase 1).
enum TipoEntidadResenable {
  PEDIDO
  PRODUCTO
  RESERVA_HOTEL
  RESERVA_TOUR
  RESERVA_TRANSPORTE
  PEDIDO_EXPRESS
  RESERVA_CULTURAL
}

model Resena {
  id           Int                  @id @default(autoincrement())
  tipoEntidad  TipoEntidadResenable
  entidadId    Int
  comercioId   Int?                 // desnormalizado a propósito
  autorId      Int
  calificacion Int
  comentario   String?
  fotoUrls     String[]             @default([])
  videoUrl     String?
  createdAt    DateTime             @default(now())

  @@unique([tipoEntidad, entidadId, autorId])
}
```

Es un modelo **polimórfico**: `(tipoEntidad, entidadId)` apunta a la entidad reseñada, sin FK real de Prisma hacia esas tablas. `comercioId` está deliberadamente **desnormalizado** — se guarda una copia para poder listar "todas las reseñas de este comercio" con una sola query sin importar de qué vertical vinieron.

Nota de diseño no obvia en el `@@unique`: incluye `autorId` además de `[tipoEntidad, entidadId]` porque en 6 de los 7 tipos el par ya determina un único autor posible (una reserva pertenece a un cliente), pero `PRODUCTO` es la excepción real — muchos compradores distintos pueden reseñar el mismo producto.

### Favorito — unificación (Anexo B, Fase 1)

`model Favorito` sigue el mismo patrón; el comentario confirma que reemplazó **siete** modelos por vertical:

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
  id          Int                 @id @default(autoincrement())
  usuarioId   Int
  tipoEntidad TipoEntidadFavorita
  entidadId   Int
  createdAt   DateTime            @default(now())

  @@unique([usuarioId, tipoEntidad, entidadId])
}
```

`onDelete: Cascade` en la relación a `Usuario` (si se borra la cuenta, sus favoritos desaparecen con ella).

### Cupon

`model Cupon` — no es polimórfico como Resena/Favorito; es un sistema de descuentos propio con varias tablas satélite:

- `Cupon` — código único, `tipo` (`PORCENTAJE`/`VALOR_FIJO`), `valor`, `minimoCompra?`, `usosMaximos?` (tope global) y `usosMaximosPorUsuario?` (tope por persona), `distribucion` (`PUBLICO` o `ASIGNADO`), `soloNuevos`, `programaNombre?` (agrupa cupones de un mismo programa de subsidio institucional).
- `CuponUso` — una fila por redención real, `@@unique` en `pedidoId`.
- `CuponComercio` — restringe un cupón a una lista de comercios específicos.
- `CuponAsignacion` — lista blanca de usuarios habilitados cuando `distribucion = ASIGNADO`.

La validación completa vive en `CuponRepository.validarParaCheckout`, invocada dentro de la transacción de checkout para que la validación y el incremento de contador de uso sean atómicos frente a condiciones de carrera.

Nota aparte: existe también un mecanismo de **alianza comercial** (sección 9.6) que puede generar un descuento equivalente sin pasar por una fila `Cupon` propia — el checkout lo distingue con la bandera `resultadoCupon.esAlianza`.

---

## 7. Pagos (Wompi) — flujo de pago y dispersión

### Arquitectura de proveedores

- `D:\AfroMercado\afromercado\src\services\payments\providers\wompi.provider.js` — implementación concreta del proveedor Wompi.
- `D:\AfroMercado\afromercado\src\services\payments\providers\sandbox.provider.js` — proveedor simulado (dev/test).
- `D:\AfroMercado\afromercado\src\services\payments\provider-factory.js` — resuelve qué proveedor usar.
- `D:\AfroMercado\afromercado\src\services\pago-digital.service.js` — orquestador de negocio, agnóstico del proveedor concreto.

`WompiPaymentProvider` implementa una interfaz común con cinco operaciones: `registrarBeneficiario`, `crearCheckout`, `crearCheckoutPublicidad`, `interpretarWebhook`, `dispersar`. Las credenciales se leen primero de variables de entorno y, si faltan, de la tabla `Config` bajo claves `pagos.wompi.<NOMBRE>` — mismo patrón de "dato configurable sin migración" que el envío gratis por comercio.

### Flujo de cobro al comprador (Web Checkout)

1. **`PagoDigitalService.crearCheckout(usuarioId, { pedidoId, idempotencyKey })`** — idempotente por `idempotencyKey`. Verifica que el `Pedido` sea del usuario, esté en un estado pagable y no haya expirado.
2. **`obtenerCuentasDispersion`** — antes de crear el cobro, verifica que **todos** los comercios del pedido tengan una cuenta de dispersión `VERIFICADA` para el proveedor activo. Si falta alguna, el checkout completo se rechaza — el comprador no puede pagar un carrito si algún comerciante no puede recibir el dinero.
3. Dentro de una transacción: se crea el `Pago` (`estado: PENDIENTE`) y, por cada `SubPedido`, una fila `PagoDispersion` en `estado: PENDIENTE`. El `Pedido` pasa a `VERIFICANDO_PAGO`.
4. Fuera de la transacción: `WompiPaymentProvider.crearCheckout` construye la URL de Web Checkout de Wompi, firmando la integridad con `sha256(reference + amountInCents + currency [+ expirationTime] + secreto)`. Si falla, el `Pago` se marca `FALLIDO` y el `Pedido` vuelve a `PENDIENTE_PAGO`.
5. El frontend redirige al comprador a esa `checkoutUrl`; Wompi redirige de vuelta a `${FRONTEND_URL}/pedido/:id/pago?provider=wompi&reference=...`.

### Webhook y confirmación

1. `interpretarWebhook` valida la firma del evento (`x-event-checksum`, con `crypto.timingSafeEqual`) y normaliza el evento.
2. Se busca el `Pago` por `providerPaymentId` o `providerReference`. El evento crudo siempre se persiste en `PagoEvento` primero (`@@unique([proveedor, eventoId])` para deduplicar reintentos de webhook).
3. Si está en estados aprobados: se valida que el monto coincida (protección contra manipulación de webhook) y se llama `confirmarPago()`.
4. Si está en estados fallidos: se llama `fallarPago()`, que libera `stockReservado` y marca el `Pedido` como `PAGO_FALLIDO`.

### `confirmarPago()`

Dentro de una transacción: descuenta `stock` real de cada `Producto`, marca todos los `SubPedido` como `CONFIRMADO`, incrementa `Comercio.totalVentas`, marca `Pago`/`Pedido` como `CONFIRMADO`. Después, fuera de la transacción: dispara dispersiones, notifica, emite factura electrónica por cada `SubPedido`, notifica stock bajo, otorga puntos de fidelización.

### `ejecutarDispersiones()` — el pago saliente a cada comerciante

`WompiPaymentProvider.dispersar()` usa la **API de Payouts** de Wompi: por cada dispersión arma una transacción con documento del titular, `bankId` (resuelto en cascada: `providerBankId` guardado → mapa configurable → API `/banks` de Wompi → tabla hardcodeada de fallback), tipo/número de cuenta (**descifrado** en el momento desde `numeroCuentaCifrado`), y monto en centavos. El lote completo lleva `idempotencyKey` propia y cada transacción tiene su propia `reference` para mapear la respuesta de vuelta a cada `PagoDispersion`.

### Reintentos de dispersión fallida

`D:\AfroMercado\afromercado\src\jobs\reintentar-dispersiones.job.js` — corre al iniciar el servidor y luego cada 10 minutos. Busca `PagoDispersion` en `FALLIDA` con `intentosFallidos < 5` cuyo `proximoReintentoAt` ya pasó, y reintenta. Backoff fijo por intento: `[5, 15, 30, 60, 120]` minutos. Al 5º intento fallido, notifica a los admins para intervención manual.

---

## 8. Servicios especializados

Los 4 módulos (Express, Hotel, Tour, Transporte) viven junto al marketplace general y comparten patrones muy marcados: cada uno tiene un `Config<Modulo>` (uno por `Comercio`), un modelo de reserva/pedido propio, endpoints bajo `/api/<modulo>`, un archivo `routes/controllers/services` propio, y páginas públicas en `afromercado-web/app/<modulo>/` + panel de comerciante en `afromercado-web/app/comerciante/<modulo>/page.tsx`.

### Infraestructura compartida entre los 4

- **Cupones**: modelo polimórfico único `CuponVertical`/`CuponVerticalUso` (enum `TipoEntidadCuponVertical`: `CONFIG_HOTEL | CONFIG_EXPRESS | CONFIG_TOUR | CONFIG_TRANSPORTE`), reemplazó 8 tablas casi idénticas. Lógica común en `afromercado/src/utils/cupon-vertical.js`. El `Cupon`/`CuponUso` del Marketplace general **no** se unificó a propósito (tiene analítica y detección de fraude propia).
- **Alianzas**: un código de cupón que no existe como `CuponVertical` propio del comercio puede resolverse como "cupón de alianza" entre comercios (ver sección 9.6).
- **Facturación**: `FacturacionService.emitirParaReferencia(moduloOrigen, referenciaId)` se llama fire-and-forget al crear cada pedido/reserva.
- **Reseñas y Favoritos**: modelos polimórficos únicos `Resena`/`Favorito` (ver sección 6).
- **Comisión de plataforma — INCONSISTENTE entre módulos** (hallazgo real, no de diseño):
  - Express: `resolverTasaComision(comercioId)` — cascada real (override por comercio → `Config` global → default), igual que el Marketplace.
  - Hotel y Tour: **tasa fija hardcodeada al 10%**, sin consultar overrides.
  - Transporte: **no calcula comisión en absoluto** — `ReservaTransporte` ni siquiera tiene columnas `comision`/`tasaComision`.
- **`Entrega`** (domicilios): solo Express la usa. Hotel/Tour/Transporte no generan entregas.
- **Verificación pública**: Tour y Transporte filtran `comercio: { verificado: true }` en el listado público. Hotel y Express **no** aplican ese filtro.
- **RNT (Registro Nacional de Turismo)**: Hotel y Tour tienen `rnt`/`rntVerificado` — el operador escribe su número, solo el admin lo marca verificado. Transporte y Express no tienen este campo.

### 8.1 Express (Sabores) — `/express`

**Propósito**: pedidos de comida/restaurante con carrito, complementos configurables, secciones de menú, ETA dinámico, checkout con múltiples métodos de pago y modalidades (recoger / domicilio / mesa), panel de comerciante con CRUD de platos inline.

**Modelos clave**: no existe `ProductoExpress` separado — los platos son filas de `Producto` con `esExpress: true` y opcionalmente `menuSeccionId`.
- **`ConfigExpress`** — un registro por comercio: `activo`/`abierto`, `tiempoPrepMinutos`, `municipiosEntrega`, `modalidades`, `costoEnvioBase`, `tipoEntregaDomicilio` (`PROPIO`|`PLATAFORMA`), `limiteCreditoEfectivo`/`deudaEfectivoActual` (control de crédito por pagos en efectivo).
- **`HorarioExpress`** — horario por día de la semana (incluye `FESTIVO`).
- **`MenuSeccion`** — secciones del menú, con `vistaCompacta: Boolean` (grilla compacta vs tarjetas grandes).
- **`PedidoExpress`** — código `EX-...`, `modalidad`, `estado` (`PENDIENTE→ACEPTADO→EN_PREPARACION→LISTO→EN_CAMINO→ENTREGADO`, o `RECHAZADO`/`CANCELADO`), timestamps por estado, `expiresAt` (ventana de aceptación).
- **`ItemPedidoExpress`** — `complementos: Json?` (snapshot, no FK).
- **`GrupoComplemento`/`ItemComplemento`** — complementos por producto individual.
- **`GrupoComplementoBiblioteca`/`ItemComplementoBiblioteca`/`ProductoGrupoComplemento`** — biblioteca de grupos reutilizable a nivel de comercio.

**Backend**: `routes/express.routes.js` → `/api/express`; `controllers/express.controller.js`; `services/express.service.js`.

**Flujo**: (1) comerciante activa Express y define horarios/modalidades; (2) crea platos (`Producto esExpress:true`) desde `comerciante/express/page.tsx` (`FormPlato`, CRUD inline) y complementos; (3) cliente navega `/express/[id]`, arma carrito local, elige modalidad; (4) `POST /express/pedidos` valida horario, modalidad, crédito, recalcula precios en servidor, crea pedido con `expiresAt = +3 min`; (5) comerciante tiene 3 min para aceptar/rechazar (cron cancela expirados); (6) avanza estados fijos, cada transición notifica push/SSE; (7) pago en efectivo: la comisión se **acumula como deuda** en vez de cobrarse al momento.

**Frontend**: público `app/express/page.tsx`, `app/express/[id]/page.tsx`; comerciante `app/comerciante/express/page.tsx` (1812 líneas).

**Reglas no obvias**:
- **Válvula de escape "repartidor de plataforma"**: un restaurante en modo `PROPIO` puede, para un pedido puntual, pasar la entrega al pool de repartidores de AfroMercado sin cambiar su configuración general — una vez creada esa `Entrega`, el comercio deja de controlar el avance de estado.
- **Límite de crédito en efectivo**: si `deudaEfectivoActual >= limiteCreditoEfectivo`, el comercio no puede recibir pedidos en efectivo.
- **Colombia fija en UTC-5**: no maneja horario de verano.
- **Reseñas Express nunca tocan `Comercio.calificacion/totalReviews`**: se calculan aparte para no pisar el campo compartido con Hotel.

### 8.2 Hotel — `/hoteles`

**Propósito**: reservas de alojamiento con soporte multi-tipo de propiedad (no solo hoteles clásicos), inventario físico opcional, reservas por noche o por horas, check-in online, reservas grupales, temporadas de precio, política de cancelación con penalización.

**Modelos clave**:
- **`ConfigHotel`** — `confirmacionAuto`, `checkInHora`/`checkOutHora`, política de pagos, `permiteReservasPorHora` + `minutosLimpiezaEntreReservas`, política de cancelación (`horasLibresCancelacion`, `pctPenalidadCancelacion`), `rnt`/`rntVerificado`.
- **`TipoAlojamiento`** (enum) — `HABITACION | CABANA | APARTAMENTO | CASA_COMPLETA | FINCA | GLAMPING | POSADA | HOSTAL | ALBERGUE | RESORT`. El módulo cubre fincas, glamping, posadas, etc., no solo hoteles.
- **`HabitacionTipo`** — el "producto vendible": nombre, capacidad, `precioPorNoche`, `precioPorHora`+`permitePorHoras`+duración min/max, `cantidad`.
- **`HabitacionFisica`** — unidad física concreta opcional (`piso`/`zona`/`estado`: `LIBRE|OCUPADA|LIMPIEZA|MANTENIMIENTO|BLOQUEADA`). **Por qué existen ambos**: `HabitacionTipo` es la tarifa que el cliente reserva; `HabitacionFisica` es la asignación operativa que el hotelero gestiona puertas adentro. Sin unidades físicas registradas, la disponibilidad se calcula por conteo simple contra `cantidad`; con ellas, contra el inventario real.
- **`ReservaHotel`** — `modalidad: "NOCHE"|"HORAS"`, `duracionHoras` (solo si horas), `estado` (`PENDIENTE→CONFIRMADA→CHECKIN→CHECKOUT`, o `CANCELADA/RECHAZADA`), `habitacionFisicaId` opcional, check-in online (`checkinOnlineAt`, `docTipo`, `docNumero`, `horaEstimadaLlegada`, `tokenCheckin`), **`grupoReservaId`** (comparte valor entre reservas creadas juntas en una reserva grupal).
- **`TemporadaHotel`** — override de precio por rango de fechas, general o específico a un `habitacionTipoId`.

**Backend**: `routes/hotel.routes.js` → `/api/hotel`; `services/hotel.service.js` (~1970 líneas, el más grande de los 4).

**Flujo**: (1) hotelero activa config y política; (2) crea `HabitacionTipo` y opcionalmente `HabitacionFisica`; (3) cliente elige modalidad/fechas en `/hoteles/[id]`; (4) `POST /reservas` corre en transacción con **lock pesimista** (`SELECT ... FOR UPDATE` sobre `HabitacionTipo`), calcula precio por temporada vigente, aplica cupón, comisión fija 10%; estado inicial `PENDIENTE` si pago online, o según `confirmacionAuto` si efectivo; (5) **reserva múltiple**: varias habitaciones en una transacción con `grupoReservaId` común, si cualquiera falla toda la operación falla; (6) hotelero gestiona estado y asigna `HabitacionFisica`; (7) check-in online opcional vía token público, sin necesitar cuenta.

**Frontend**: público `app/hoteles/[id]/page.tsx` (1631 líneas); comerciante `app/comerciante/hoteles/page.tsx` (2450 líneas, la página más grande del proyecto).

**Reglas no obvias**:
- **Buffer de limpieza en reservas por hora**: la consulta de solapamiento agrega `minutosLimpiezaEntreReservas` antes y después del rango solicitado.
- **Cancelación con penalización dinámica**: si faltan menos de `horasLibresCancelacion` horas, se aplica `pctPenalidadCancelacion`. Hay endpoint de solo-consulta para ver el impacto antes de confirmar.
- **Bloqueos manuales de fechas** no usan tabla propia: se guardan como JSON en `Config` bajo clave `HOTEL_BLOQUEOS_<id>`.
- **Reasignar habitación física en `CHECKIN`**: la habitación anterior pasa a `LIMPIEZA`, no a `LIBRE` directamente.

### 8.3 Tour — `/tours`

**Propósito**: excursiones con itinerario de paradas, reservas por cupo de participantes (no por unidad de inventario), certificación RNT ("Turismo Comunitario Certificado"), galería multimedia rica por parada.

**Modelos clave**:
- **`ConfigTour`** — `duracionHoras`, `precioPersona`, `maxParticipantes` (cupo total **por fecha**, compartido entre todas las reservas del día), `puntoEncuentro`, `idiomas`, `confirmacionAuto`, `rnt`/`rntVerificado`.
- **`TourLugar`** — cada parada: `titulo`, `tipo`, `rutaNombre` (agrupador opcional), `orden`, `duracionMinutos`, `recomendaciones`, `latitud`/`longitud`, `destacado`. Límite de 30 lugares por tour.
- **`TourLugarMedia`** — media por parada: `tipo` (`FOTO`|`VIDEO`|`VIDEO_LINK`), video subido o enlace externo con plataforma auto-detectada (YouTube, Instagram, TikTok, Facebook, Vimeo, o genérico). Límites: 24 fotos y 8 enlaces por lugar; solo 1 video subido activo a la vez.
- **`ReservaTour`** — `fechaTour`, `participantes`, `total`, `estado`, `comision`/`tasaComision` (fija 10%), `nombreContacto`/`telefonoContacto`.

**Backend**: `routes/tour.routes.js` → `/api/tour`; `services/tour.service.js`.

**Flujo**: (1) operador activa config, precio, cupo; (2) arma itinerario (`TourLugar` con drag-to-reorder) con media por lugar; (3) cliente elige fecha y participantes; (4) `POST /reservas` corre con **lock pesimista** sobre `ConfigTour`, valida cupo diario disponible (sin franjas horarias — el cupo es por día completo); si el cupón es inválido, **el error se ignora silenciosamente** y la reserva sigue sin descuento; (5) estado inicial según `confirmacionAuto`; (6) operador gestiona transición de estados.

**Frontend**: público `app/tours/[id]/page.tsx` (939 líneas); comerciante `app/comerciante/tours/page.tsx` (1257 líneas).

**Reglas no obvias**:
- **Listado público filtra por `comercio.verificado`** (a diferencia de Hotel/Express) — refuerza el ángulo "Turismo Comunitario Certificado".
- **RNT de solo-escritura para el operador**: el service extrae `rnt` explícitamente para impedir que el cliente toque `rntVerificado` (comentario: "solo el operador puede actualizar su numero, no el estado de verificacion").
- Un comentario en el código señala que `rutaNombre` se agregó "en caliente" sin regenerar el cliente Prisma en todos los entornos de inmediato.

### 8.4 Transporte — `/transportes`

**Propósito**: el más simple de los 4 — venta de cupos/asientos en rutas con horario fijo (pensado para transporte fluvial), sin comisión de plataforma, sin cupo por unidad física, sin RNT.

**Modelos clave**:
- **`ConfigTransporte`** — `tipo: String` (default `"LANCHA"`), sin política de pago/cancelación propia.
- **`RutaTransporte`** — `origen`/`destino`, `horario: String` (texto libre, no `DateTime`), `diasSemana`, `capacidad`, `precioAsiento`.
- **`ReservaTransporte`** — `fechaViaje`, `asientos`, `total`, `estado` (mismo patrón que Tour). **No tiene `comision`/`tasaComision`** — único de los 4 sin comisión de plataforma registrada.

**Backend**: `routes/transporte.routes.js` → `/api/transporte`; `services/transporte.service.js`.

**Flujo**: (1) operador crea `RutaTransporte`; (2) cliente elige ruta/asientos/fecha; (3) `POST /reservas` — **sin lock pesimista** (a diferencia de Hotel/Tour), calcula disponibles antes de la transacción; crea la reserva siempre en `PENDIENTE` (no hay auto-confirmación); (4) operador confirma/rechaza/completa manualmente.

**Frontend**: público `app/transportes/[id]/page.tsx` (777 líneas); comerciante `app/comerciante/transportes/page.tsx` (770 líneas, el panel más pequeño de los 4).

**Reglas no obvias**:
- **Sin comisión de plataforma en absoluto**.
- Listado público también filtra `comercio.verificado`.
- `horario` es texto libre, sin parsing estructurado.
- **Sin lock pesimista**: hay una ventana teórica de condición de carrera entre dos reservas simultáneas sobre el último asiento.

---

## 9. Módulos comunitarios/institucionales

Módulos agregados para cubrir la economía informal/territorial del Chocó y la expansión nacional.

### 9.1 Bienes Raíces (`/bienes-raices`)

**Propósito**: vitrina de predios formalizados **sin transacción dentro de la plataforma** — el contacto siempre es por WhatsApp, sin checkout ni intermediación de dinero. Razón documentada en el schema: la informalidad de tenencia en el Chocó es del 52-60% y hay riesgo real de tierra en disputa; por eso, a diferencia de Empleo, **la moderación nunca se salta** — un admin siempre debe verificar un documento de soporte antes de aprobar cualquier publicación.

Cualquier `Usuario` autenticado puede publicar (no exclusivo de comerciantes).

**Enums**: `TipoInmueble` (`LOTE|CASA|APARTAMENTO|FINCA|LOCAL_COMERCIAL|BODEGA|OTRO`), `TipoOperacionInmueble` (`VENTA|ARRIENDO`), `EstadoInmueble` (`BORRADOR|PUBLICADO|PAUSADO|CERRADO`), `MotivoDenunciaInmueble`, `EstadoDenunciaInmueble` (`PENDIENTE|DESESTIMADA|PUBLICACION_BLOQUEADA|CUENTA_BLOQUEADA`).

**`model Inmueble`**: `publicadorId`, `comercioId?` (auto-vinculado si el publicador tiene comercio), `titulo`, `descripcion`, `tipoInmueble`, `tipoOperacion`, `precio`, `areaM2`, `habitaciones`, `banos`, `departamento`, `municipio`, `vereda`, `direccionReferencia`, `latitud`/`longitud`, `fotoUrls`, `folioMatricula`, **`documentoSoporteUrl`** (privado, nunca se expone al público), `contactoWhatsapp`, `estado`, `estadoModeracion`, `revisadoPor`/`revisadoAt`/`motivoRechazoModeracion`, `deletedAt`.

**Backend**: `routes/inmueble.routes.js` (montado bajo `/`, rutas finales `/api/inmuebles/...` y `/api/admin/inmuebles/...`). Dos `multer` distintos: fotos (`uploads/inmuebles`, 5MB) y documento de soporte (`uploads/inmuebles-documentos`, PDF, 10MB — **nunca** pasa por Cloudinary, se sirve local). `services/inmueble.service.js`, `repositories/inmueble.repository.js`, `controllers/inmueble.controller.js`.

**Frontend**: `app/bienes-raices/page.tsx` (vitrina), `[id]/page.tsx` (detalle), `publicar/page.tsx` (formulario, `FormularioInmueble.tsx`), `mis-publicaciones/page.tsx`.

**Flujo**: (1) usuario crea el inmueble (`BORRADOR`, `PENDIENTE`), se auto-vincula a su comercio si tiene uno pero **eso no otorga auto-aprobación**; (2) edita libremente mientras esté en `BORRADOR`; (3) sube fotos y opcionalmente el documento; (4) pasa a `PUBLICADO` — **puede publicarse sin documento de soporte**, queda en cola de moderación pero nunca podrá aprobarse sin uno; (5) admin revisa y modera — **regla crítica**: si `accion === "APROBAR"` y `!inmueble.documentoSoporteUrl`, lanza error, es literalmente imposible aprobar sin documento; (6) solo visible al público con `estado === "PUBLICADO" && estadoModeracion === "APROBADA"`, y `documentoSoporteUrl` se excluye explícitamente de toda respuesta pública; (7) cualquiera (excepto el publicador) puede denunciar una vez; admin resuelve con Desestimar / Bloquear publicación / Bloquear cuenta (cierra TODAS las publicaciones activas del publicador).

**Reglas no obvias**: la resolución de denuncias es **secuencial, no transaccional** (si falla el bloqueo de cuenta tras cerrar publicaciones, el estado resultante sigue siendo seguro). El documento de soporte es estrictamente privado (filtrado explícito por destructuring).

### 9.2 Empleo (`/empleo`)

**Propósito**: bolsa de trabajo comunitaria. Cualquier `Usuario` puede publicar una oferta (no solo comerciantes) y cualquier `Usuario` puede postularse. Moderación **ligera**, con auto-aprobación condicional para comercios verificados (contraste explícito con Bienes Raíces, donde esto nunca ocurre). La hoja de vida se **snapshotea** en cada postulación para que el postulante no pueda editar retroactivamente lo que un empleador ya vio.

**Enums**: `EstadoOfertaEmpleo`, `TipoContratoEmpleo`, **`TipoPublicacionEmpleo`** (`OFERTA_EMPLEO|OFRECE_SERVICIO` — el campo que Servicios Profesionales reutiliza), `EstadoPostulacionEmpleo`, `MotivoDenunciaEmpleo`, `EstadoDenunciaEmpleo`.

**`model OfertaEmpleo`**: `publicadoPorId`, `comercioId?`, `tipoPublicacion` (`@default(OFERTA_EMPLEO)`), `titulo`, `descripcion`, `categoria`, `tipoContrato`, `municipio`, `departamento`, `salarioMin`/`salarioMax`, `salarioNegociable`, `requisitos`, `vacantes`, `estado`, `estadoModeracion`, `fechaCierre`, `contactoWhatsapp`, `imagenUrl`, `preguntas` (Json custom).

**`model HojaDeVida`**: `usuarioId` único, `resumenPerfil`, `telefonoContacto`, `experiencia`/`educacion` (Json), `habilidades`, `disponibilidad`, `cvUrl`.

**`model PostulacionEmpleo`**: `ofertaEmpleoId`, `postulanteId`, `hojaDeVidaId`, y **snapshot completo** de la hoja de vida al momento de postular (`experienciaSnap`, `educacionSnap`, etc.), `respuestas`, `mensaje`, `estado`, `vistaAt`, `notasPublicador`. `@@unique([ofertaEmpleoId, postulanteId])`.

**Backend**: `routes/empleo.routes.js` (montado bajo `/`, rutas `/api/empleo/...`, `/api/admin/empleo/...`). Tres `multer`: CV (PDF), imagen de oferta (con Cloudinary + fallback local). `services/empleo.service.js`, `repositories/empleo.repository.js`, `controllers/empleo.controller.js`.

**Frontend**: `app/empleo/page.tsx` (listado con búsqueda/filtros/toggle Empleo-Servicio), `[id]/page.tsx`, `publicar/page.tsx`, `mis-ofertas/page.tsx`, `mis-postulaciones/page.tsx`, `mi-hoja-de-vida/page.tsx`, `admin/empleo/page.tsx`.

**Flujo**: (1) publicador crea la oferta; si tiene comercio **verificado** y el flag de reglas `empleo_auto_aprobar_comercio_verificado` está activo, nace ya `APROBADA`, saltándose la cola; (2) edición libre en `BORRADOR`; (3) al publicar, se notifica a admins si sigue `PENDIENTE`; (4) candidato completa `HojaDeVida` (obligatoria antes de postular); (5) postulación valida oferta publicada+aprobada, no cerrada, no ser el propio publicador, y que **no** sea tipo `OFRECE_SERVICIO` (los servicios no aceptan postulación formal); (6) si se había retirado, postularse de nuevo reutiliza el mismo registro; (7) publicador gestiona: `VISTA→PRESELECCIONADO→CONTRATADO`/`RECHAZADA`; al llegar a `vacantes` contratados, la oferta se cierra sola; (8) denuncias/bloqueo: mismo patrón que Bienes Raíces.

**Reglas no obvias**: la auto-aprobación es la única diferencia estructural real de moderación frente a Bienes Raíces, y está controlada por un flag de `Reglas` (tabla `Config`), no hardcodeada.

### 9.3 Servicios Profesionales

**No es un módulo nuevo** — no tiene modelos, rutas, servicio ni repositorio propios. Reutiliza `OfertaEmpleo` invirtiendo `tipoPublicacion`: en vez de una empresa buscando empleado, un trabajador independiente ofrece su servicio (`OFRECE_SERVICIO`). Sin postulación ni hoja de vida — contacto directo por WhatsApp.

**No existe una ruta `/servicios-profesionales`** — es un toggle dentro de `/empleo`:
- `app/empleo/page.tsx` — estado `tipoPublicacion`, dos botones tipo pestaña que cambian filtro y categorías disponibles.
- `components/empleo/FormularioOferta.tsx` — el mismo formulario cambia de modo, ocultando campos irrelevantes (tipo de contrato, salario formal) en modo servicio.
- `components/empleo/TarjetaOfertaEmpleo.tsx` — layout/CTA distinto (contacto directo vs "Postularme").
- `app/empleo/[id]/page.tsx` — oculta tipo de contrato y flujo de postulación cuando es servicio.
- `app/empleo/mis-ofertas/page.tsx` — badge `🛠️ Servicio` vs `💼 Empleo`.

**Regla no obvia**: `EmpleoService.postularse` bloquea explícitamente la postulación si `tipoPublicacion === "OFRECE_SERVICIO"` — es la única regla de negocio backend que distingue realmente ambos modos; todo lo demás (moderación, denuncias, favoritos, edición) es idéntico porque ambos son filas de la misma tabla.

### 9.4 Agro (`/agro`)

**Propósito**: vitrina pública del vertical Agro que **reutiliza por completo** el Producto/carrito/checkout del Marketplace — no es un directorio de productores paralelo. La única pieza nueva es `GrupoCategoria.AGRO` (mismo patrón que "Tienda Local").

**Cómo funciona**: `enum GrupoCategoria` (`ANCESTRAL|LOCAL|AGRO`), campo `grupo` en `Categoria`. Cada categoría de producto agrícola se marca `grupo: AGRO`, y los productos heredan la clasificación vía `categoriaId`. No hay tabla, servicio ni endpoint dedicado — el filtrado ocurre en el endpoint genérico de listado de productos con `grupo: 'AGRO'` como query param.

**Frontend**: `app/agro/page.tsx` — filtra categorías con `grupo === 'AGRO'`, renderiza con el mismo `TarjetaProducto` del resto del marketplace.

**Regla no obvia**: al reutilizar el marketplace general, Agro **hereda automáticamente** comisión, checkout, carrito, subpedidos, reserva de stock, pagos — sin lógica duplicada ni mantenida por separado.

### 9.5 Cultura (`/cultura`)

**Propósito**: agenda de eventos culturales con boletería opcional, galería social tipo Facebook con "me gusta" real, favoritos, mapa y SEO. Un `EventoCultural` sin entradas es puramente informativo; en cuanto tiene `EntradaCultural`, se vuelve transaccional y **reutiliza la comisión y dispersión de la plataforma** (mismo patrón que Tour). Incluye "Comparte tu Chocó": publicaciones comunitarias **sin moderación previa**, con control reactivo vía denuncias.

**Enums**: `EstadoEventoCultural`, `EstadoReservaCultural`, `MotivoDenunciaPublicacion`, `EstadoDenunciaPublicacion`.

**Modelos**: `EventoCultural` (organizador, ubicación con lat/lng, fechas, portada/fotos/video, `patrimonio`+`patrimonioNota`, `gratuito`, `destacado`); `EntradaCultural` (boletería: nombre, precio, cupo, vendidas); `ReservaCultural` (código, cantidad, total, `comision`/`tasaComision`); `PublicacionCultural` ("Comparte tu Chocó": autor, fotos/video, `activa` = el "ocultar" de moderación reactiva); `LikePublicacionCultural` (like real, toggle, `@@unique`); `DenunciaPublicacionCultural`.

**Backend**: `routes/cultura.routes.js` (montado bajo `/cultura`). Tres pares de `multer` reutilizables (reseñas, publicaciones, eventos). `services/cultura.service.js`, `repositories/cultura.repository.js`, `controllers/cultura.controller.js`.

**Frontend**: `app/cultura/page.tsx` (agenda, vista grid/mapa), `[id]/page.tsx`, `galeria/page.tsx` (feed social), `comparte/page.tsx`, `mis-reservas/page.tsx`, `favoritos/page.tsx`; comerciante `app/comerciante/cultura/page.tsx` (crea eventos, boletería, mapa interactivo); admin `app/admin/cultura/page.tsx`.

**Flujo**: (1) organizador crea evento en `BORRADOR`, sube media, opcionalmente crea entradas; (2) al publicar aparece en la agenda filtrable; (3) cliente reserva si hay entradas, con comisión calculada igual que Tour; (4) organizador gestiona reservas; (5) tras usar la reserva, reseña con foto/video; (6) en paralelo, "Comparte tu Chocó" publica **de inmediato sin moderación previa** — control reactivo por denuncias, y a diferencia de Empleo/Inmuebles, **no hay bloqueo de cuenta** en este flujo, solo ocultar la publicación individual (contenido de menor riesgo); (7) likes reales toggleables; (8) favoritos comparten el modelo `Favorito` con Empleo.

**Regla no obvia**: las rutas admin de publicaciones se declaran como `/admin/publicaciones/...` (no `/admin/cultura/publicaciones/...`) porque el router ya se monta en `/cultura` — de lo contrario quedaría duplicado.

### 9.6 Alianzas Comerciales

**Propósito**: cupón compartido entre comercios de **distintos módulos** (Express, Hotel, Tour, Transporte, Pedido) para campañas conjuntas de turismo regional — ej. un restaurante + un hotel + un transportador bajo un solo código de descuento.

**Modelos**: `AlianzaComercial` (`nombre`, `departamento`/`municipio`, `codigoCompartido` único, `estado` (`PENDIENTE_APROBACION|PUBLICADA|RECHAZADA|DESPUBLICADA`), `inicio`/`fin`, `creadoPorComercioId`, `aprobadoPor`); `AlianzaSocio` (`alianzaId`, `comercioId`, `modulo`, `tipoDescuento`, `valorDescuento`, `aceptado`, `activo`). `@@unique([alianzaId, comercioId, modulo])`.

**Backend**: `routes/alianza.routes.js` (bajo `/alianzas`). `services/alianza.service.js` — **sin repository separado**, llama directo a Prisma. Aprobación admin vive en `admin.routes.js`.

**Buscador de socios**: no hay endpoint dedicado — reutiliza `GET /comercios/buscar?q=texto`, el mismo autocomplete genérico de comercios usado en otras partes de la plataforma.

**Frontend**: `app/comerciante/alianzas/page.tsx`.

**Flujo**: (1) un comercio **verificado** crea la alianza, se auto-agrega como primer socio ya `aceptado: true`; (2) se genera `codigoCompartido` único vía slug + sufijo; (3) el creador **o cualquier socio ya aceptado** invita a otros comercios verificados a un módulo específico; (4) el invitado acepta o rechaza; (5) **regla de buena fe**: un socio no puede retirarse en los últimos 7 días de vigencia de una alianza publicada; (6) admin aprueba solo con **mínimo 2 socios aceptados**; (7) en checkout de cualquier módulo, el código se valida análogo a un cupón normal — solo aplica si el comercio es socio aceptado y activo en ese módulo, alianza publicada, dentro de vigencia; (8) la página pública de descubrimiento **no expone el descuento de cada socio** — solo se revela en el checkout, para evitar que se use como catálogo de comparación entre competidores.

**Reglas no obvias**: hay un TODO explícito sin implementar (verificar si la alianza está anclada a un evento de Cultura en curso, para impedir retiro mientras esté activo).

### 9.7 Catálogo DANE (ubicación)

**No es una tabla en la base de datos** — vive como **dos archivos estáticos duplicados**: `afromercado/src/data/colombia-dane.js` (backend) y `afromercado-web/lib/data/colombia.ts` (frontend). Cubre los 33 departamentos y ~1123 municipios, generado del dataset público de códigos DANE (datos.gov.co). Se corrigió un error real del dataset fuente ("San Pablo de Borbur" duplicado entre Bolívar y Boyacá).

**Validación backend**: `afromercado/src/utils/ubicacion.js`, función `validarUbicacion(departamento, municipio)` — comparación estricta de string contra el catálogo, sin normalización de tildes/mayúsculas. **Uso acotado**: solo `comercio.service.js` y `direccion.service.js` la invocan.

**Regla no obvia**: la validación es de doble capa pero **no compartida** entre frontend y backend (dos archivos independientes que deben mantenerse sincronizados manualmente, sin importación cruzada). Módulos como Empleo, Bienes Raíces, Cultura, Alianzas y los 4 servicios especializados usan `departamento`/`municipio` como texto libre poblado desde el mismo catálogo en el frontend, pero **sin** pasar por `validarUbicacion` en el backend — la integridad ahí depende solo de que el frontend use el dropdown correctamente.

---

## 10. Arquitectura frontend

### 10.1 Estructura de `afromercado-web/app/`

Next.js 16, App Router, React 19. **Todas las páginas interactivas llevan `'use client'`** (no hay Server Components de datos — el patrón es fetch client-side vía `apiFetch`).

Rutas principales por audiencia:

**Públicas / compra**: `/` (tienda), `/buscar`, `/producto/[id]`, `/comercio/[id]`, `/carrito`, `/checkout`, `/pedido/[id]`, `/mis-pedidos`, `/mis-direcciones`, `/mis-favoritos`, `/mi-cuenta`, `/mi-cuenta/puntos`, `/perfil`, `/notificaciones`, `/directorio`, `/directorio/[id]`, `/directorio-compras-publicas`, `/agro`, `/temporada`, `/certificacion`, `/contacto`, `/cookies`, `/privacidad`, `/terminos`, `/publicidad`, `/datos-abiertos`, `/offline` (fallback PWA).

**Autenticación** (español, no `/login`): `/ingresar`, `/registro`, `/recuperar-password`.

**Verticales de servicios**: Express (`/express`, `[id]`, `favoritos`, `mis-pedidos`), Hoteles (`/hoteles`, `[id]`, `checkin`, `favoritos`, `mis-reservas`), Tours, Transportes — mismo patrón en los 4.

**Cultura**: `/cultura`, `[id]`, `comparte`, `favoritos`, `galeria`, `mis-reservas`.

**Empleo** (incluye Servicios Profesionales): `/empleo`, `[id]`, `favoritos`, `mi-hoja-de-vida`, `mis-ofertas`, `mis-postulaciones`, `publicar`.

**Bienes Raíces**: `/bienes-raices`, `[id]`, `mis-publicaciones`, `publicar`.

**Alianzas**: `/alianzas`, `/alianzas/[codigo]`.

**Otros**: `/envios`, `/mis-disputas`, `/mis-pqrsd`, `/chat`, `/repartidor`, `/ser-repartidor`.

**`/comerciante/*`** (un mismo layout de rol): `dashboard`, `perfil`, `registro-comercio`, `productos`, `mis-productos`, `publicar`, `pedidos`, `express`, `hoteles`, `tours`, `transportes`, `cultura`, `cupones`, `ofertas`, `alianzas`, `analytics`, `disputas`, `liquidaciones`, `publicidad`, `reportes`.

**`/admin/*`** (muy granular, una página por dominio): `afromedia`, `alianzas`, `campanas`, `categorias`, `comerciantes`, `comercios`, `config`, `cultura`, `cupones`, `disputas`, `empleo`, `entregas`, `envios`, `facturas`, `hero`, `hoteles`, `inmuebles`, `liquidaciones`, `pagos-config`, `pedidos`, `pqrsd`, `productos`, `reglas`, `reportes`, `reviews`, `solicitudes-repartidor`, `tours`, `transportes`, `usuarios`, `visibilidad`.

### 10.2 `lib/api/client.ts` — `apiFetch<T>`

Cliente HTTP único, sin dependencias externas.

- `API_URL`: `NEXT_PUBLIC_API_URL` si está definida; si no, fallback duro (`https://afromercado-api.onrender.com/api` prod, `http://localhost:3001/api` dev).
- `obtenerToken()`: lee `localStorage['afromercado_token']`, seguro en SSR.
- `apiFetch<T>(path, options)`: serializa `body` a JSON salvo `FormData` (detecta con `instanceof`, no fija `Content-Type` para que el navegador ponga el boundary); adjunta `Authorization: Bearer` si hay token; parsea respuesta como texto primero, luego `JSON.parse`; si `!ok`, extrae mensaje de `{error}`/`{message}`, y en **401** dispara `window.dispatchEvent(new CustomEvent('afm:session-expired'))` antes de lanzar el `Error`; fallo de red se traduce a `Error('No se pudo conectar con el servidor.')`.

### 10.3 Patrón `lib/api/*.ts`

Un archivo por dominio, cada uno expone funciones tipadas que envuelven `apiFetch`. 32 archivos: `admin`, `alianza`, `auth`, `bienes-raices`, `busqueda`, `carrito`, `chat`, `client`, `config-fiscal`, `config`, `cultura`, `cupones`, `datosabiertos`, `direccion`/`direcciones`, `directorio`, `disputas`, `empleo`, `envios`, `express`, `facturacion`, `favoritos`, `fidelizacion`, `hotel`, `pedidos`, `pqrsd`, `productos`, `recibo`, `recuperacion`, `repartidor`, `review`, `tour`, `transporte`, `usuario`.

### 10.4 Contextos globales (`context/`)

- **`AuthContext.tsx`** — fuente de verdad de sesión. Estado: `usuario`, `token`, `cargando`, `autenticado`. Persiste en `localStorage['afromercado_token']`/`['afromercado_usuario']`. **Escucha `afm:session-expired`** y hace logout automático — cierra sesión ante cualquier 401 de cualquier request.
- **`CarritoContext.tsx`** — carrito del marketplace general. Modo invitado: persiste en `localStorage['afromercado_carrito']`. Al autenticarse: sube cada item local pendiente al backend, carga el carrito del servidor y limpia el local (fusión invitado→autenticado).
- **`FavoritoContext.tsx`** — solo IDs de producto favoritos, actualización optimista con rollback en error.
- **`NotificacionContext.tsx`** — el más complejo. Se conecta a **SSE** (`EventSource`) en `${API_URL}/notificaciones/stream?token=...` (token en query string porque `EventSource` no admite headers custom). Escucha `notificacion`, `MENSAJE_NUEVO` (chat), `ubicacion-repartidor` (tracking en vivo).
- **`PushContext.tsx`** — sin valor expuesto, solo side-effect: suscribe/desuscribe push del navegador según cambia `token`/`autenticado`, encolando operaciones para evitar carreras.
- **`RegionContext.tsx`** — región/departamento activo para filtrar catálogos por proximidad. Persiste en `localStorage['afm_region_activa']`, puede detectar por GPS, calcula departamento más cercano vía el catálogo DANE.

---

## 11. Roles y permisos

Existe un documento dedicado: `D:\AfroMercado\docs\teravia\09-roles-y-permisos.md` ("Anexo C — Arquitectura de Roles y Permisos").

### El enum real

```prisma
enum Rol {
  COMPRADOR
  COMERCIANTE
  REPARTIDOR
  ADMIN
}
```

4 roles planos, sin jerarquía ni tabla de permisos. La autorización se hace ruta por ruta con `autorizar(...rolesPermitidos)` — una lista blanca de roles por endpoint.

### COMPRADOR → COMERCIANTE con la misma cuenta

```js
// POST /comercios - abrir tienda con la cuenta ya autenticada (COMPRADOR se
// convierte en COMERCIANTE; ADMIN queda bloqueado dentro del service por
// separación de privilegios). COMERCIANTE también puede pegarle (ej. reintento),
// el service ya rechaza si ya tiene un comercio registrado.
router.post("/", autenticar, autorizar("COMPRADOR", "COMERCIANTE"), ComercioController.registrar);
```

Registrar un comercio actualiza `Usuario.rol = "COMERCIANTE"` y crea el `Comercio` en una sola transacción. No hay flujo separado de "solicitud de comerciante" — es autoservicio (el negocio queda `PENDIENTE_REVISION` hasta que un admin lo verifique).

### Por qué ADMIN es excluyente

El guard bloquea a ADMIN de la ruta de registro de comercio — separación de privilegios deliberada: una cuenta ADMIN no puede convertirse en dueña de un comercio (evita conflicto de interés directo). Es la única regla de exclusión de rol del sistema.

### Matriz de capacidades (resumen)

| Dominio | COMPRADOR | COMERCIANTE | REPARTIDOR | ADMIN |
|---|:---:|:---:|:---:|:---:|
| Registrar/editar su propio comercio | ✔ (al convertirse) | ✔ | — | ✔ |
| Crear/editar/borrar Producto | — | ✔ | — | ✔ |
| Carrito, Pedido, Pago (como comprador) | ✔ | ✔ | ✔ | — |
| Cupón global/plataforma | — | — | — | ✔ |
| Reportes de toda la plataforma | — | — | — | ✔ |
| Configuración global | — | — | — | ✔ (exclusivo) |

Atributos que **no son roles** pero actúan como permisos condicionales sobre `Comercio`: `verificado` (habilita vender de verdad), `disponibleComprasPublicas` (aparecer en directorio B2G), `verificadoEtnico` (sello sin efecto funcional).

### Huecos documentados (no implementados)

1. **No existe rol institucional** (alcaldías/gobernaciones) — el Directorio B2G funciona hoy sin autenticación.
2. **ADMIN es monolítico** — sin separación de funciones. Propuesta no implementada: `permisosAdmin String[]`.

---

## 12. Notificaciones

### Modelo

```prisma
model Notificacion {
  id        Int      @id @default(autoincrement())
  usuarioId Int
  tipo      String
  titulo    String
  mensaje   String
  leida     Boolean  @default(false)
  url       String?
  datos     Json?
  createdAt DateTime @default(now())

  usuario Usuario @relation(fields: [usuarioId], references: [id])
  @@index([usuarioId, leida, createdAt])
}
```

`tipo` es texto libre, usado también como discriminador en el frontend para íconos/routing.

### `src/services/notificacion.service.js` (~890 líneas)

Hub central multi-canal. Cada evento de negocio (checkout, pago aprobado, comercio verificado, entrega asignada, disputa creada, PQRSD, oferta de empleo moderada, alianza pendiente, etc.) dispara hasta **3 canales en paralelo**: in-app (BD + SSE), email, WhatsApp; en eventos críticos también push.

- `crearNotificacionDB(...)` — crea el registro y lo empuja por SSE, usado por métodos "legacy".
- **`crearYEnviar(usuarioIdOrObj, tipo, titulo, mensaje, {...extra})`** — método genérico/moderno, acepta objeto o parámetros posicionales, empaqueta campos extra en `datos` (JSON).
- `notificarAdmins({...})` — itera todos los `Usuario rol: ADMIN` y crea notificación para cada uno.
- `dispararNotificacion(fn, descripcion)` — wrapper que solo hace `console.error` si falla, **sin propagar la excepción** — un fallo de email/WA nunca revierte el flujo de negocio principal.

### Patrón `setImmediate` — fire-and-forget

Confirmado en 20+ ubicaciones. La respuesta HTTP se envía primero (la transacción de negocio ya se completó), y **después** se encola el trabajo de notificar:

```js
setImmediate(async () => {
  try {
    const admins = await prisma.usuario.findMany({ where: { rol: "ADMIN" }, select: { id: true } });
    for (const admin of admins) { /* crea Notificacion + sseManager.enviar */ }
  } catch { /* no interrumpe el flujo principal */ }
});
```

### SSE (`utils/sse-manager.js`)

`notificacion.service.js` empuja eventos vía `sseManager.enviar(usuarioId, "notificacion", notif)`. El frontend se conecta a `GET /notificaciones/stream?token=...` con `EventSource` nativo — de ahí que `middlewares/auth.js` acepte el JWT por query string solo para este caso.

### Push / Service Worker

- **`afromercado-web/public/sw.js`** — cache-first para assets estáticos, network-first con fallback a `/offline` para navegación. **No tiene un listener `self.addEventListener('push', ...)`** — el registro de suscripción push reutiliza este mismo archivo pero no hay código que muestre la notificación al recibir un evento `push` del servidor. Vale la pena verificar si se reporta que las push notifications no aparecen visualmente aunque el backend las envíe.
- **`lib/push.ts`** — `suscribirPush(token)`: pide clave pública VAPID, registra el SW, pide permiso, crea suscripción, la registra en backend.
- Backend: `utils/push.js` expone `enviarPushAUsuario`, usado en eventos críticos (entrega en camino, solicitud de repartidor aprobada, entrega asignada).

---

## 13. Asistente de IA por WhatsApp

### Conexión WhatsApp (`src/utils/whatsapp.js`, vía Baileys)

Usa `@whiskeysockets/baileys`. Máquina de estados: `DESCONECTADO → INICIANDO → ESCANEANDO_QR → CONECTADO`.

- Sesión persistida en `config/whatsapp-session/`; logs en `config/whatsapp-debug.log`.
- `iniciarWhatsApp()` tiene mutex para evitar arranques concurrentes.
- Genera QR como Data URL, emitido por `EventEmitter` (evento `"qr"`) — el panel admin lo consume.
- Reconexión diferenciada por código de error: `loggedOut`/`401` → limpia sesión y exige nuevo QR; `440` (conflicto de sesión) → limpia sesión, **no reintenta automático**; `408` (QR expirado) → reintenta en 5s; otros → reintenta en 8s.
- `enviarMensajeWA(telefono, texto)` — normaliza a formato colombiano; **si no está `CONECTADO`, no lanza excepción visible — solo loguea y retorna** (por eso el resto del código puede llamarlo sin verificar el estado primero).
- `obtenerEstadoWA()` — expone `{ estado, qrDataUrl, iaActiva: !!process.env.ANTHROPIC_API_KEY }`.

**`enviarMensajeWA` es completamente independiente del asistente de IA** — funciona sin `ANTHROPIC_API_KEY`. Lo único que depende de la IA es la generación de **respuestas automáticas a mensajes entrantes**.

### Piloto de IA de solo lectura (`src/services/asistente-whatsapp.service.js`)

Se activa desde el listener `messages.upsert` de Baileys: por cada mensaje entrante que no sea de grupo/estado/propio, genera una respuesta y la envía.

- **Deshabilitado sin `ANTHROPIC_API_KEY`**: retorna `null` inmediatamente si falta la variable.
- Modelo: `process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001"`, `max_tokens: 400`, llamada directa a la API sin SDK.
- **Rate limiting doble**: por remitente (máx. 1 cada 4s) y global (20 respuestas/minuto, ventana deslizante).
- **Historial en memoria** (no en BD): `Map` de `jid → mensajes`, tope de 8 mensajes, TTL de 30 minutos — se pierde si el proceso backend se reinicia.
- **"Solo lectura" real**: el system prompt instruye explícitamente "NUNCA inventes datos de pedidos... No puedes tomar acciones". En código: solo hace `SELECT` (busca `Usuario` por teléfono, trae sus 2 pedidos más recientes) — ninguna mutación de BD.
- Cualquier error se captura y retorna `null` — el asistente simplemente no responde.

---

## 14. Seguridad y denuncias (resumen transversal)

### Verificación de comerciante

```prisma
enum EstadoComerciante {
  PENDIENTE_REVISION
  APROBADO
  RECHAZADO
  SUSPENDIDO
}
```

Por defecto `PENDIENTE_REVISION` al crear el comercio. Campos asociados: `motivoRechazo`, `revisadoPor`, `revisadoAt`; documentos de soporte (`rut`, `camaraComercioNumero/Url`, fotos de documento + sus hashes, probablemente para detectar reutilización del mismo documento entre cuentas). Además existe `verificado` (gate real para poder vender) y `verificadoEtnico` (sello sin efecto funcional, solo admin).

### Cuenta de dispersión

`CuentaDispersionComercio` — cuenta bancaria/billetera del comerciante para recibir pagos. Relacionado con `PagoDispersion` y el job de reintentos (sección 7).

### Otros mecanismos

- `Usuario.activo` — si es `false`, `autenticar` bloquea el acceso.
- `Comercio.whatsappVisible`+`whatsappAprobadoPor`/`At` — gate para mostrar el WhatsApp directo del comerciante (relacionado con venta con contacto directo).
- Soft-delete generalizado (`deletedAt`) en vez de borrado físico.

Los 4 modelos `Denuncia*` (ver sección 5) son el mecanismo principal de moderación reactiva de contenido/transacciones fuera de plataforma.

---

## 15. Deploy y entornos

### Infraestructura

```
Frontend (Next.js) → Vercel
Backend  (Express) → Render
Base de datos      → Neon (PostgreSQL, con connection pooler)
```

- Backend en Render: Root Directory `afromercado`, build `npm install && npm run build` (= `prisma generate`, no bundling), start `npm start`.
- **`DEPLOY.md` (raíz del repo) está desactualizado en un punto importante**: menciona que Render aplica `prisma migrate deploy` en el build — la práctica real (confirmada en `src/server.js`) es que las migraciones DDL se aplican dentro de `aplicarMigraciones()` al arrancar el servidor, precisamente porque el pooler de Neon bloquea `prisma migrate deploy`. Si se sigue `DEPLOY.md` al pie de la letra, ese paso fallaría.
- Sembrado inicial: `npm run seed` desde la Shell de Render (una sola vez) — categorías, productores y cuentas de prueba.
- CORS: variable `CORS_ORIGIN` en Render debe apuntar a la URL de Vercel.
- Render free "duerme" tras 15 min de inactividad (cold start ~30-50s); comprobantes de pago en disco de Render son efímeros; Neon free pausa la BD tras inactividad (y tiene límite mensual de horas de cómputo).

### Variables de entorno — backend (`afromercado/.env`)

Presentes en desarrollo:
```
NODE_ENV, PORT, DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN,
COMISION_PORCENTAJE, BCRYPT_ROUNDS, CLOUDINARY_URL,
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
PLATAFORMA_NEQUI, PLATAFORMA_DAVIPLATA
```

En plantilla (`.env.example`) pero no seteadas localmente (features quedan deshabilitadas/con fallback):
```
CORS_ORIGIN       # vacío = permite todos los orígenes (solo dev)
RESEND_API_KEY    # email transaccional
EMAIL_FROM
ADMIN_EMAIL       # destinatario de alertas admin por email
```

Usadas en código pero ausentes de `.env.example`:
```
ANTHROPIC_API_KEY   # activa el asistente de IA por WhatsApp
ANTHROPIC_MODEL     # opcional, default "claude-haiku-4-5-20251001"
SENTRY_DSN          # si está definida, inicializa Sentry antes que cualquier otro require
```

Variables de pagos Wompi (`WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`/`WOMPI_SIGNATURE_SECRET`, `WOMPI_EVENTS_SECRET`, `WOMPI_PAYOUTS_API_KEY`) — leídas de env o, si faltan, de la tabla `Config` bajo `pagos.wompi.<NOMBRE>`.

### Variables de entorno — frontend (`afromercado-web/.env.local`)

```
NEXT_PUBLIC_API_URL         # ej. http://localhost:3001/api en dev
NEXT_PUBLIC_ADMIN_WHATSAPP  # número de WhatsApp del admin para algún CTA de contacto directo
```

### Migraciones en producción

`aplicarMigraciones()` corre **antes** de `app.listen`, aplicando cada sentencia DDL con `$executeRawUnsafe` e `IF NOT EXISTS` — idempotente, seguro de re-ejecutar en cada arranque. **No usar `prisma migrate deploy` en producción** — incompatible con el pooler de Neon.

---

## 16. Convenciones de desarrollo

- **`nodemon.json`** — solo vigila `src/` (`"watch": ["src"]`), ignora `config/*` explícitamente (evita que archivos de sesión de WhatsApp, que cambian constantemente, disparen reinicios en bucle) y `prisma/migrations/*`. Cambios en `prisma/schema.prisma` **no** disparan reinicio automático — hay que reiniciar el backend manualmente.
- **`prisma generate` en Windows**: el proceso de Node del backend bloquea `query_engine-windows.dll.node` mientras corre. Hay que detener `npm run dev` antes de correr `npm run build` (= `prisma generate`) o el comando falla.
- **Decimal de Prisma → string en JSON**: cualquier campo `@db.Decimal` (precios, montos, calificación) llega desde Prisma/PostgreSQL como **string** al serializarse a JSON. Siempre usar `Number(valor)` antes de operar aritméticamente — omitirlo produce concatenación de strings en vez de suma, un bug silencioso fácil de introducir.
- **`iniciar.bat`** (raíz) — mata procesos Node previos, regenera Prisma, arranca backend (3001) y frontend (3002) en ventanas separadas. Punto de entrada recomendado en Windows para desarrollo local.
- Si el compilador de Next.js sirve código cacheado incorrecto, eliminar `.next/` y reiniciar.
