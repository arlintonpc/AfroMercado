// ============================================================
//  AfroMercado API — Aplicación Express  [vista-producto ready]
// ============================================================
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const rutas = require("./routes");
const { manejadorErrores, rutaNoEncontrada } = require("./middlewares/errores");
// WhatsApp se inicia solo cuando el admin hace clic en "Conectar" — no al arrancar el servidor.
// Esto evita que cada reinicio de nodemon cree un socket nuevo y genere conflictos 440.

const app = express();

// Orígenes permitidos para CORS. En producción se define CORS_ORIGIN
// (uno o varios separados por coma, ej. el dominio de Vercel). En desarrollo,
// si no está definido, se permiten todos los orígenes.
const origenesPermitidos = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Guardia de arranque: en producción, CORS_ORIGIN es obligatoria. Sin esta
// guardia, `origin` cae a `true` más abajo y, combinado con `credentials: true`,
// refleja dinámicamente cualquier origen (vector CSRF/robo de sesión). Mismo
// patrón de guardia que ya usa `obtenerClaveCifrado()` en cuentas-dispersion.js.
if (process.env.NODE_ENV === "production" && origenesPermitidos.length === 0) {
  throw new Error(
    "CORS_ORIGIN es obligatoria en producción — configúrala en las variables de entorno de Render con la URL exacta del frontend en Vercel."
  );
}

// Seguridad y middlewares base
app.use(helmet());                          // cabeceras de seguridad
app.use(
  cors({
    origin: origenesPermitidos.length > 0 ? origenesPermitidos : true,
    credentials: true,
  })
);
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString("utf8");
  },
}));                    // parsea JSON del body y conserva rawBody para webhooks
app.use(express.urlencoded({ extended: true }));

// Imágenes públicas de productos (subidas por los comerciantes).
// Cross-Origin-Resource-Policy se sobreescribe a "cross-origin" para que el
// frontend en un puerto distinto pueda cargar estas imágenes (Helmet pone
// "same-origin" por defecto, lo que bloquea la carga cross-origin).
app.use("/uploads/productos", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(
  "/uploads/productos",
  express.static(path.join(__dirname, "..", "uploads", "productos"))
);
app.use("/uploads/videos", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(
  "/uploads/videos",
  express.static(path.join(__dirname, "..", "uploads", "videos"))
);
app.use("/uploads/campanas", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(
  "/uploads/campanas",
  express.static(path.join(__dirname, "..", "uploads", "campanas"))
);
app.use("/uploads/documentos", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(
  "/uploads/documentos",
  express.static(path.join(__dirname, "..", "uploads", "documentos"))
);
app.use("/uploads/avatares", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(
  "/uploads/avatares",
  express.static(path.join(__dirname, "..", "uploads", "avatares"))
);
app.use("/uploads/entregas", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(
  "/uploads/entregas",
  express.static(path.join(__dirname, "..", "uploads", "entregas"))
);
app.use("/uploads/repartidores", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(
  "/uploads/repartidores",
  express.static(path.join(__dirname, "..", "uploads", "repartidores"))
);
app.use("/uploads/marca", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(
  "/uploads/marca",
  express.static(path.join(__dirname, "..", "uploads", "marca"))
);
app.use("/uploads/hojas-de-vida", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(
  "/uploads/hojas-de-vida",
  express.static(path.join(__dirname, "..", "uploads", "hojas-de-vida"))
);
app.use("/uploads/reviews-cultura", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(
  "/uploads/reviews-cultura",
  express.static(path.join(__dirname, "..", "uploads", "reviews-cultura"))
);
app.use("/uploads/publicaciones-cultura", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(
  "/uploads/publicaciones-cultura",
  express.static(path.join(__dirname, "..", "uploads", "publicaciones-cultura"))
);

// Rate limiting — se omite completamente en desarrollo para no interferir con hot-reload
const esProd = process.env.NODE_ENV === "production";
const saltarEnDev = () => !esProd;

// Aviso de arranque: el rate limiting solo se activa cuando NODE_ENV es
// exactamente "production". Un typo o valor no estándar (ej. "staging") en
// Render deja login/checkout sin límite de intentos sin ningún aviso — este
// warning existe para que no pase inadvertido.
if (
  process.env.NODE_ENV &&
  process.env.NODE_ENV !== "production" &&
  process.env.NODE_ENV !== "development"
) {
  console.warn(
    `[RATE-LIMIT] NODE_ENV="${process.env.NODE_ENV}" no coincide con "production" ni "development" — el rate limiting se está saltando (solo se activa cuando NODE_ENV === "production"). Revisa la variable de entorno.`
  );
}

// Opciones base del rate limiter — validate.xForwardedForHeader:false evita el
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR que lanza Render al pasar múltiples IPs en el header.
const rlBase = { standardHeaders: true, legacyHeaders: false, validate: { xForwardedForHeader: false } };

// Límite general para API pública: 60 peticiones por minuto
const apiLimiter = rateLimit({
  ...rlBase,
  windowMs: 60 * 1000,
  max: 60,
  skip: saltarEnDev,
  message: { error: "Demasiadas peticiones. Intenta en un minuto." },
});

// Límite estricto para auth: 10 intentos cada 15 minutos
const authLimiter = rateLimit({
  ...rlBase,
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: saltarEnDev,
  message: { error: "Demasiados intentos. Espera 15 minutos." },
});

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);

// Rate limiter específico para recuperación de contraseña
const recuperacionLimiter = rateLimit({
  ...rlBase,
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: saltarEnDev,
  message: { error: "Demasiados intentos. Espera 15 minutos." },
});
app.use("/api/auth/recuperar", recuperacionLimiter);

// Rutas de la API
app.use("/api", rutas);

// Manejo de rutas no encontradas y errores (siempre al final)
app.use(rutaNoEncontrada);
app.use(manejadorErrores);

module.exports = app;
