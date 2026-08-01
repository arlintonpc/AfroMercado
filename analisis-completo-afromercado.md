# Análisis Completo — AfroMercado

> Proyecto marketplace cultural para comunidades afrocolombianas del Chocó.
> Backend: Node.js/Express + Prisma + PostgreSQL (Neon)
> Frontend: Next.js 16 App Router + React 19 + Tailwind 4
> Fecha del análisis: Julio 2026

---

## 1. Arquitectura General

```
D:\AfroMercado\
│
├── afromercado/                     # Backend (Node.js/Express)
│   ├── prisma/
│   │   └── schema.prisma           # 3.129 líneas, 60+ modelos
│   ├── src/
│   │   ├── config/                 # index.js (env vars), prisma.js, reglas.js
│   │   ├── controllers/            # 43 controladores
│   │   ├── routes/
│   │   │   ├── index.js           # Router maestro (monta 41+ subrouters)
│   │   │   └── *.routes.js        # 41+ archivos de rutas
│   │   ├── services/
│   │   │   ├── *.service.js       # 37 servicios
│   │   │   ├── payments/          # provider-factory + providers/
│   │   │   └── facturacion/       # (subdirectorio)
│   │   ├── repositories/          # 21 repositorios (capa Prisma)
│   │   ├── middlewares/           # auth.js, errores.js, moduloActivo.js
│   │   ├── utils/                 # cloudinary.js, email.js, whatsapp.js, cron.js...
│   │   ├── jobs/                  # 4 cron jobs
│   │   └── data/                  # (datos semilla)
│   ├── uploads/                   # 11 subdirectorios (productos, videos, etc.)
│   ├── config/                    # Archivos generados (logs, sesión WhatsApp)
│   └── .env                       # Config dev local
│
├── afromercado-web/               # Frontend (Next.js 16)
│   ├── app/
│   │   ├── admin/                 # 33 rutas (panel admin)
│   │   ├── comerciante/           # 26 rutas (panel vendedor)
│   │   ├── express/, hoteles/, tours/, transportes/, cultura/
│   │   ├── empleo/, inmuebles/
│   │   └── + (home, productos, carrito, checkout, auth...)
│   ├── components/                # 113 componentes
│   ├── lib/api/                   # 33 clientes API
│   ├── context/                   # 8 contextos globales
│   ├── hooks/                     # 4 hooks personalizados
│   └── types/                     # 6 archivos de tipos
│
├── iniciar.bat                    # Script de arranque (Windows)
└── AGENTS.md                      # Guía para asistentes IA
```

---

## 2. Backend — Mapa Completo

### 2.1 Router Maestro (`routes/index.js`)

Monta **43 routers** bajo `/api/`:

| # | Ruta | Archivo | Controlador | Estado |
|---|------|---------|-------------|--------|
| 1 | `/api/` | — | Health check (inline) | ✅ |
| 2 | `/api/auth` | auth.routes.js | auth.controller.js | ✅ |
| 3 | `/api/usuario` | usuario.routes.js | usuario.controller.js | ✅ |
| 4 | `/api/productos` | producto.routes.js | producto.controller.js | ✅ |
| 5 | `/api/comercios` | comercio.routes.js | comercio.controller.js | ✅ |
| 6 | `/api/carrito` | carrito.routes.js | carrito.controller.js | ✅ |
| 7 | `/api/pedidos` | pedido.routes.js | pedido.controller.js | ✅ |
| 8 | `/api/direcciones` | direccion.routes.js | direccion.controller.js | ✅ |
| 9 | `/api/reviews` | review.routes.js | review.controller.js | ✅ |
| 10 | `/api/categorias` | categorias.routes.js | (inline) | ✅ |
| 11 | `/api/pagos` | pago.routes.js | pago.controller.js | ✅ |
| 12 | `/api/admin` | admin.routes.js | admin.controller.js | ✅ |
| 13 | `/api/config` | config.routes.js | config.controller.js | ✅ |
| 14 | `/api/campanas` | campana.routes.js | campana.controller.js | ✅ |
| 15 | `/api/ofertas` | oferta.routes.js | oferta.controller.js | ✅ |
| 16 | `/api/upload` | upload.routes.js | (multer inline) | ✅ |
| 17 | `/api/notificaciones` | notificacion.routes.js | notificacion.controller.js | ✅ |
| 18 | `/api/favoritos` | favorito.routes.js | favorito.controller.js | ✅ |
| 19 | `/api/cupones` | cupon.routes.js | cupon.controller.js | ✅ |
| 20 | `/api/chat` | chat.routes.js | chat.controller.js | ✅ |
| 21 | `/api/repartidor` | repartidor.routes.js | repartidor.controller.js | ✅ |
| 22 | `/api/envios` | envio.routes.js | envio.controller.js | ✅ |
| 23 | `/api/reportes` | reporte.routes.js | reporte.controller.js | ✅ |
| 24 | `/api/inventario` | inventario.routes.js | inventario.controller.js | ✅ |
| 25 | `/api/push` | push.routes.js | push.controller.js | ✅ |
| 26 | `/api/liquidaciones` | liquidacion.routes.js | liquidacion.controller.js | ✅ |
| 27 | `/api/publicidad` | publicidad.routes.js | publicidad.controller.js | ✅ |
| 28 | `/api/express` | express.routes.js | express.controller.js | ✅ |
| 29 | `/api/hoteles` | hotel.routes.js | hotel.controller.js | ✅ |
| 30 | `/api/tours` | tour.routes.js | tour.controller.js | ✅ |
| 31 | `/api/transportes` | transporte.routes.js | transporte.controller.js | ✅ |
| 32 | `/api/cultura` | cultura.routes.js | cultura.controller.js | ✅ |
| 33 | `/api/busqueda` | busqueda.routes.js | busqueda.controller.js | ✅ |
| 34 | `/api/alianzas` | alianza.routes.js | alianza.controller.js | ✅ |
| 35 | `/api/datos-abiertos` | datosabiertos.routes.js | datosabiertos.controller.js | ✅ |
| 36 | `/api/directorio-compras-publicas` | directorio.routes.js | directorio.controller.js | ✅ |
| 37 | `/api/directorio` | directorio-general.routes.js | directorio-general.controller.js | ✅ |
| 38 | `/api/` (disputas) | disputa.routes.js | disputa.controller.js | ✅ |
| 39 | `/api/` (config-fiscal) | config-fiscal.routes.js | config-fiscal.controller.js | ✅ |
| 40 | `/api/` (facturacion) | facturacion.routes.js | facturacion.controller.js | ✅ |
| 41 | `/api/` (pqrsd) | pqrsd.routes.js | pqrsd.controller.js | ✅ |
| 42 | `/api/` (fidelizacion) | fidelizacion.routes.js | fidelizacion.controller.js | ✅ |
| 43 | `/api/` (empleo) | empleo.routes.js | empleo.controller.js | ✅ |
| 44 | `/api/` (inmueble) | inmueble.routes.js | inmueble.controller.js | ✅ |

### 2.2 Capa de Servicios (`services/` - 37 archivos + 2 subdirectorios)

| Archivo | Función | Líneas aprox |
|---------|---------|-------------|
| admin.service.js | Panel admin (dashboard, CRUD global) | ~689 |
| alianza.service.js | Alianzas comerciales | — |
| asistente-whatsapp.service.js | Chatbot IA por WhatsApp | — |
| auth.service.js | Autenticación JWT | — |
| busqueda.service.js | Búsqueda global | — |
| carrito.service.js | Carrito de compras | — |
| comercio.service.js | Gestión de comercios | — |
| comercio-revision.service.js | Revisión de nuevos comercios | — |
| config-fiscal.service.js | Configuración fiscal | — |
| cuenta-dispersion.service.js | Dispersión de pagos a comercios | — |
| cultura.service.js | Eventos culturales | — |
| declaracion-territorial.service.js | Declaración territorial | — |
| direccion.service.js | Direcciones de envío | — |
| disputa.service.js | Mediación de reclamos | — |
| empleo.service.js | Bolsa de empleo | — |
| express.service.js | Pedidos de comida (Express) | — |
| facturacion.service.js | Facturación electrónica | — |
| fidelizacion.service.js | Puntos y fidelización | — |
| hotel.service.js | Reservas de hotel | — |
| inmueble.service.js | Bienes raíces | — |
| inventario.service.js | Control de inventario | — |
| notificacion.service.js | Notificaciones in-app | — |
| pago.service.js | Lógica de pagos (general) | — |
| pago-digital.service.js | Pagos digitales (Wompi/Sandbox) | ~1.041 |
| pago-publicidad.service.js | Pagos de publicidad | — |
| pago-repartidor.service.js | Pagos a repartidores | — |
| payment-config.service.js | Config de pasarela | ~246 |
| pedido.service.js | Gestión de pedidos | — |
| pqrsd.service.js | PQRSD | — |
| producto.service.js | CRUD de productos | — |
| recuperacion.service.js | Recuperación de contraseña | — |
| reporteExcel.service.js | Exportación a Excel | — |
| review.service.js | Calificaciones y reseñas | — |
| tour.service.js | Gestión de tours | — |
| transporte.service.js | Gestión de transportes | — |
| usuario.service.js | CRUD de usuarios | — |
| visibilidad.service.js | Feature flags | — |

### 2.3 Capa de Repositorios (`repositories/` - 21 archivos)

carrito.repository.js, comercio.repository.js, config-fiscal.repository.js, config.repository.js, cultura.repository.js, cupon.repository.js, datosabiertos.repository.js, direccion.repository.js, empleo.repository.js, fidelizacion.repository.js, inmueble.repository.js, pago.repository.js, pedido.repository.js, pqrsd.repository.js, producto.repository.js, reporte.repository.js, review.repository.js, sesion-reset.repository.js, token-recuperacion.repository.js, usuario.repository.js, visibilidad.repository.js

### 2.4 Middlewares (3 archivos)

| Archivo | Función |
|---------|---------|
| auth.js | `autenticar` (JWT), `autorizar(...roles)`, `autenticarOpcional` |
| errores.js | `manejadorErrores`, `rutaNoEncontrada` |
| moduloActivo.js | Gate de feature flags por módulo |

### 2.5 Jobs (4 archivos)

| Archivo | Función |
|---------|---------|
| expirarReservasHotel.js | Auto-cancelar reservas no pagadas |
| recordatorioTour.js | Recordar tours próximos |
| reintentar-dispersiones.job.js | Reintentar pagos fallidos a comercios |
| reintentar-facturacion.job.js | Reintentar facturación electrónica fallida |

### 2.6 Config (`config/`)

| Archivo | Función |
|---------|---------|
| index.js | Variables de entorno + validación |
| prisma.js | Cliente Prisma singleton |
| reglas.js | Centro de reglas de negocio |

### 2.7 Utils (30+ archivos)

| Archivo | Función |
|---------|---------|
| cloudinary.js | Subida a Cloudinary via fetch + SHA-1 |
| email.js | Nodemailer (SMTP desde Config DB o env vars) |
| whatsapp.js | Baileys WebSocket (WhatsApp) |
| cron.js | Inicializador de cron jobs |
| cuentas-dispersion.js | Cifrado de cuentas bancarias |
| migrador.js | Migraciones automáticas via SQL raw |
| bloqueos-transaccionales.js | Bloqueo de pedidos (transacciones) |
| errores.js | Clases de error personalizadas |

---

## 3. Frontend — Mapa de Páginas

### 3.1 Panel Admin (`/admin/` - 33 rutas)

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/admin` | page.tsx | Dashboard / resumen |
| `/admin/ingresar` | page.tsx | Login admin |
| `/admin/categorias` | page.tsx | Gestión de categorías |
| `/admin/usuarios` | page.tsx | CRUD usuarios |
| `/admin/comercios` | page.tsx | Gestión de comercios |
| `/admin/comerciantes` | page.tsx | Gestión de comerciantes |
| `/admin/solicitudes-repartidor` | page.tsx | Solicitudes de repartidores |
| `/admin/liquidaciones` | page.tsx | Liquidaciones y comisiones |
| `/admin/disputas` | page.tsx | Reclamos y mediación |
| `/admin/facturas` | page.tsx | Facturación electrónica |
| `/admin/pqrsd` | page.tsx | PQRSD |
| `/admin/empleo` | page.tsx | Bolsa de empleo |
| `/admin/inmuebles` | page.tsx | Bienes raíces |
| `/admin/cultura` | page.tsx | Eventos culturales |
| `/admin/entregas` | page.tsx | Gestión de entregas |
| `/admin/envios` | page.tsx | Envíos |
| `/admin/pedidos` | page.tsx | Pedidos |
| `/admin/pagos-config` | page.tsx | Configuración de pasarela |
| `/admin/cupones` | page.tsx | Cupones de descuento |
| `/admin/alianzas` | page.tsx | Alianzas comerciales |
| `/admin/afromedia` | page.tsx | Publicidad / AfroMedia |
| `/admin/visibilidad` | page.tsx | Feature flags |
| `/admin/campanas` | page.tsx | Campañas publicitarias |
| `/admin/hero` | page.tsx | Sección Hero del home |
| `/admin/reportes` | page.tsx | Reportes y analytics |
| `/admin/productos` | page.tsx | Productos (admin) |
| `/admin/reviews` | page.tsx | Calificaciones |
| `/admin/hoteles` | page.tsx | Gestión de hoteles |
| `/admin/tours` | page.tsx | Gestión de tours |
| `/admin/transportes` | page.tsx | Gestión de transportes |
| `/admin/config` | page.tsx | Config general |
| `/admin/reglas` | page.tsx | (existe pero no en nav) |

### 3.2 Panel Comerciante (`/comerciante/` - 26 rutas)

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/comerciante` | page.tsx | Dashboard |
| `/comerciante/ingresar` | page.tsx | Login comerciante |
| `/comerciante/registro-comercio` | page.tsx | Registro de tienda |
| `/comerciante/dashboard` | page.tsx | Panel principal |
| `/comerciante/pedidos` | page.tsx | Pedidos recibidos |
| `/comerciante/express` | page.tsx | Módulo Express (comida) |
| `/comerciante/hoteles` | page.tsx | Módulo Hoteles |
| `/comerciante/tours` | page.tsx | Módulo Tours |
| `/comerciante/transportes` | page.tsx | Módulo Transporte |
| `/comerciante/cultura` | page.tsx | Módulo Cultura |
| `/comerciante/mis-productos` | page.tsx | Productos del comercio |
| `/comerciante/inventario` | page.tsx | Control de inventario |
| `/comerciante/contabilidad` | page.tsx | Contabilidad |
| `/comerciante/publicar` | page.tsx | Publicar nuevo producto |
| `/comerciante/vitrina` | page.tsx | Vitrina de video |
| `/comerciante/ofertas` | page.tsx | Ofertas y descuentos |
| `/comerciante/cupones` | page.tsx | Cupones |
| `/comerciante/alianzas` | page.tsx | Alianzas |
| `/comerciante/publicidad` | page.tsx | Publicidad |
| `/comerciante/analytics` | page.tsx | Analíticas |
| `/comerciante/liquidaciones` | page.tsx | Liquidaciones |
| `/comerciante/disputas` | page.tsx | Reclamos |
| `/comerciante/perfil` | page.tsx | Perfil de tienda |
| `/comerciante/productos` | page.tsx | (ruta adicional) |
| `/comerciante/reportes` | page.tsx | (ruta adicional) |

### 3.3 Páginas Públicas

| Ruta | Módulo |
|------|--------|
| `/` | Home (8 secciones) |
| `/ingresar` | Login |
| `/registro` | Registro |
| `/productos` | Marketplace general |
| `/productos/[id]` | Detalle producto |
| `/carrito` | Carrito de compras |
| `/checkout` | Checkout |
| `/express/[id]` | Menú restaurante + checkout Express |
| `/hoteles` | Listado hoteles |
| `/hoteles/[id]` | Detalle hotel |
| `/tours` | Listado tours |
| `/transportes` | Listado transportes |
| `/cultura` | Eventos culturales |
| `/empleo` | Bolsa de empleo |
| `/inmuebles` | Bienes raíces |
| `/notificaciones` | Centro de notificaciones |
| `/terminos` | Términos y condiciones |
| `/privacidad` | Política de privacidad |

---

## 4. Contextos Globales (8)

| Contexto | Archivo | Función |
|----------|---------|---------|
| AuthContext | context/AuthContext.tsx | Usuario autenticado + token localStorage |
| CarritoContext | context/CarritoContext.tsx | Carrito marketplace |
| FavoritoContext | context/FavoritoContext.tsx | Favoritos |
| NotificacionContext | context/NotificacionContext.tsx | Notificaciones in-app |
| PushContext | context/PushContext.tsx | Web Push (VAPID) |
| (y otros 3 más) | | |

---

## 5. Servicios Externos

| Servicio | Uso | Estado |
|----------|-----|--------|
| **Render** | Hosting backend | ✅ Configurado |
| **Vercel** | Hosting frontend | ✅ Configurado |
| **Neon** | PostgreSQL serverless | ⚠️ Pooler bloquea migraciones |
| **Wompi** | Pasarela de pagos | ⚠️ Implementado pero en Sandbox |
| **Cloudinary** | Almacenamiento de imágenes | ⚠️ Solo en dev |
| **Sentry** | Reporte de errores | ⚠️ DSN opcional, no configurado |
| **Resend / Nodemailer** | Correos transaccionales | ❌ No configurado |
| **Baileys (WhatsApp)** | Notificaciones + chatbot | ⚠️ Inestable |
| **Anthropic (Claude)** | Chatbot IA WhatsApp | ❌ API key no configurada |

---

## 6. Base de Datos — Schema Prisma

### 6.1 Modelos Principales (60+)

| Modelo | Descripción |
|--------|-------------|
| Usuario | Compradores, comerciantes, repartidores, admins |
| Comercio | Tiendas de los vendedores |
| Producto | Productos físicos con variantes y atributos |
| ProductoMedia | Imágenes de productos (Cloudinary URL + disco local) |
| CarritoItem | Items en carrito |
| Pedido | Pedido general (puede contener múltiples subpedidos) |
| SubPedido | Pedido por comercio individual |
| Pago | Pago asociado a un pedido |
| Dispersion | Dispersión de fondos a comercios |
| Direccion | Direcciones de envío |
| Review | Calificaciones de productos |
| Categoria | Categorías de productos |
| Cupon | Cupones de descuento |
| Oferta | Ofertas y promociones |
| ConfigExpress | Configuración del módulo Express |
| ProductoExpress | Productos del menú Express |
| PedidoExpress | Pedidos de Express |
| GrupoComplemento | Grupos de complementos (ej. bebidas, acompañantes) |
| ItemComplemento | Items dentro de un grupo de complemento |
| PedidoExpressComplemento | Complementos seleccionados en un pedido |
| ConfigHotel | Configuración de hotel |
| HabitacionTipo | Tipos de habitación |
| HabitacionFisica | Habitaciones individuales (inventario) |
| ReservaHotel | Reservas de hotel |
| ConfigTour | Configuración de tour |
| TourLugar | Lugares del tour |
| TourLugarMedia | Imágenes de lugares del tour |
| ConfigTransporte | Configuración de transporte |
| ServicioTransporte | Servicios de transporte |
| ReservaTransporte | Reservas de transporte |
| EventoCultural | Eventos culturales |
| ReviewCultura | Reseñas de eventos culturales |
| DenunciaCultura | Denuncias de contenido cultural |
| OfertaEmpleo | Ofertas de empleo |
| PostulacionEmpleo | Postulaciones a empleos |
| DenunciaEmpleo | Denuncias de ofertas |
| Inmueble | Propiedades inmobiliarias |
| VisitaInmueble | Solicitudes de visita |
| Pqrsd | PQRSD |
| Disputa | Reclamos y mediación |
| MensajeDisputa | Mensajes en una disputa |
| FacturaElectronica | Facturación DIAN |
| Liquidacion | Liquidación de comisiones |
| CampanaPublicitaria | Campañas de publicidad |
| AlianzaComercial | Alianzas entre comercios |
| Chat / MensajeChat | Mensajería entre usuarios |
| Notificacion | Notificaciones in-app |
| Repartidor | Repartidores y tracking |
| Entrega | Asignación de entregas |
| Envio | Envíos de productos |
| Visibilidad | Feature flags por comercio |
| EventoVisibilidad | Historial de cambios de visibilidad |
| CuponVertical | Cupones verticales (por módulo) |
| Fidelizacion | Puntos de fidelización |
| CanjeFidelizacion | Canje de puntos |
| Config | Configuración clave-valor |
| SesionReset | Tokens de recuperación |
| TokenRecuperacion | Tokens de recuperación de contraseña |
| PushSubscription | Suscripciones Web Push |
| DeclaracionTerritorial | Declaración territorial de productos |
| (y más...) | |

### 6.2 Enums (20+)

Rol, UnidadVenta, AlcanceVenta, EstadoPedido, EstadoSubPedido, EstadoPago, TipoOferta, MetodoPago, EstadoEntrega, TipoDocumento, TipoVehiculo, TipoComplemento, EstadoReservaHotel, EstadoReservaTransporte, TipoInmueble, EstadoInmueble, TipoOperacionInmueble, EstadoDisputa, EstadoComercio, TipoPublicidad, EstadoCampana, TipoAlianza, EstadoAlianza, TipoPeriodo

---

## 7. Brechas Críticas — Bloqueantes para Producción

### 🔴 C1: Pasarela de Pagos en Sandbox

- **Archivo**: `afromercado\src\services\payments\provider-factory.js:14`
- `normalizarProveedor()` retorna `SANDBOX` por defecto incluso en producción si no se define `PAYMENT_PROVIDER=WOMPI`
- `wompi.provider.js` (503 líneas) está implementado pero **nunca probado contra Wompi real**
- El admin puede configurar credenciales Wompi vía `/admin/pagos-config` pero no hay validación de que funcionen
- **Impacto**: No hay procesamiento de pagos real. El Sandbox acepta pagos falsos.

### 🔴 C2: SMTP / Correo Electrónico No Configurado

- **Archivo**: `afromercado\src\server.js:29-31`
- Al arrancar muestra: *"SMTP no configurado — los correos transaccionales estarán deshabilitados"*
- `.env` no tiene `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`
- `email.js` lee de `ConfigRepository` (DB) como alternativa a env vars, pero la tabla Config no tiene estos valores seedeados
- **Impacto**: Usuarios no pueden recuperar contraseñas, no reciben confirmaciones de pedido, ni ningún correo transaccional.

### 🔴 C3: CORS_ORIGIN No Definido

- **Archivo**: `afromercado\.env` — `CORS_ORIGIN` está ausente/vacío
- **Archivo**: `afromercado\src\app.js:29-33`
- En producción, si `CORS_ORIGIN` no está definida, `throw new Error(...)` — **el backend no arranca**
- **Impacto**: Zero downtime si se deploya a producción sin esta variable.

### 🔴 C4: Cloudinary Solo en Desarrollo

- `.env` tiene una URL de Cloudinary de desarrollo
- `cloudinary.js:83-84` — si `CLOUDINARY_URL` falta o falla, retorna `null` y el sistema usa disco local
- **Impacto**: En hosting efímero (Render free tier), las imágenes subidas se pierden en cada deploy.

### 🔴 C5: Migraciones Bloqueadas por Neon Pooler

- **Archivo**: `afromercado\prisma\schema.prisma:12` — `directUrl = env("DIRECT_URL")`
- Comentario en schema: *"Pendiente: falta que el dueño provea el connection string directo de Neon"*
- El pooler de Neon bloquea comandos DDL. `prisma migrate deploy` no funciona sin `DIRECT_URL`
- La solución `aplicarMigraciones()` usa `$executeRawUnsafe` pero esto no actualiza el schema de Prisma
- **Impacto**: No se pueden aplicar migraciones de schema de forma estándar.

### 🔴 C6: WhatsApp/Baileys Inestable

- **Archivo**: `afromercado\src\utils\whatsapp.js` (254 líneas)
- Baileys es inherentemente inestable en entornos serverless/ephemeral
- Errores 440 (conflicto), 401 (fallo conexión), 408 (timeout QR) requieren reconexión manual
- Cada reinicio de nodemon intenta crear un nuevo socket → bucles 440
- **Impacto**: Notificaciones WhatsApp y chatbot IA serán poco confiables.

### 🔴 C7: Archivos Temporales en la Raíz del Proyecto

- `afromercado/config/email-debug.log`
- `afromercado/config/whatsapp-debug.log`
- `afromercado/config/whatsapp-session/` (credenciales de sesión)
- **Impacto**: Estos archivos NO parecen estar en `.gitignore`. Podrían committear credenciales de WhatsApp y logs con datos personales.

---

## 8. Hallazgos Importantes (No Bloqueantes)

### 🟡 I1: Sin `.gitignore` para Archivos Generados
- `config/email-debug.log`, `config/whatsapp-debug.log`, `config/whatsapp-session/` deben agregarse al `.gitignore`

### 🟡 I2: Tests Limitados
- Solo 3 unidades (comisión, productos, pago-repartidor) + E2E
- Sin tests para Express, Hotel, Tour, Transporte, Cultura, Empleo, Inmueble, Pagos Wompi

### 🟡 I3: Páginas Públicas Faltantes
- `/empleo` e `/inmuebles` existen pero no están enlazadas desde el nav público principal
- `/directorio-compras-publicas` tiene backend pero no página frontend

### 🟡 I4: `upload.routes.js` sin Controlador Dedicado
- La ruta `/api/upload` existe en el router pero no hay `upload.controller.js`
- La lógica de upload está manejada inline con multer

### 🟡 I5: `ANTHROPIC_API_KEY` No Configurada
- `config/index.js` advierte si falta
- El asistente WhatsApp (`asistente-whatsapp.service.js`) la requiere y está deshabilitado

### 🟡 I6: `DIRECT_URL` No Definida
- `schema.prisma` requiere `DIRECT_URL` para migraciones
- Sin ella, comandos como `prisma migrate deploy` fallan

### 🟡 I7: Módulos sin UI Admin/Comerciante
- **Fidelización**: Backend completo pero sin UI en admin ni comerciante
- **Push Admin**: Backend completo pero sin UI de administración
- **Notificaciones Admin**: No hay página admin para gestionar notificaciones globales

---

## 9. Matriz de Completitud por Módulo

| Módulo | Backend | Frontend Público | Admin | Comerciante | Tests |
|--------|---------|------------------|-------|-------------|-------|
| Auth | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ❌ |
| Productos | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ Parcial |
| Comercio | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ❌ |
| Carrito | ✅ 100% | ✅ 100% | N/A | N/A | ❌ |
| Pedidos | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ❌ |
| Pagos | ⚠️ 90% | ⚠️ 80% | ⚠️ 80% | N/A | ❌ |
| Express | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ❌ |
| Hotel | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ❌ |
| Tour | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ❌ |
| Transporte | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ❌ |
| Cultura | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ❌ |
| Empleo | ✅ 100% | ✅ 100% | ✅ 100% | N/A | ❌ |
| Inmueble | ✅ 100% | ✅ 100% | ✅ 100% | N/A | ❌ |
| Cupones | ✅ 100% | ⚠️ 70% | ✅ 100% | ✅ 100% | ❌ |
| Publicidad | ✅ 100% | ❌ | ✅ 100% | ✅ 100% | ❌ |
| Disputas | ✅ 100% | ⚠️ 80% | ✅ 100% | ✅ 100% | ❌ |
| Facturación | ✅ 100% | ❌ | ✅ 100% | N/A | ❌ |
| PQRSD | ✅ 100% | ❌ | ✅ 100% | N/A | ❌ |
| Fidelización | ⚠️ 90% | ❌ | ❌ | ❌ | ❌ |
| Liquidaciones | ✅ 100% | ❌ | ✅ 100% | ✅ 100% | ❌ |
| Repartidor | ✅ 100% | ✅ 100% | ✅ 100% | N/A | ✅ Parcial |
| Chat | ✅ 100% | ✅ 100% | N/A | N/A | ❌ |
| Analytics | ✅ 100% | ❌ | ✅ 100% | ✅ 100% | ❌ |
| Alianzas | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ❌ |
| WhatsApp | ⚠️ 80% | N/A | ❌ | N/A | ❌ |
| Notificaciones | ✅ 100% | ✅ 100% | ❌ | ❌ | ❌ |
| Directorio | ✅ 100% | ❌ | N/A | N/A | ❌ |
| Datos Abiertos | ✅ 100% | ❌ | N/A | N/A | ❌ |
| Visibilidad | ✅ 100% | ❌ | ✅ 100% | N/A | ❌ |
| Push | ✅ 100% | ✅ 100% | ❌ | N/A | ❌ |

---

## 10. Prioridad Sugerida de Correcciones

| Prioridad | Issue | Esfuerzo | Impacto | Dependencias |
|-----------|-------|----------|---------|-------------|
| 🔴 P1 | **C2: SMTP/Email** | Bajo (configurar env vars + seed DB) | Usuarios no pueden recuperar contraseña ni recibir confirmaciones | — |
| 🔴 P2 | **C3: CORS_ORIGIN** | Mínimo (1 env var) | Backend no arranca en producción | — |
| 🔴 P3 | **C1: Wompi real** | Medio (probar + configurar) | No hay pagos reales | P2 (CORS para webhook) |
| 🔴 P4 | **C4: Cloudinary producción** | Medio (cuenta + config) | Archivos subidos se pierden en deploy | — |
| 🔴 P5 | **C5: Neon DIRECT_URL** | Medio (obtener connection string) | Migraciones bloqueadas | — |
| 🔴 P6 | **C7: Temp files / .gitignore** | Bajo | Seguridad, higiene Git | — |
| 🔴 P7 | **C6: WhatsApp estable** | Alto (alternativa o robustez) | Notificaciones poco confiables | — |

---

## 11. Resumen de Componentes

| Categoría | Cantidad |
|-----------|----------|
| Controladores backend | 43 |
| Routers backend | 43 |
| Servicios backend | 39 |
| Repositorios backend | 21 |
| Middlewares backend | 3 |
| Jobs (cron) backend | 4 |
| Modelos Prisma | 60+ |
| Enums Prisma | 20+ |
| Páginas frontend (aprox) | 176+ |
| Componentes frontend | 113 |
| Clientes API frontend | 33 |
| Contextos globales | 8 |
| Hooks personalizados | 4 |
| Archivos de tipos | 6 |
| Brechas críticas | 7 |
| Hallazgos importantes | 7 |

---

> **Conclusión**: El proyecto tiene una cobertura funcional muy amplia (~90% de los módulos completos en backend y frontend). Las brechas son principalmente de configuración de servicios externos (pagos, email, cloudinary, CORS) más que de funcionalidad faltante. Con ~1-2 semanas de trabajo enfocado en las 7 brechas críticas, el proyecto estaría listo para producción.
