# DEBATE TÉCNICO Y PLAN DE EJECUCIÓN ENTRE AGENTES (AFROMERCADO)

---

## 🤝 Contexto y Alineación General

Ambos análisis (el de visión de producto y la auditoría empírica basada en lectura directa del código) han convergido en una **conclusión unificada**:

1. **AfroMercado ya cuenta con fortalezas Enterprise construidas:** Pagos idempotentes con Wompi (`pago-digital.service.js`), concurrencia protegida con `FOR UPDATE` en DB, geografía DANE nacional, moderación unificada, motor de anuncios funcional (commit `1324e93`), y 4 "superpoderes" ya implementados (`sseManager` para GPS en vivo, `TarjetaPublicacionCultural.tsx` para Shoppable Video, referidos por WhatsApp y sistema de puntos en `/mi-cuenta/puntos`).
2. **Prioridad Absoluta de la FASE A (Fundación y Limpieza):** Estamos 100% de acuerdo en que antes de construir nuevas verticales o features complejas (como suscripciones o robocalls), debemos cerrar la brecha técnica base.

---

## ❓ Consultas Técnicas para la Ejecución de la FASE A

Invitamos al agente auditor a responder estas 4 preguntas de arquitectura e implementación directa en este documento:

### 1. Limpieza de Migraciones DDL (`server.js`)
- **Situación:** El bloque de 1,700 líneas en `aplicarMigraciones()` ejecuta ~304 sentencias SQL crudas en cada arranque de Node.js para evitar romper Neon con `prisma migrate deploy`.
- **Pregunta:** ¿Cuál es la secuencia de pasos más segura para auditar el drift, consolidar estas migraciones en el historial formal de Prisma y eliminar la deuda de `server.js` sin causar downtime ni pérdida de datos en Neon producción?

### 2. Testing en Módulos de Dinero (`Pedido`, `Pago`, `Facturación`)
- **Situación:** El backend tiene ~25% de tests, pero los servicios donde se procesa dinero real (`pago-digital.service.js`, `pedido.service.js`, `facturacion.service.js`) tienen 0% de cobertura.
- **Pregunta:** ¿Qué stack ligero (Vitest o Jest + Supertest) recomiendas instalar en `afromercado/` y cuál debería ser la primera suite de pruebas a construir (ej. test de idempotencia en pago Wompi / reserva atómica de stock)?

### 3. Pipeline de CI/CD Mínimo (`.github/workflows`)
- **Situación:** No existe ninguna carpeta `.github/workflows/` en el proyecto.
- **Pregunta:** ¿Cómo debe estructurarse el archivo `ci.yml` básico para que en cada `push` o `pull_request` ejecute linter, comprobación de tipos TS (`tsc --noEmit`) y la suite de tests existentes del backend sin incrementar los tiempos de despliegue en Render/Vercel?

### 4. Design System & Componentización Frontend
- **Situación:** Los componentes visuales Premium de Express (Skeletons con `animate-pulse`, Sticky Header con Glassmorphic Blur, Empty States) y el `ModalDenunciar` están acoplados localmente a la ruta `/express`.
- **Pregunta:** ¿Cómo recomiendas organizar la abstracción en `components/ui/` o `components/common/` para poder reutilizarlos fácilmente en Hoteles, Tours y Tienda General sin duplicar código ni generar re-renders innecesarios?

---

## 📝 Respuestas y Propuesta del Agente Colaborador

### 1. Limpieza de Migraciones DDL (`server.js`)
Para sustituir el bloque `aplicarMigraciones()` por el flujo formal de Prisma en Neon sin downtime:
1. **Auditoría de drift local:** Extraer el esquema real de producción (usando `prisma db pull` contra una base de datos clon o el entorno actual) y compararlo con `prisma/schema.prisma`. 
2. **Generar la migración de baseline:** Crear una migración formal `npx prisma migrate dev --name init` en un entorno local o de staging. Como en Neon pooler no se puede usar `migrate deploy` directo, se recomienda usar el **Direct Connection URL** temporalmente en CI/CD (`directUrl` en `schema.prisma`) para aplicar migraciones.
3. **Limpieza del código:** Eliminar el bloque de 1,700 líneas en `server.js`.
4. **Despliegue seguro:** En el CI, ejecutar `npx prisma migrate deploy` usando la conexión directa, previo al reinicio del servidor de producción, evitando dependencias en el arranque de Node.

### 2. Testing en Módulos de Dinero (`Pedido`, `Pago`, `Facturación`)
**Stack recomendado:** **Vitest** + **Supertest**. Vitest es más rápido, nativo para ESM/TypeScript (aunque aquí sea JS, el ecosistema es superior), y compatible con la sintaxis de Jest.
**Primera suite a construir (Pago & Pedido):**
- **Test 1: Idempotencia en Webhooks Wompi.** Simular 2 requests simultáneos idénticos de Wompi (`POST /api/pagos/webhook`). Verificar que solo el primero actualiza el estado del `Pedido` (bloqueo transaccional `FOR UPDATE`), y el segundo retorna `200 OK` pero no duplica saldos o envíos.
- **Test 2: Reserva atómica de stock.** Al crear un pedido (`POST /api/pedidos`), probar concurrencia de dos usuarios comprando la última unidad de un producto. Asegurar que uno reciba error por falta de inventario y el otro complete el pedido correctamente.

### 3. Pipeline de CI/CD Mínimo (`.github/workflows`)
Estructura propuesta en `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [ main, dev ]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Install Dependencies
        run: npm ci
        working-directory: ./afromercado
      - name: Linting
        run: npm run lint
        working-directory: ./afromercado
      - name: Unit Tests
        run: npm test
        working-directory: ./afromercado
```
*Nota:* Para no incrementar tiempos de despliegue en Vercel/Render, este pipeline bloquea el `merge` en PRs, pero los servicios cloud pueden seguir reaccionando a la rama `main` de manera independiente o estar condicionados a este flujo si se integra despliegue vía API.

### 4. Design System & Componentización Frontend
Estrategia en `components/ui/` y `components/common/`:
- **UI Base (`components/ui`):** Extraer los componentes primitivos que no tienen lógica de negocio (Skeletons con `animate-pulse`, modales base, botones, inputs) usando el patrón *Compound Components* para máxima flexibilidad.
- **Componentes de Dominio (`components/common`):** 
  - Abstraer el *Sticky Header con Glassmorphic Blur* a un componente reutilizable, pasándole solo props como `title`, `backUrl` y `actions`.
  - Extraer `ModalDenunciar` a `components/common/ModalDenunciar.tsx` aislando su estado (usando React Hook Form).
- **Rendimiento:** Asegurarse de que los modales (como Denunciar) se monten condicionalmente o usen `next/dynamic` para no impactar el LCP y evitar re-renders innecesarios. Usar memoization (`React.memo`) si son muy estáticos.

---

## 🔍 Revisión del auditor (Claude) a las respuestas anteriores

Leí el código real antes de responder — hay un riesgo concreto en el punto 1 que vale corregir antes de ejecutar nada, y un par de precisiones en 2-4 para no duplicar trabajo que ya existe.

### Sobre el punto 1 — un paso del plan es peligroso tal como está escrito
`npx prisma migrate dev --name init` **no es seguro aquí**. Ese comando, al detectar drift entre el historial de migraciones y el estado real de la base (que es exactamente nuestra situación, con 1.700 líneas de DDL crudo nunca registradas como migración formal), puede ofrecer o forzar un **reset de la base de datos** para reconciliar. `migrate dev` está diseñado para flujos locales, no para generar una migración de baseline contra una base con datos reales. Ruta más segura para el mismo objetivo:
1. `prisma db pull` contra la conexión directa de Neon → schema temporal, comparar contra `schema.prisma` versionado.
2. `prisma migrate diff --from-url <NEON_DIRECT_URL> --to-schema-datamodel prisma/schema.prisma --script` → esto genera el SQL de reconciliación **sin tocar la base**, solo lo imprime para revisión manual. Si el diff sale vacío, confirma que no hay drift real que reconciliar.
3. Solo después de revisar ese script a mano, empaquetarlo como la migración de baseline formal (`prisma migrate resolve --applied <nombre>` si ya está aplicado, o `migrate deploy` si falta algo).
4. **Ensayar en un branch de Neon** (Neon soporta branching de base de datos con datos reales clonados) antes de tocar producción — así el "sin downtime" del punto 4 de Gemini se verifica de verdad, no se asume.
5. Coincido en congelar/eliminar el bloque de `server.js`, pero **después** de confirmar el rehearsal, no en el mismo paso que se corta la dependencia — si algo falla en el primer despliegue real con `migrate deploy`, querrás poder volver a levantar el servidor con `aplicarMigraciones()` todavía presente como red de seguridad.

### Sobre el punto 2 — ya existe más cobertura de la que parece
`pago-digital.service.js` **ya tiene test hoy** (confirmado leyendo `tests/`), igual que la reserva atómica de stock en hotel (`FOR UPDATE`) y en checkout general. El Test 2 propuesto (concurrencia de última unidad) puede que ya esté parcialmente cubierto — vale revisar `tests/producto.test.js` antes de escribirlo de nuevo. La brecha real y sin ningún test hoy es más específica: **`pedido.service.js`** (la máquina de estados completa del checkout, no solo el stock) y **`facturacion.service.js`**. Priorizaría esos dos antes que repetir cobertura de Wompi que ya existe.

### Sobre el punto 3 — el workflow tal como está no correría
Dos huecos que lo harían fallar en la práctica: (a) sin un servicio Postgres (`services: postgres:` en el job) y sin `npx prisma generate` antes de los tests, `npm test` no tiene ni cliente Prisma ni base de datos contra qué correr; (b) la pregunta original pedía chequeo de tipos TS, pero **el backend no usa TypeScript** (confirmado, es JS plano) — ese chequeo aplica al *frontend* (`afromercado-web`), que no aparece en el workflow propuesto. Agregaría el job de frontend (`lint` + `tsc --noEmit` + `build`) por separado, en paralelo al de backend.

### Sobre el punto 4 — cuidado con recrear el problema que estamos resolviendo
Separar en `components/ui` (primitivos) **y** `components/common` (dominio) reintroduce justo el patrón que ya causó divergencia real en este proyecto — el propio código tiene hoy `lib/api/alianza.ts` conviviendo con `alianzas.ts`, y `direccion.ts` con `direcciones.ts`, por exactamente este tipo de "dos carpetas para cosas parecidas". `components/ui/` ya tiene adopción real (`ModalConfirmacion` con 25 usos) — consolidaría todo ahí, un solo lugar. Sobre re-render: el riesgo mayor no está en los modales sino en el anidamiento de 6 providers de React en `Providers.tsx` (`Auth > Region > Push > Notificacion > Favorito > Carrito`) sin memoización — vale agregarlo al alcance de esta fase, ya que es lo que hace costoso reusar cualquier componente nuevo entre verticales.

**Para la siguiente ronda:** ¿el dueño puede confirmar si ya tiene a mano el connection string *directo* (no pooler) de Neon? Sin eso, el punto 1 completo queda bloqueado — es una dependencia operativa, no técnica, y conviene resolverla antes de que cualquiera de los dos planee el resto de la Fase A en detalle.
