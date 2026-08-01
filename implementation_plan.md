# Auditoría y Levantamiento Arquitectónico: Proyecto Teravia

> **Objetivo:** Levantamiento desde cero (lectura directa del esquema de base de datos y estructura de carpetas frontend) para validar el estado de la plataforma, página por página y módulo por módulo, antes de salir a producción, alineándolo con la visión de *Teravia: Territorios que florecen*.

---

## 1. Arquitectura Base Implementada (Desde Cero)

El sistema opera bajo un monorepo distribuido:
* **Base de Datos:** PostgreSQL con Prisma ORM (Esquema gigante de +3100 líneas).
* **Backend:** Node.js / Express con +40 sub-rutas montadas.
* **Frontend:** Next.js 16 (App Router) con +47 directorios principales en `app/`.

### Modelo de Datos Principal (Core)
El sistema está altamente unificado alrededor de dos entidades centrales: `Usuario` (Roles: COMPRADOR, COMERCIANTE, REPARTIDOR, ADMIN) y `Comercio`.
En lugar de tener bases de datos separadas, un `Comercio` puede activar diferentes "verticales" a través de configuraciones uno-a-uno (`ConfigExpress`, `ConfigHotel`, `ConfigTour`, `ConfigTransporte`). Esto es excelente a nivel arquitectónico porque evita redundancias.

---

## 2. Análisis por Verticales (Página por Página y Módulo por Módulo)

### 2.1 E-Commerce y Marketplace (El Ecosistema Base)
* **Backend:** `producto.routes`, `carrito.routes`, `pedido.routes`, `pago.routes`, `envio.routes`.
* **Frontend:** `/producto`, `/carrito`, `/checkout`, `/mis-pedidos`, `/buscar`.
* **Estado Actual:** 🟢 Completo. Flujos de inventario, stock, métodos de pago (pasarelas, Nequi, Daviplata) y estados de pedido están bien modelados.
* **Oportunidades / Qué falta:** 
  * En la UI de búsqueda, falta resaltar **quién es el productor**. Teravia debe mostrar la cara del campesino/artesano, no solo el producto.
  * El módulo de **Inventario y Gastos Operativos** (`CompraInventario`, `MovimientoCaja`) está en la base de datos, pero hay que validar si el comerciante tiene vistas fáciles y amigables en su panel para esto (suele ser complejo para usuarios no técnicos).

### 2.2 Servicios Especializados (Hoteles, Tours, Transporte, Express)
* **Backend:** Rutas y configuraciones dedicadas para cada uno.
* **Frontend:** `/hoteles`, `/tours`, `/transportes`, `/express`, y sus vistas de `/mis-reservas`.
* **Estado Actual:** 🟢 Operativo. Tienen reservas, calendarios, cupos de vehículos y gestión de habitaciones.
* **Oportunidades / Qué falta:** 
  * Las páginas actúan como "silos" (si entro a hoteles, solo veo hoteles). 
  * **Mejora Urgente UX:** Navegación Relacional. Si reservo un hotel, en el *checkout success* debería sugerirme un "Tour" cercano o "Comida Express" de la zona.

### 2.3 Módulos de Impacto Social y Territorial
* **Módulos:** Empleo (`/empleo`), Bienes Raíces (`/bienes-raices`), Cultura/Vitrina (`/cultura`, `/vitrina`), Agro (`/agro`).
* **Estado Actual:** 🟡 Parcialmente desconectados.
* **Oportunidades / Qué falta:**
  * La **Cultura (Vitrina tipo Reels)** es brutal para el engagement, pero debe estar atada al territorio.
  * **Agro:** Actualmente parece un listado. Debe conectar directamente con el módulo de *Compras de Inventario* de los restaurantes (B2B local).

### 2.4 Operatividad, Finanzas y Soporte (Backend Oculto)
* **Backend:** Disputas, PQRSD, Liquidaciones, Facturación Electrónica, Fidelización, Reportes.
* **Estado Actual:** 🟢 Base de datos muy robusta. Se cubrieron casos de borde (reintentos de dispersión, estados de liquidación).
* **Oportunidades / Qué falta:**
  * **Liquidaciones:** Asegurar que el Cron Job (tareas automáticas) para pagarle a los comerciantes funcione sin errores en producción.

---

## 3. Paneles de Administración (Comerciante y Admin)

### Panel del Comerciante (`/comerciante/*`)
* **Páginas:** `/dashboard`, `/analytics`, configuración de cada vertical.
* **Validación:** El modelo de datos permite que un comerciante venda productos físicos y al mismo tiempo tenga un hotel. El panel debe poder manejar esta "doble vida" sin confundir al usuario.
* **Mejora:** El dashboard inicial no debe ser solo de "Ventas", debe mostrar "Impacto Territorial" (ej. "Tus productos llegaron a 3 municipios esta semana").

### Panel del Administrador (`/admin/*`)
* **Páginas:** `/campanas`, `/hero`, `/visibilidad`, usuarios, etc.
* **Validación:** Tiene el control de la publicidad y banners. 
* **Qué falta:** Falta un módulo de **"Salud del Ecosistema"** donde el Admin pueda ver si hay disputas atascadas, PQRSD sin responder o comerciantes pendientes de aprobación (`PENDIENTE_REVISION`).

---

## 4. LO QUE FALTA (Para cumplir la Visión Teravia)

Basado en la lectura de la arquitectura actual, el sistema es un e-commerce espectacular, pero **para ser "Teravia" (Territorios que Florecen) faltan los siguientes pilares clave:**

1. ❌ **No existe el "Perfil de Territorio" (Landing de Municipios):** 
   - Falta una ruta frontend como `/territorio/[municipio]` o `/explorar/[municipio]` que consolide hoteles, cultura, tours y productos de un solo lugar.
2. ❌ **No existe el "Centro de Ideas" ni el "Roadmap Público":** 
   - No hay tablas en Prisma para `Idea`, `VotoIdea`, ni `RoadmapItem`. Esto hay que construirlo desde cero (Base de datos, Backend y Frontend).
3. ❌ **No existe el Ecosistema de Agentes IA (CPO, Agrupador):**
   - Aunque la base de datos es robusta, no hay infraestructura actual implementada en el código para que agentes autónomos analicen tendencias o moderen ideas en segundo plano.

---

## 5. Veredicto y Siguientes Pasos para Producción

**El código actual (E-commerce + Servicios) es lo suficientemente sólido y seguro para salir a producción YA MISMO como Fase 1.** 

No recomiendo detener el lanzamiento para construir el "Centro de Ideas" o los "Perfiles de Territorio". Mi recomendación estratégica es:

1. **Lanzar a producción lo que hay** (bajo la nueva marca visual Teravia).
2. **Estabilizar operaciones:** Validar que los pagos (Wompi/Epayco), los correos y las reservas reales no fallen con usuarios reales.
3. **Iteración 2 (El alma de Teravia):** Mientras la gente compra y reserva, nosotros en paralelo creamos el modelo de datos para el *Centro de Ideas*, los *Perfiles Municipales* y conectamos a los *Agentes IA*.

> [!IMPORTANT]
> **Pregunta Estratégica:**
> Con este levantamiento desde cero, ¿Estás de acuerdo con lanzar la plataforma actual a producción para empezar a generar tracción, y en paralelo nosotros empezamos a programar el "Centro de Ideas" y los "Perfiles de Territorio"? ¿O prefieres que no salgamos a producción hasta que esas vistas comunitarias estén creadas?
