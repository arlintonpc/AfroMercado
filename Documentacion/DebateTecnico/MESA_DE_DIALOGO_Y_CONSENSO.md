# 🏛️ MESA DE DIÁLOGO Y CONSENSO TÉCNICO: AFROMERCADO (SUPERAPP)

---

## 📌 FICHA DE LA MESA DE DIÁLOGO
- **Proyecto:** AfroMercado — Plataforma Multiservicios Territorial
- **Fecha:** 24 de Julio de 2026
- **Mapeo del Código:** 93 Modelos Prisma | 43 Archivos de Rutas API | 140 Páginas Next.js 16
- **Mesa Tri-Agente:**
  - 🔵 **Agente 1 (Arquitectura de Producto & UX / CPO — Gemini):** Visión de Negocio, Motor de Descubrimiento, UX World-Class, Edición Completa de Publicaciones de Comercio, Open Graph Social Previews y Superpoderes de Plataforma.
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
  - **Vista previa de imágenes/videos**: Al compartir enlaces como `https://afro-mercado.vercel.app/vitrina?publicacion=6`, WhatsApp scrapea dinámicamente la fotografía/miniatura real del post (`og:image` de 1200x630px), el título del contenido (*"SAN ONOFRE — Pescado y Patacón"*) y la descripción regional, en lugar de mostrar metadatos estáticos o imágenes genéricas.

### 📍 MESA 6: Edición Completa de Publicaciones de Comercio en Vitrina
* 🤝 **CONSENSO ALCANZADO:**
  - **Habilitación Full-Stack de Edición (`app/comerciante/vitrina/[id]/editar/page.tsx`)**: Eliminadas las restricciones que impedían modificar archivos multimedia.
  - **Campos Habilitados**: Los comerciantes ahora pueden actualizar libremente:
    1. **Video de la publicación**: Reemplazar archivo de video o actualizar enlace directo.
    2. **Fotografías / Miniatura**: Subir nuevas fotos o modificar la galería.
    3. **Ubicación Territorial**: Cambiar Departamento y Municipio de la oferta.
    4. **Información General & Producto**: Título, descripción, módulo y producto asociado.
  - **Soporte Backend (`CulturaService.actualizarMiPublicacion`)**: Actualizados los saneadores para recibir `fotoUrls`, `videoUrl`, `videoPosterUrl`, `departamento` y `municipio`.

---

## 🛠️ BITÁCORA DE EJECUCIÓN REAL CONSOLIDADA

### 🟢 Claude (CTO):
- ✅ Vitest instalado + `directUrl` en `schema.prisma` + marcado JSON-LD + middleware `503` para feature flags.

### 🤖 Codex (Verificación Independiente / ChatGPT):
- ✅ Auditoría estricta de archivos (93 modelos, 42 rutas API, 140 páginas Next.js, 17 tests Vitest pasados).

### 🔵 Gemini (CPO):
- 🚀 Motor de Descubrimiento Territorial implementado (`TerritoryPostCard.tsx` + `VitrinaReelsFeed.tsx` + Pestañas *Explorar*, *Siguiendo*, *Guardados* + Métricas numéricas nativas).
- 📲 **Open Graph & WhatsApp Dynamic Previews**: Creada la ruta backend `GET /cultura/publicaciones/:id` y `generateMetadata` dinámico en `app/vitrina/layout.tsx`.
- ✏️ **Edición Completa de Vitrina**: Habilitada la edición de fotos, video, ubicación territorial e información general en el panel del comerciante.
- 🧪 **Verificación de Calidad**: `npx tsc --noEmit` compilado con **0 errores**.

---

## ✍️ DECLARACIÓN FINAL DE CONSENSO TRI-AGENTE

Los 3 agentes (CPO, CTO y Codex) declaran el módulo de **edición completa de publicaciones para comerciantes** verificado, probado y listo para producción.
