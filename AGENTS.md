# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Proyecto

AfroMercado — marketplace cultural para comunidades afrocolombianas del Chocó. Dos módulos principales de e-commerce (productos físicos) y servicios especializados (Express/Sabores, Hoteles, Tours, Transportes).

## Comandos de desarrollo

### Arrancar todo (Windows)
```bat
iniciar.bat
```
Mata procesos Node anteriores, regenera Prisma, e inicia backend (3001) y frontend (3002) en ventanas separadas.

### Backend (`afromercado/`)
```bash
npm run dev          # nodemon — recarga en cambios en src/
npm run build        # prisma generate (regenera el cliente Prisma)
npm test             # tests unitarios: comisión, productos, pago-repartidor
npm run test:e2e     # flujos end-to-end contra la API local
npm run prisma:studio  # Prisma Studio en navegador
```

**Importante con nodemon:** el archivo `nodemon.json` limita el watch a `src/`. Si modificas `prisma/schema.prisma` debes reiniciar manualmente. Antes de `prisma generate`, detén el backend porque el proceso bloquea `query_engine-windows.dll.node` en Windows.

### Frontend (`afromercado-web/`)
```bash
npm run dev    # Next.js en puerto 3002
npm run build  # build de producción
npm run lint   # ESLint
```

Si el compilador sirve código cacheado incorrecto, elimina `.next/` y reinicia.

## Arquitectura

### Backend — `afromercado/src/`

Arquitectura en capas: `routes → controllers → services → repositories → prisma`.

- **`routes/index.js`** — enrutador raíz que monta todos los subrouters bajo `/api/`
- **`middlewares/auth.js`** — `autenticar` (JWT obligatorio), `autorizar(...roles)` (guarda de rol), `autenticarOpcional` (no falla si no hay token). El token se acepta en `Authorization: Bearer` o en `?token=` (solo para SSE/EventSource).
- **`config/index.js`** — lee `.env`; lanza error en arranque si falta `JWT_SECRET` u otra variable requerida
- **`utils/cloudinary.js`** — `subirACloudinary(ruta, carpeta)` → `secure_url | null`. No usa el SDK; usa `fetch` + firma SHA-1. Si `CLOUDINARY_URL` no está definida devuelve `null` (el controlador debe manejar el fallback).

**Módulos de servicio** (cada uno tiene su `config`, `routes`, `controller`, `service`):
- `express` — pedidos de comida/restaurante (ConfigExpress, ProductoExpress, PedidoExpress, GrupoComplemento, ItemComplemento)
- `hotel` — reservas de alojamiento (ConfigHotel, HabitacionTipo, HabitacionFisica, ReservaHotel)
- `tour` — excursiones con lugares e itinerario (ConfigTour, TourLugar, TourLugarMedia)
- `transporte` — servicios de transporte
- `pedido` — marketplace general (productos físicos con carrito, subpedidos por comercio)

**Migraciones:** el entorno de producción usa Neon con connection pooler, que bloquea `prisma migrate deploy`. Todas las DDL nuevas se aplican via `$executeRawUnsafe` en `server.js → aplicarMigraciones()` al arrancar el servidor. El `schema.prisma` es la fuente de verdad para los tipos del cliente, pero la DB real puede tener columnas extra no reflejadas en el schema.

**Decimal de Prisma:** los campos `Decimal` en PostgreSQL se serializan a JSON como **strings**. Siempre usa `Number(valor)` antes de cualquier operación aritmética.

### Frontend — `afromercado-web/`

Next.js 16 App Router con React 19. Todas las páginas interactivas son `'use client'`.

**Comunicación con la API:**
- `lib/api/client.ts` — `apiFetch<T>(path, options)`: adjunta `Authorization: Bearer`, serializa JSON, lanza `Error` con el mensaje del backend si `!ok`. Emite `afm:session-expired` en 401.
- `lib/api/*.ts` — un archivo por dominio (express, hotel, tour, admin…), cada uno exporta funciones tipadas que llaman a `apiFetch`.

**Contextos globales** (`context/`):
- `AuthContext` — usuario autenticado, token en `localStorage` bajo la clave `afromercado_token`
- `CarritoContext` — carrito del marketplace general
- `FavoritoContext`, `NotificacionContext`, `PushContext`

**Rutas de usuario por rol:**
- `/` — tienda pública
- `/ingresar`, `/registro` — autenticación (no `/login`)
- `/comerciante/` — panel del comerciante (Express, Tours, Hoteles, Transportes)
- `/admin/` — panel administrador
- `/express/[id]` — menú de restaurante + checkout con complementos
- `/hoteles/`, `/tours/`, `/transportes/` — módulos de servicios

**Colores de marca:** `#1B4332` (verde oscuro), `#2D6A4F` (verde medio), `#F7F5F2` (fondo crema), `#D4A017` (dorado).

## Variables de entorno

### Backend (`.env` en `afromercado/`)
```
DATABASE_URL=          # PostgreSQL (Neon en producción)
JWT_SECRET=
CLOUDINARY_URL=        # cloudinary://api_key:api_secret@cloud_name
PORT=3001
```

### Frontend (`.env.local` en `afromercado-web/`)
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api   # dev; en prod apunta a Render
```

## Deploy

- **DB:** Neon (PostgreSQL serverless)
- **Backend:** Render (`afromercado-api.onrender.com`)
- **Frontend:** Vercel

En producción, las migraciones de schema se aplican automáticamente al iniciar el servidor via `aplicarMigraciones()`. No usar `prisma migrate deploy` en producción por la incompatibilidad con el pooler de Neon.
