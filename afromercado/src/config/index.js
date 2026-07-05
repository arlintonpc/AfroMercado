// Configuración central — lee variables de entorno de forma segura
require("dotenv").config();

function requerido(nombre, valorPorDefecto = undefined) {
  const valor = process.env[nombre] ?? valorPorDefecto;
  if (valor === undefined) {
    throw new Error(`Falta la variable de entorno requerida: ${nombre}`);
  }
  return valor;
}

// Variables degradables: si faltan, la función asociada queda deshabilitada
// pero el servidor sigue arrancando (a diferencia de requerido(), que sí detiene el arranque).
function advertirSiFalta(nombre, contexto) {
  if (!process.env[nombre]) {
    console.warn(`[CONFIG] Advertencia: falta ${nombre} — ${contexto} estará deshabilitado.`);
  }
}

const config = {
  entorno: process.env.NODE_ENV || "development",
  puerto: parseInt(process.env.PORT || "3000", 10),

  jwt: {
    secret: requerido("JWT_SECRET"),
    expiraEn: process.env.JWT_EXPIRES_IN || "24h",
  },

  // Comisión de AfroMercado (10%)
  comisionPorcentaje: parseFloat(process.env.COMISION_PORCENTAJE || "0.10"),

  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "10", 10),
};

advertirSiFalta("SENTRY_DSN", "el reporte de errores a Sentry");
advertirSiFalta("CLOUDINARY_URL", "la subida de imágenes/videos a Cloudinary");
advertirSiFalta("VAPID_PUBLIC_KEY", "las notificaciones push");
advertirSiFalta("VAPID_PRIVATE_KEY", "las notificaciones push");

module.exports = config;
