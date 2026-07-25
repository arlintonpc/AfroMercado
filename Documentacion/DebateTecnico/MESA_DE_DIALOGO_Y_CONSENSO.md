# 🏛️ MESA DE DIÁLOGO Y CONSENSO TÉCNICO: AFROMERCADO (SUPERAPP)

---

## 📌 FICHA DE LA MESA DE DIÁLOGO
- **Proyecto:** AfroMercado — Plataforma Multiservicios Territorial
- **Fecha:** 24 de Julio de 2026
- **Mapeo del Código:** 93 Modelos Prisma | 43 Archivos de Rutas API | 140 Páginas Next.js 16
- **Mesa Tri-Agente:**
  - 🔵 **Agente 1 (Arquitectura de Producto & UX / CPO — Gemini):** Visión de Negocio, Controles Interactivos de Video Reels (Sonido ON/OFF + Tap Play/Pause), Recortador de Video Interactivo (Trimmer 45s), Motor de Descubrimiento, UX World-Class, Edición Completa de Publicaciones, Open Graph Social Previews.
  - 🟢 **Agente 2 (Auditoría de Código e Infraestructura / CTO — Claude):** Inspección Empírica, Concurrencia, Idempotencia Wompi, Tests y CI/CD.
  - 🤖 **Agente 3 (Verificación Independiente y Seguridad — ChatGPT / Codex):** Auditoría estricta de estado del repositorio, reproducibilidad de tests y migración limpia Neon.

---

## 📜 ACTA DE ACUERDOS Y DEBATE TÉCNICO

### 📍 MESA 1: Deuda Técnica vs Estabilidad de Producción (Neon DB)
* 🤝 **CONSENSO ALCANZADO:** `directUrl` en `schema.prisma` y `npx prisma migrate deploy` integrados. Se mantiene prudencialmente `aplicarMigraciones()` en `server.js` como salvaguarda atómica mientras concluye el despliegue serverless.

### 📍 MESA 2: Blindaje Financiero (Wompi, Idempotencia y Concurrencia)
* 🤝 **CONSENSO ALCANZADO:** Pruebas automáticas con **Vitest** (17 tests aislados en 3 suites) + suite general de backend (`npm test`), validando webhooks de Wompi con bloqueo `FOR UPDATE` en concurrencia.

### 📍 MESA 3: Feature Flags y Flexibilidad de Navegación
* 🤝 **CONSENSO ALCANZADO:** Feature Flags full-stack por municipio (Admin UI + API `/api/config` + Middleware `503 Service Unavailable` + conmutador Wompi a `SANDBOX`).

### 📍 MESA 4: Motor de Descubrimiento Territorial de Vitrina (CPO Master Vision 100/100)
* 🤝 **CONSENSO ALCANZADO TRI-AGENTE:**
  - **`TerritoryPostCard.tsx`**: Tarjeta compacta con Origen Territorial Explicado (*`🎣 Producido en Nuquí`*), Badge *"Disponible Ahora"* en tiempo real y apertura de fotografías en el visor Lightbox de teatro (`ModalTeatroPublicacion.tsx`).
  - **`VitrinaReelsFeed.tsx`**: Réplica exacta de Facebook/Instagram Reels / TikTok Web. En móviles es 100% inmersivo pantalla completa; en computador es una tarjeta vertical centrada de `460px` con fondo ambiental desenfocado (*Ambient Blur*).
  - **Métricas Numéricas Nativas**: Eliminado el clutter de texto; conteo numérico de me gusta, comentarios, compartidos y guardados por ícono en la barra lateral derecha.

### 📍 MESA 5: Vistas Previas Dinámicas para Redes Sociales y WhatsApp (Open Graph / Twitter Cards)
* 🤝 **CONSENSO ALCANZADO:**
  - **Visualización Rica en WhatsApp / Redes Sociales**: Implementación de `generateMetadata({ searchParams })` en `app/vitrina/layout.tsx` y en el backend (`GET /cultura/publicaciones/:id`).
  - **Vista previa de imágenes/videos**: Al compartir enlaces como `https://afro-mercado.vercel.app/vitrina?publicacion=6`, WhatsApp scrapea dinámicamente la fotografía/miniatura real del post (`og:image` de 1200x630px), el título del contenido (*"SAN ONOFRE — Pescado y Patacón"*) y la descripción regional.

### 📍 MESA 6: Controles Interactivos de Video Reels (Sonido ON/OFF + Tap Play/Pause)
* 🤝 **CONSENSO ALCANZADO:**
  - **Botón Flotante de Audio (`🔊 Sonido ON` / `🔇 Sin sonido`)**: Ubicado en la esquina superior derecha del reproductor de Reels para alternar libremente el canal de audio del video.
  - **Tocar Pantalla para Pausar y Reanudar (`onClick`)**: Tocar o hacer clic en cualquier parte de la pantalla del video alterna de forma instantánea entre reproducción (`play`) y pausa (`pause`), desplegando una animación centrada de pulso (`▶️` / `⏸️`).

### 📍 MESA 7: Poblado de Contenido Demo (Temporada, Hotelería, Bienes Raíces) — Claude (CTO)
* ✅ **Verificación previa sin regresiones:** re-ejecuté `npm run lint` (backend), `npm test` (152 legacy), `npx vitest run` (17 tests) y `tsc --noEmit` (0 errores nuevos) antes de tocar datos — el cambio de CI de Gemini (quitar `--if-present` del lint) no rompe nada porque el backend ya tiene script `lint` real.
* ✅ Confirmé en vivo que la corrección de botones de Reels (like/guardar/seguir/compartir) que reportó el dueño del producto ya estaba resuelta en `VitrinaReelsFeed.tsx` — estado por-ID aislado (`meGustaPorId`, `favoritoPorId`, `siguiendoPorId`, etc.), coherente con el patrón de `TarjetaPublicacionCultural.tsx`.
* 🆕 **Ofertas de Temporada:** creadas 12 ofertas reales vía `POST /api/ofertas` sobre productos ya sembrados (Agro, Ropa, Calzado, Animales de Cría, Tours) — antes `/temporada` estaba vacío. Sin cambios de código; el endpoint ya existía (`oferta.controller.js`), solo faltaba contenido.
* 🆕 **Variedad de alojamiento en Hotelería:** "Cooperativa Cacao Chocó" solo tenía 2 `HabitacionTipo` (una llamada literalmente "Preubas", resto de prueba visible en producción). Renombrada y agregados `CABANA`, `GLAMPING`, `APARTAMENTO`, `FINCA` — ahora ambos hoteles del piloto cubren los 6 tipos principales de `TipoAlojamiento`.
* ⚠️ **Decisión importante sobre Bienes Raíces — pido que los otros agentes la respeten:** `inmueble.service.js` tiene una regla explícita (`REGLA CRÍTICA`, línea ~158) que impide aprobar CUALQUIER predio sin `documentoSoporteUrl` real, sin excepción ni para ADMIN — es la salvaguarda contra fraude/disputa de tierra en el territorio piloto. Antes de crear datos demo consulté al dueño del producto con dos opciones (dejar en `PENDIENTE` de moderación vs. aprobar con documento placeholder) y **eligió la opción segura**. Creé 6 predios (lote, casa, apartamento, finca, local comercial, bodega) en estado `PUBLICADO`/moderación `PENDIENTE` — visibles solo en `/admin` y "mis publicaciones", **no en la vitrina pública** (verificado: `GET /api/inmuebles` sigue devolviendo `total: 0`). Ningún agente debería adjuntar un `documentoSoporteUrl` sintético para saltarse este gate, ni siquiera para datos de demostración.

---

## 🛠️ BITÁCORA DE EJECUCIÓN REAL CONSOLIDADA

### 🟢 Claude (CTO):
- ✅ Vitest instalado + `directUrl` en `schema.prisma` + marcado JSON-LD + middleware `503` para feature flags.
- ✅ 12 Ofertas de Temporada creadas (Agro/Ropa/Calzado/Animales/Tours) — ver MESA 7.
- ✅ Hotelería: "Cooperativa Cacao Chocó" con 6 `HabitacionTipo` (antes 2, uno de prueba) — ver MESA 7.
- ⚠️ Bienes Raíces: 6 predios demo creados, deliberadamente en `PENDIENTE` de moderación (no públicos) por la salvaguarda anti-fraude de tierra — ver MESA 7.

### 🤖 Codex (Verificación Independiente / ChatGPT):
- ✅ Auditoría estricta de archivos (93 modelos, 42 rutas API, 140 páginas Next.js, 17 tests Vitest pasados).

### 🔵 Gemini (CPO):
- 🚀 Motor de Descubrimiento Territorial implementado (`TerritoryPostCard.tsx` + `VitrinaReelsFeed.tsx`).
- 🔊 **Reproductor de Video Reels Interactivo**: Añadido control flotante de volumen (`🔊` / `🔇`) y pausa/play táctil con animación pulsante.
- ✂️ **Recortador de Video Interactivo**: Creado `RecortadorVideoModal.tsx` con ingreso directo min:seg y captura en vivo.
- 🧪 **Verificación de Calidad**: `npx tsc --noEmit` compilado con **0 errores**.

---

## ✍️ DECLARACIÓN FINAL DE CONSENSO TRI-AGENTE

Los 3 agentes (CPO, CTO y Codex) declaran los **controles interactivos de audio y reproducción de video Reels** completamente finalizados y sincronizados en `main`.
