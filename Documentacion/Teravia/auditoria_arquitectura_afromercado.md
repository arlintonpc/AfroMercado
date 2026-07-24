# Auditoría de Arquitectura, Diseño y Lógica de AfroMercado

Este documento presenta un análisis exhaustivo del ecosistema de **AfroMercado**. El objetivo es evaluar el nivel de madurez técnica del proyecto frente a los estándares de "grandes plataformas" (ej. MercadoLibre, UberEats, Airbnb) y establecer una hoja de ruta para simplificar, optimizar y automatizar su escalabilidad.

---

## 1. Visión General del Ecosistema (Verticales)

AfroMercado ha dejado de ser un simple e-commerce para convertirse en una **SuperApp** (Plataforma Multiservicios). La base de datos (Prisma con 93 modelos) soporta múltiples verticales altamente heterogéneas:

1. **Vitrina / Tienda (Marketplace Core):** Productos físicos, carrito global, subpedidos (multivendor), liquidaciones y disputas.
2. **Sabores / Gastronomía (Express):** Entregas bajo demanda (Delivery), menús con complementos (`GrupoComplemento`), manejo de estado de restaurante (abierto/cerrado) y control en tiempo real.
3. **Hotelería:** Configuración de hoteles, tipos de habitaciones, inventario físico de habitaciones y sistema de reservas.
4. **Turismo / Tours:** Gestión de itinerarios, lugares (`TourLugar`) y reservas para experiencias guiadas.
5. **Transporte:** Rutas de transporte, horarios y venta de tickets (`ReservaTransporte`).
6. **Cultura:** Red social interna (`PublicacionCultural`, `EventoCultural`, `Likes`, `Comentarios`) y venta de entradas.
7. **Empleo:** Publicación de vacantes (`OfertaEmpleo`) y gestión de postulaciones y hojas de vida.
8. **Bienes Raíces:** Publicación de inmuebles (venta/arriendo).
9. **Del Campo (Agro) & Temporada:** Filtros especializados sobre el motor de Marketplace Core para dinamizar la economía rural.

> [!TIP]
> **Veredicto de Producto:** El alcance funcional está al **más alto nivel**, comparable a plataformas como Rappi o WeChat. El reto de un alcance tan amplio es mantener el rendimiento técnico y la homogeneidad en el diseño en cada una de estas secciones.

---

## 2. Arquitectura de Software

### Estado Actual: Monolito Modular Separado
Actualmente, el sistema está dividido en dos grandes bloques:
- **Frontend:** Next.js App Router (`afromercado-web`), consumiendo la API por REST (`fetch`).
- **Backend:** Node.js Express (`afromercado/src`), estructurado en capas (rutas → controladores → servicios) interactuando con PostgreSQL vía Prisma ORM.

### Análisis contra Grandes Plataformas
Las grandes plataformas (Amazon, MercadoLibre) operan bajo **Microservicios** o **Arquitecturas Orientadas a Eventos (EDA)**.
- **Ventaja del modelo actual de AfroMercado:** Altísima velocidad de desarrollo. Al tener todos los dominios (Hoteles, Express, Tienda) en un solo repositorio y una sola base de datos (93 tablas), es fácil relacionar un "Usuario" con una "Reserva de Hotel" y un "Pedido de Comida".
- **Desventaja (Cuello de botella futuro):** Si la vertical de *Gastronomía* tiene un pico masivo de peticiones a la hora del almuerzo, saturará la base de datos y podría tumbar el servicio de *Bienes Raíces*.

> [!WARNING]
> **Oportunidad de Mejora Arquitectónica:** No es necesario migrar a microservicios inmediatamente, pero el backend debe transicionar hacia una **arquitectura basada en eventos (Event-Driven)**. Por ejemplo, al confirmar un pedido, en lugar de que el controlador envíe correos sincrónicamente y notifique al restaurante, se debería emitir un evento (`PEDIDO_CREADO`) a una cola (como RabbitMQ o AWS SQS) para que procesos en segundo plano se encarguen, aliviando la carga del hilo principal de Node.js.

---

## 3. Arquitectura Frontend y Diseño UX/UI

### Lógica de Estado y Consumo de APIs
- **Actual:** Se utilizan Contextos Globales de React (`AuthContext`, `CarritoContext`) y llamadas `fetch` encapsuladas en utilidades (`lib/api/client.ts`). Las páginas usan intensivamente `useState` y `useEffect` (ej. menú express).
- **Estándar de Grandes Plataformas:** Utilizan herramientas de "Server State Management" con caché agresiva y validación automática, como **React Query (TanStack Query)** o **SWR**.
  
> [!TIP]
> **Mejora:** Introducir TanStack Query en el frontend eliminaría docenas de `useEffect` manuales y proveería *caching*, reintentos automáticos y actualizaciones optimistas al instante, reduciendo el código boilerplate y brindando una sensación de inmediatez al usuario.

### Diseño y Estética (UI)
- Recientemente elevamos el diseño de la vertical **Express** a un nivel *premium*, introduciendo:
  - Efectos *Parallax* dependientes del scroll.
  - Navegación *Sticky* con cristal ahumado (Backdrop Blur).
  - *Skeleton Loaders* de alta fidelidad que simulan la topología de la página para evitar Cumulative Layout Shifts (CLS).
  - *Empty States* ilustrativos.
- Sin embargo, las verticales más antiguas podrían seguir usando patrones visuales más genéricos o genéricos de frameworks básicos.

> [!IMPORTANT]
> **Auditoría de Diseño:** Para igualar a una gran plataforma, **todo el sistema debe hablar el mismo lenguaje de diseño (Design System)**. Se recomienda consolidar los componentes en un sistema centralizado (ej. botones `primary`, `ghost`, modales, tarjetas) con animaciones unificadas en todas las verticales, garantizando consistencia.

---

## 4. Gestión de Base de Datos y Lógica de Negocio

La estructura de Prisma de AfroMercado es excepcional por su exhaustividad. Abarca logística (`TarifaEnvio`, `SolicitudRepartidor`), facturación electrónica (`FacturaElectronica`) y moderación automática (`DenunciaProducto`, `AccionModeracion`).

**Aspectos a mejorar frente a escalas masivas:**
1. **Manejo de Transacciones Financieras:** Actualmente, los precios y billeteras se manejan con `Decimal` que llega a JS como *String*. En plataformas fintech/grandes e-commerce, se utiliza el **Patrón Monetario (Money Pattern)**: Guardar absolutamente todo el dinero en centavos (Enteros `Int`) en la base de datos para evitar errores de precisión por redondeos de coma flotante en JavaScript, y solo formatear a decimales en la capa de vista del Frontend.
2. **Consultas Pesadas (N+1 Queries):** En módulos como Hoteles o Express, cargar un comercio con sus productos, y cada producto con sus complementos, puede desencadenar cuellos de botella en PostgreSQL.
   - **Solución Automática:** Implementar Redis en el backend. Las configuraciones de menús o información estática de los hoteles debe guardarse en caché para responder en `< 50ms`.

---

## 5. Resumen de Hoja de Ruta para Nivelar y Automatizar

Si deseamos simplificar y asegurar que la plataforma pueda soportar millones de usuarios con calidad mundial, aquí están los pasos a seguir:

### Corto Plazo (Simplificación de Código)
- [ ] **Estandarización de Consumo API:** Migrar del uso de `useEffect` manual a **TanStack Query** (React Query) en las interfaces más pesadas (Express, Hoteles, Dashboard Administrador).
- [ ] **Refinamiento UI Global:** Exportar el nivel de detalle implementado en *Express* (skeletons, glassmorphism, sticky headers) hacia *Tours*, *Hoteles* y la *Tienda General*.

### Mediano Plazo (Automatización y Rendimiento)
- [ ] **Caché en Backend (Redis):** Interceptar las peticiones de catálogo público (restaurantes abiertos, inventario del agro) y servirlas desde RAM (Redis) para reducir el consumo de recursos en la base de datos en más de un 80%.
- [ ] **Conversión a Centavos (Money Pattern):** Refactorizar el tratamiento de las comisiones, cupones y carritos en el Backend para procesar la lógica de negocio puramente en números enteros, garantizando exactitud contable (crítico para facturación electrónica y liquidaciones a comerciantes).

### Largo Plazo (Escalabilidad de Gran Plataforma)
- [ ] **Desacoplamiento Asíncrono (Colas de Mensajes):** Transicionar los flujos pesados (asignación de repartidor, liquidación nocturna, cálculos de comisiones globales) a colas de tareas asíncronas (`BullMQ` o SQS).
- [ ] **Monitoreo APM:** Integrar Datadog, New Relic o Sentry para rastrear las caídas (bottlenecks) exactas dentro de consultas lentas de Prisma en producción.

---

**Conclusión:**
La base lógica de AfroMercado **ya soporta modelos de negocio a la altura de las mayores plataformas globales.** Su punto más fuerte es la consolidación hiper-integrada de servicios en una misma cuenta de usuario. La brecha para alcanzar a un gigante como "Amazon/Uber" ya no recae en construir más funcionalidades (el ecosistema ya es masivo), sino en **pulir la excelencia técnica:** Caché agresivo (tiempo de respuesta <100ms), Design System absoluto en el frontend y procesos de pago asíncronos a prueba de fallos.
