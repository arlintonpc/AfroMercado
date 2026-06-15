// ============================================================
//  AfroMercado API — Aplicación Express
// ============================================================
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const rutas = require("./routes");
const { manejadorErrores, rutaNoEncontrada } = require("./middlewares/errores");

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

// Rate limiting
// Límite general para API pública: 60 peticiones por minuto
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones. Intenta en un minuto." },
});

// Límite estricto para auth: 10 intentos cada 15 minutos
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Espera 15 minutos." },
});

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);

// Rutas de la API
app.use("/api", rutas);

// Manejo de rutas no encontradas y errores (siempre al final)
app.use(rutaNoEncontrada);
app.use(manejadorErrores);

module.exports = app;
