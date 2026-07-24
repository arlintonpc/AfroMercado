// Punto de entrada — arranca el servidor
// Sentry debe inicializarse antes de cualquier otro require
const Sentry = require("@sentry/node");
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0 : 1.0,
    beforeSend(event) {
      if (process.env.NODE_ENV === "test") return null;
      return event;
    },
  });
}

const app = require("./app");
const config = require("./config");
const { cerrarConexion } = require("./utils/whatsapp");
const { iniciarCron } = require("./utils/cron");
const { iniciarJob: iniciarJobHotel } = require("./jobs/expirarReservasHotel");
const { iniciarJob: iniciarJobRecordatorioTour } = require("./jobs/recordatorioTour");
const { iniciarJob: iniciarJobReintentarDispersiones } = require("./jobs/reintentar-dispersiones.job");
const { iniciarJob: iniciarJobReintentarFacturacion } = require("./jobs/reintentar-facturacion.job");
const { estaConfigurado: smtpConfigurado } = require("./utils/email");
const { aplicarMigracionesSeguras } = require("./utils/migrador");

// Advertencias de arranque que dependen de la BD (tabla Config)
async function verificarAdvertenciasArranque() {
  if (!(await smtpConfigurado())) {
    console.warn("[CONFIG] Advertencia: SMTP no configurado (ni en Config ni en variables de entorno) — los correos transaccionales estarán deshabilitados.");
  }
}

// Evitar que excepciones de Baileys/WhatsApp tumben el proceso
process.on("uncaughtException", (err) => {
  console.error("[PROCESO] Excepción no capturada:", err.message);
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[PROCESO] Promesa rechazada sin manejar:", reason?.message ?? reason);
  if (process.env.SENTRY_DSN) Sentry.captureException(reason);
});

// Cierre limpio al reiniciar (SIGTERM de nodemon, SIGINT de Ctrl+C)
async function shutdown(signal) {
  console.log(`[PROCESO] ${signal} recibido — cerrando WhatsApp antes de salir…`);
  await cerrarConexion();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

aplicarMigracionesSeguras().then(async () => {
  await verificarAdvertenciasArranque();
  app.listen(config.puerto, () => {
    console.log(`🌿 AfroMercado API corriendo en http://localhost:${config.puerto}`);
    console.log(`   Entorno: ${config.entorno}`);
    iniciarCron();
    iniciarJobHotel();
    iniciarJobRecordatorioTour();
    iniciarJobReintentarDispersiones();
    iniciarJobReintentarFacturacion();
  });
});
