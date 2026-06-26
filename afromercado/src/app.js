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

// Seguridad y middlewares base
app.use(helmet());                          // cabeceras de seguridad
app.use(
  cors({
    origin: origenesPermitidos.length > 0 ? origenesPermitidos : true,
    credentials: true,
  })
);
app.use(express.json());                    // parsea JSON del body
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

// Rate limiting — se omite completamente en desarrollo para no interferir con hot-reload
const esProd = process.env.NODE_ENV === "production";
const saltarEnDev = () => !esProd;

// Límite general para API pública: 60 peticiones por minuto
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  skip: saltarEnDev,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones. Intenta en un minuto." },
});

// Límite estricto para auth: 10 intentos cada 15 minutos
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: saltarEnDev,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Espera 15 minutos." },
});

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);

// Rate limiter específico para recuperación de contraseña
const recuperacionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: saltarEnDev,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Espera 15 minutos." },
});
app.use("/api/auth/recuperar", recuperacionLimiter);

// Rutas de la API
app.use("/api", rutas);

// Manejo de rutas no encontradas y errores (siempre al final)
app.use(rutaNoEncontrada);
app.use(manejadorErrores);

module.exports = app;
