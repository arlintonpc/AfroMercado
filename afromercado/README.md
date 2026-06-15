# 🌿 AfroMercado API

Backend del marketplace cultural del Chocó. Versión MVP — Pilar: Productos del Campo.

## Requisitos

- Node.js 18 o superior
- PostgreSQL 14 o superior
- Git

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Edita .env con tus datos reales (base de datos, JWT secret)

# 3. Generar el cliente de Prisma
npm run prisma:generate

# 4. Crear las tablas en la base de datos
npm run prisma:migrate

# 5. Arrancar el servidor en modo desarrollo
npm run dev
```

El servidor queda en `http://localhost:3000`

## Comandos disponibles

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Arranca con recarga automática (nodemon) |
| `npm start` | Arranca en modo producción |
| `npm test` | Ejecuta las pruebas unitarias |
| `npm run prisma:studio` | Abre un visor visual de la base de datos |

## Arquitectura

El proyecto sigue una arquitectura limpia por capas:

```
Petición HTTP
    ↓
routes/        → define los endpoints
    ↓
controllers/   → recibe y responde (sin lógica)
    ↓
services/      → lógica de negocio
    ↓
repositories/  → acceso a la base de datos (Prisma)
    ↓
PostgreSQL
```

Cada capa solo conoce a la siguiente. Esto facilita las pruebas y el mantenimiento.

## Endpoints disponibles (Sprint 1)

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/api` | Estado de la API | No |
| POST | `/api/auth/registro` | Registrar usuario | No |
| POST | `/api/auth/login` | Iniciar sesión | No |
| GET | `/api/auth/yo` | Datos del usuario actual | Sí |

### Ejemplo de registro

```bash
curl -X POST http://localhost:3000/api/auth/registro \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "José Mosquera",
    "email": "jose@ejemplo.com",
    "telefono": "3001234567",
    "password": "miClave123",
    "rol": "COMERCIANTE",
    "municipio": "Quibdó"
  }'
```

## Seguridad

- Contraseñas cifradas con bcrypt (nunca en texto plano)
- Autenticación con JWT
- Cabeceras de seguridad con Helmet
- Variables sensibles en `.env` (fuera de Git)

## Próximos sprints

- Sprint 2: Gestión de productos
- Sprint 3: Catálogo público
- Sprint 4: Pedidos
- Sprint 5: Pagos
- Sprint 6: Entregas
- Sprint 7: Notificaciones
