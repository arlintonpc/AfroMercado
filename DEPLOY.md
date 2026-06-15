# 🚀 Guía de despliegue — AfroMercado

Esta guía pone AfroMercado en internet **gratis**, accesible desde cualquier celular.

```
Frontend (Next.js) → Vercel
Backend  (Express) → Render
Base de datos      → Neon (PostgreSQL)
```

Tiempo estimado: ~30 minutos. No necesitas tarjeta de crédito.

---

## Paso 0 — Subir el código a GitHub

El deploy se hace desde un repositorio de GitHub.

1. Crea una cuenta en https://github.com (si no tienes).
2. Crea un repositorio nuevo y **privado** llamado `afromercado`.
3. Desde la carpeta `D:\AfroMercado`, en una terminal:

```bash
git init
git add .
git commit -m "AfroMercado MVP"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/afromercado.git
git push -u origin main
```

> El `.gitignore` ya evita subir `node_modules`, `.env` y `uploads/`. Verifica que tu `.env` real **no** aparezca en GitHub.

---

## Paso 1 — Base de datos en Neon

1. Entra a https://neon.tech y crea una cuenta (con GitHub).
2. Crea un proyecto: nombre `afromercado`, región la más cercana (ej. AWS US East).
3. Copia la **Connection string** (botón "Connect"). Se ve así:
   ```
   postgresql://USUARIO:PASSWORD@ep-xxxx.us-east-2.aws.neon.tech/afromercado?sslmode=require
   ```
   Guárdala — la usarás como `DATABASE_URL`.

---

## Paso 2 — Backend en Render

1. Entra a https://render.com y crea una cuenta (con GitHub).
2. **New → Web Service** → conecta tu repo `afromercado`.
3. Configura:
   - **Root Directory:** `afromercado`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. En **Environment**, agrega estas variables:

   | Clave | Valor |
   |-------|-------|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | *(la connection string de Neon)* |
   | `JWT_SECRET` | *(genera uno, ver abajo)* |
   | `JWT_EXPIRES_IN` | `24h` |
   | `COMISION_PORCENTAJE` | `0.10` |
   | `BCRYPT_ROUNDS` | `10` |
   | `CORS_ORIGIN` | *(lo llenas en el Paso 4)* |

   Genera el `JWT_SECRET` con:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
5. **Create Web Service.** Render hará el build, aplicará las migraciones (`prisma migrate deploy`) y arrancará.
6. Cuando termine, copia la URL del servicio, ej: `https://afromercado-api.onrender.com`

### Sembrar datos iniciales (una sola vez)
En Render: pestaña **Shell** del servicio y ejecuta:
```bash
npm run seed
```
Esto crea las categorías, los 4 productores, los 6 productos y las cuentas de prueba.

---

## Paso 3 — Frontend en Vercel

1. Entra a https://vercel.com y crea una cuenta (con GitHub).
2. **Add New → Project** → importa tu repo `afromercado`.
3. Configura:
   - **Root Directory:** `afromercado-web`
   - Framework: Next.js (se detecta solo)
4. En **Environment Variables**, agrega:

   | Clave | Valor |
   |-------|-------|
   | `NEXT_PUBLIC_API_URL` | `https://afromercado-api.onrender.com/api` |

   *(usa la URL real de tu backend de Render, con `/api` al final)*
5. **Deploy.** Al terminar te da una URL, ej: `https://afromercado.vercel.app`

---

## Paso 4 — Conectar los dos lados (CORS)

1. Vuelve a Render → tu servicio → **Environment**.
2. Edita `CORS_ORIGIN` y pon la URL de Vercel **sin barra final**:
   ```
   CORS_ORIGIN=https://afromercado.vercel.app
   ```
3. Guarda (Render reinicia solo).

¡Listo! Abre tu URL de Vercel desde el celular. 🎉

---

## Cuentas de prueba (creadas por el seed)

```
Admin:        admin@afromercado.co   / Admin123
Comprador:    comprador@test.co      / Comprador123
Comerciante:  baudo@afromercado.co   / Comercio123
```

---

## ⚠️ Cosas a saber del plan gratuito

- **Render free "duerme"** tras 15 min sin uso: la primera visita tarda ~30–50 s en despertar. Normal en plan gratis.
- **Comprobantes de pago:** hoy se guardan en el disco del servidor, que en Render free es **efímero** (se borra al reiniciar). Para producción real conviene migrar las imágenes a Cloudinary o S3 (mejora futura, ya contemplada en el código).
- **Neon free** pausa la BD tras inactividad; reanuda sola en segundos.

Para un lanzamiento serio (sin "dormir" y con almacenamiento de imágenes persistente), el siguiente paso es un plan pago básico (~7 USD/mes en Render) + Cloudinary gratis.
