# AfroMercado — Documentación completa de la plataforma

> Estado verificado directamente en el código y el historial de git (no solo memoria) a la fecha de este documento. AfroMercado nació como un marketplace para comerciantes afrocolombianos del Chocó y evolucionó a una **plataforma regional integral multi-módulo**, con alcance nacional (32 departamentos), que combina e-commerce, servicios turísticos/de movilidad, cultura, empleo, y una capa institucional (B2G).

---

## 1. Qué es AfroMercado

Un marketplace y plataforma de servicios que conecta comerciantes, prestadores de servicios (hoteles, tours, transporte, restaurantes), organizadores culturales, empleadores/buscadores de empleo, y — desde la capa institucional — organizaciones, fundaciones y entes de gobierno, con compradores y usuarios en todo el país, con un enfoque especial en comunidades afrocolombianas, indígenas y campesinas del Chocó.

**Por qué existe:** promover y preservar la cultura afrocolombiana facilitando comercio digital para comunidades que históricamente no tienen acceso a plataformas grandes, respetando el contexto real del territorio: baja bancarización, conectividad limitada, y trámites que hoy dependen de WhatsApp y relaciones personales.

---

## 2. Arquitectura técnica

| Capa | Tecnología |
|---|---|
| Backend | Node.js + Express 4, arquitectura en capas: `routes → controllers → services → repositories → Prisma` |
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript, mobile-first |
| Base de datos | PostgreSQL vía Prisma ORM (Neon serverless en producción) |
| Autenticación | JWT (`Authorization: Bearer`), token en `localStorage` |
| Pagos | Wompi (pasarela colombiana) — checkout + webhook + dispersión a terceros |
| Almacenamiento de archivos | Cloudinary (con *fallback* automático a disco local si no está configurado) |
| Notificaciones en tiempo real | Server-Sent Events (SSE) propio, sin Socket.io |
| Notificaciones push | Web Push (VAPID) |
| Estilos | Tailwind CSS 4, tipografía DM Serif para encabezados |
| Colores de marca | `#1B4332` (verde oscuro), `#2D6A4F` (verde medio), `#F7F5F2`/`#F8F5F0` (crema), `#D4A017` (dorado) |
| Monitoreo de errores | Sentry, activo en backend con DSN condicional |
| PWA | Service worker con modo offline real (caché de páginas visitadas + página de respaldo) |

**Despliegue:**
- **Base de datos:** Neon (PostgreSQL serverless, se pausa tras inactividad).
- **Backend:** Render — las migraciones de esquema se aplican automáticamente al arrancar (`aplicarMigraciones()` en `server.js`), porque el *connection pooler* de Neon bloquea `prisma migrate deploy` en producción.
- **Frontend:** Vercel, auto-deploy en push a `main`.

---

## 3. Roles de usuario

| Rol | Puede hacer |
|---|---|
| `COMPRADOR` | Comprar productos, reservar servicios, postularse a empleos, dejar reseñas, favoritos |
| `COMERCIANTE` | Todo lo del comprador **más** vender productos y/o operar uno o más módulos de servicio (Express, Hoteles, Tours, Transporte, Cultura) desde su propio Comercio |
| `REPARTIDOR` | Panel propio de entregas, tracking GPS en vivo, liquidaciones |
| `ADMIN` | Panel de administración completo: moderación, verificación de comercios, pagos, disputas, facturación, PQRSD, empleo, publicidad, reportes |

Un mismo usuario puede pasar de comprador a comerciante sin crear una cuenta nueva (conversión de rol in-place). El rol `ADMIN` es excluyente de los demás.

**Publicar una oferta de empleo o postularse no requiere ser COMERCIANTE** — cualquier usuario autenticado puede hacerlo, con o sin comercio asociado (ver sección Empleo).

---

## 4. Marketplace general (productos físicos)

- Catálogo de productos por comerciante, con categorías, múltiples fotos, video corto opcional, alcance de venta (`LOCAL` / `NACIONAL` / `AMBOS`).
- **Carrito multi-vendedor:** un comprador puede agregar productos de varios comercios distintos; al pagar, el `Pedido` se divide automáticamente en un `SubPedido` por comerciante, cada uno gestionado de forma independiente por su dueño.
- **Reserva de stock atómica:** al agregar al carrito se reserva stock con un `UPDATE` condicional (`WHERE stock - stockReservado >= cantidad`) — verificado a prueba de condiciones de carrera, no se puede sobrevender.
- **Comisión de plataforma:** 10% configurable (`utils/comision.js`), se calcula sobre el subtotal; el comerciante recibe el neto.
- **Envíos:** cálculo real por departamento + peso (`utils/envio.js`), con tarifas por tramos de peso, tarifa "Nacional" de respaldo si el departamento no tiene tarifa propia, y extrapolación lineal si el peso excede el tramo más alto. El mismo cálculo se usa en la cotización previa y en el cobro real del checkout (nunca hay descuadre entre lo que se muestra y lo que se cobra). Panel admin en `/admin/envios` para gestionar tarifas.
- **Búsqueda avanzada:** texto (con soporte de acentos vía `unaccent`), filtros de categoría, precio mínimo/máximo, calificación mínima, autocompletado, y búsqueda geolocalizada por radio (Haversine) usando la ubicación del comercio.
- **Favoritos, reseñas y calificaciones** de productos.
- **Stock bajo:** alerta al comerciante cuando el stock cruza el umbral configurado (`stockMinimo`), sin repetir el aviso hasta que se repone.
- **IVA configurable por comercio** — apagado por defecto; el admin lo activa por comercio (`ConfigFiscalComercio`), y el checkout suma el IVA al total cuando corresponde.
- **Facturación electrónica DIAN:** arquitectura de proveedor intercambiable ya construida (mismo patrón que Wompi); hoy corre en modo "sin proveedor" (no-op) porque falta contratar un proveedor certificado real (Factus/Alegra/Siigo). Se dispara automáticamente al confirmar el pago en los 6 módulos transaccionales.
- **Recibo PDF** descargable por pedido (independiente de la factura DIAN).
- **Programa de fidelización:** puntos por cada $1.000 COP gastado, redimibles como cupón de descuento; sistema de referidos con bono cuando el referido confirma su primera compra.
- **Cupones:** propios por comercio, más el sistema de **alianzas comerciales** (ver sección 12).

---

## 5. Módulos de servicios especializados

Cada uno sigue el mismo patrón: `ConfigX` (configuración del comerciante) → catálogo propio → reserva/pedido → pago → confirmación → seguimiento.

### 5.1 Express (Sabores) — pedidos de comida
- Menú de restaurante con complementos/adiciones (biblioteca reutilizable de `GrupoComplemento`/`ItemComplemento`).
- Bloqueo real de horario de atención (rechaza pedidos fuera de horario, tanto en frontend como backend).
- Favoritos, reordenar pedido anterior con un clic, pedido programado para más tarde.
- Checkout con selección de complementos.

### 5.2 Hoteles
- Tipos de habitación con fotos, precios por noche, modalidad por horas.
- Calendario visual de disponibilidad.
- **Reserva de varias habitaciones en una sola transacción** (`grupoReservaId`).
- Bloqueo de sobreventa con lock de fila (`FOR UPDATE`) — verificado seguro ante reservas concurrentes del mismo tipo de habitación.
- Check-in digital, cupones propios (`CuponHotel`), reseñas.
- **Turismo Comunitario Certificado:** RNT (Registro Nacional de Turismo) y su verificación, con insignia combinada (RNT + certificación étnica/territorial).

### 5.3 Tours
- Lugares e itinerario con media (`TourLugarMedia`).
- Validación de cupo con transacción atómica (bug de condición de carrera real, corregido).
- Recordatorio previo a la fecha del tour.
- RNT también extendido aquí (mismo tratamiento que Hoteles).
- Reseñas.

### 5.4 Transporte
- Rutas y vehículos propios del comerciante.
- Cupones propios (`CuponTransporte`).
- Reseñas.

### 5.5 Cultura — "el alma de la marca"
- Agenda cultural de eventos por departamento/municipio (ancla histórica: fiestas patrimoniales como San Pacho en Quibdó).
- Un evento **sin entradas** es puramente informativo; **con entradas** (`EntradaCultural`) se vuelve transaccional, con boletería, cupo y reserva atómica anti-sobreventa (mismo patrón de comisión 10% que el resto).
- Estados de evento incluyendo `POSPUESTO`, con notificación automática (in-app + WhatsApp) a los compradores con reserva activa si el organizador pospone o cancela.
- Reseñas de eventos (exige reserva usada).
- Panel de gestión para el organizador/comerciante.
- Vitrina de descubrimiento de alianzas comerciales (ver sección 12).

### 5.6 Empleo — bolsa de trabajo comunitaria
El módulo más reciente y más completo funcionalmente:
- **Cualquier usuario autenticado puede publicar una vacante**, no solo comerciantes; asociar un comercio es opcional.
- Oferta con departamento/municipio (selector en cascada, no texto libre), categoría (lista curada + filtro), tipo de contrato, rango salarial o negociable, número de vacantes, fecha límite de postulación, contacto de WhatsApp real (botón `wa.me` funcional).
- **Moderación ligera por admin** antes de que la oferta sea pública (protección específica contra ofertas fraudulentas/de explotación laboral en comunidades vulnerables).
- **Preguntas de selección personalizadas** (texto libre, Sí/No, u opción múltiple) que el candidato debe responder para postularse.
- **Hoja de vida estructurada:** resumen, experiencia, educación, habilidades, disponibilidad, foto (reutiliza el avatar de la cuenta) y CV adjunto en PDF (subido a Cloudinary o disco local).
- **Postulación con snapshot completo:** cada postulación congela una copia de la hoja de vida, foto, CV y respuestas al momento de aplicar — el candidato no puede alterar retroactivamente lo que el empleador ya vio.
- El empleador ve, por cada candidato: foto, habilidades, respuestas a sus preguntas, CV descargable, y puede desplegar la hoja de vida completa (experiencia/educación/resumen/disponibilidad).
- Estados de postulación: Enviada → Vista → Preseleccionado/Rechazada/Contratado; el candidato puede **retirar** su postulación y volver a postularse después.
- **Cierre automático** de la oferta cuando se cubren todas las vacantes (se cuentan los "Contratado").
- Favoritos, botón de compartir (WhatsApp + copiar enlace), "otras ofertas del mismo publicador", y metadata `JobPosting` (datos estructurados schema.org) para que Google indexe las vacantes como empleos reales.

---

## 6. Confianza y soporte

- **Sistema de disputas/reclamos** post-compra: ventana de horas para reportar, resolución con reembolso proporcional, `updateMany` con verificación de concurrencia para evitar doble resolución.
- **PQRSD** (Peticiones, Quejas, Reclamos, Sugerencias, Denuncias): formulario público en `/contacto` (funciona sin sesión iniciada), panel admin de gestión y respuesta.
- **Calificación del repartidor** por el comprador tras la entrega.
- **Tracking en vivo del repartidor** vía geolocalización del navegador + el mismo canal SSE de notificaciones (sin infraestructura nueva de streaming).
- Páginas legales: Términos de uso, Política de Privacidad (Ley 1581 de Habeas Data), Política de Cookies (honesta: solo `localStorage`, no cookies reales de terceros).

---

## 7. Regionalización nacional

Lo que empezó como una plataforma solo del Chocó ahora cubre los 32 departamentos de Colombia:

- **Geografía unificada:** una sola fuente de departamentos + municipios (`lib/data/colombia.ts`), usada en registro de comercio, perfil, direcciones, empleo, etc. — con opción "Otro…" para municipios fuera de la lista curada.
- **Detección de región por GPS:** al entrar un invitado o una cuenta sin departamento guardado, se calcula el departamento más cercano por coordenadas (nearest-neighbor Haversine sobre un dataset propio de capitales departamentales, sin depender de una API de geocoding paga). **Nunca se aplica en silencio** — se muestra un banner no intrusivo pidiendo confirmación explícita.
- Los repartidores siguen atados al Chocó a propósito (su modelo de cobertura es local, no tiene concepto de departamento).
- **Certificación en dos niveles:** el sello base de "Productor Certificado" es la aprobación KYC ordinaria (nacional, sin filtro de origen); un segundo sello opcional (`verificadoEtnico`) preserva la identidad afro/indígena/raizal/campesina sin usarla como barrera de entrada.
- Ajustes de diseño responsive: tablas de admin con vista de tarjetas en móvil, carruseles con affordance de scroll, mapas con alturas fluidas, navegación de tablet solo-íconos.

---

## 8. Publicidad (principal fuente de ingreso del dueño)

- 5 paquetes de campaña ya existentes, cobrados vía Wompi.
- **Alcance geográfico real con multiplicador de precio:** municipio (1×), departamento (~2.3×), nacional (~4.5×) — el monto se recalcula siempre en el servidor (se corrigió una vulnerabilidad donde el monto podía manipularse desde el cliente).
- Formatos: banners existentes + 2 nuevos (`BANNER_CARRUSEL`, `IRRUPTOR_BIENVENIDA`), con reglas de frecuencia para no saturar al usuario (ej. interstitial máximo 1 vez cada 48h, nunca en la primera visita).

---

## 9. Alianzas comerciales (`AlianzaComercial`)

Sistema nuevo y aditivo (no reemplaza los cupones propios de cada módulo): varios comercios de **módulos distintos** comparten un mismo código de descuento, cada uno definiendo su propio porcentaje/valor.

- Solo comercios verificados pueden iniciar o unirse a una alianza; el admin aprueba su publicación.
- El cupón propio de un comercio siempre tiene prioridad sobre el de alianza en el checkout.
- Panel de gestión en `/comerciante/alianzas` (crear, invitar, aceptar, retirarse).
- Descubrimiento: página pública `/alianzas/[codigo]`, sección "Aliados para tu visita" en Cultura, insignia cruzada en el perfil del comercio.
- Sin cobro adicional de la plataforma — se monetiza indirectamente vía publicidad de la alianza.

---

## 10. Módulos institucionales (capa B2G) — Fase 7

La evolución de "marketplace comercial" a "plataforma regional integral" que también sirve a organizaciones, fundaciones y gobierno:

1. **Turismo Comunitario Certificado** — RNT replicado a Hotel y Tour con insignia combinada.
2. **Datos Abiertos** — endpoint público con agregados por región, umbral de anonimización (nunca se expone un dato si hay menos de 5 registros agregados), solo snapshots mensuales — nunca comisión ni consultas de rango libre.
3. **Censo de Productores** — declaración de organización territorial como dato sensible bajo Ley 1581: formulario separado, checkboxes sin premarcar, aprobación admin real, revocación sin fricción. Declarar el censo **nunca** pausa el comercio (no se trata como señal de riesgo de fraude).
4. **Directorio de Compras Públicas** — opt-in de autoservicio + directorio público, alcance reducido a propósito: no hay dinero ni checkout dentro de AfroMercado, la venta real ocurre vía SECOP II fuera de la plataforma.
5. **Programas y Subsidios** — reutiliza el motor de cupones asignados ya existente (`Cupon.distribucion = ASIGNADO` + `CuponAsignacion`), con asignación masiva por filtro de región/organización territorial, y trazabilidad por nombre de programa en el panel admin.

---

## 11. Panel de administración

23 páginas funcionales (sin cascarones vacíos): resumen general, categorías, usuarios, comercios, comerciantes, repartidores, liquidaciones, reclamos/disputas, facturas, PQRSD, empleo (moderación), entregas, envíos, reportes, pasarela de pagos, cupones, AfroMedia, visibilidad, campañas, hero, reportes, productos, calificaciones, hoteles, tours, transporte, configuración general.

**Analítica contable con rango de fechas** (desde/hasta) disponible en Express, Hotel, Tour, Transporte y Productos — para que el comerciante consulte ventas/reservas de un período puntual, no solo ventanas fijas de hoy/semana/mes. Hotel además tiene un ranking de "habitaciones más reservadas".

---

## 12. Notificaciones

- **In-app + tiempo real** vía SSE (`GET /api/notificaciones/stream`), un solo canal reutilizado para: pedidos, disputas, PQRSD, empleo, tracking de repartidor, cambios de evento cultural.
- **Push** (Web Push/VAPID) para cuando la pestaña está cerrada.
- **Email** (SMTP) y **WhatsApp** (mensajes pre-armados con `wa.me`, no API oficial de WhatsApp Business) para los momentos clave.
- **PWA con modo offline real:** service worker que cachea páginas visitadas y muestra una página de respaldo con indicador visual cuando no hay conexión.

---

## 13. Lo que falta o es una decisión pendiente del dueño (no un hueco técnico)

- **Cobertura de tests desigual:** de 34 servicios de backend, solo 9 tienen pruebas automatizadas (los que mueven dinero fueron priorizados: pago-digital, hotel, tour, transporte, disputa, cultura, comisión, producto, pago-repartidor). `auth`, `pedido`, `facturacion`, `empleo`, `express` no tienen tests todavía. El frontend no tiene tests.
- **Express y Cultura** no tienen todavía metadata `generateMetadata`/JSON-LD para compartir en redes (Tours, Hoteles, Transportes, Producto y Empleo sí la tienen).
- **Facturación DIAN** lista en código, pero sin proveedor certificado contratado — requiere decisión y presupuesto del dueño, no desarrollo.
- **Activación operativa de Wompi en producción** (cuenta aprobada, llaves productivas, webhook registrado) — el código ya está completo.
- Documentos legales formales independientes (política de tratamiento de datos como documento separado del de privacidad, libro de reclamaciones) — hoy cubiertos funcionalmente por Privacidad + PQRSD, pero no como piezas legales separadas.

**Nada de lo anterior es código a medias o abandonado** — es priorización pendiente, decisiones de negocio, o vacíos de prueba conocidos y aceptados conscientemente durante el desarrollo.

---

## 14. Estado del repositorio al momento de este documento

- Rama actual: `main` (la antigua rama `feat/fase-0-multiregion-blindaje` ya fue fusionada).
- 184 commits en total.
- **131 archivos con cambios sin commitear** en el árbol de trabajo actual: todo el trabajo de esta sesión (Disputas, IVA, Facturación DIAN, Recibo PDF, Cookies, PQRSD, Favoritos faltantes, tracking de repartidor + calificación, stock bajo, búsqueda avanzada, fidelización, PWA offline, y el módulo de Empleo completo). Nada de esto se ha commiteado ni desplegado todavía — pendiente de tu decisión explícita.
