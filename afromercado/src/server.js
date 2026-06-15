// Punto de entrada — arranca el servidor
const app = require("./app");
const config = require("./config");
const { cerrarConexion } = require("./utils/whatsapp");

// Evitar que excepciones de Baileys/WhatsApp tumben el proceso
process.on("uncaughtException", (err) => {
  console.error("[PROCESO] Excepción no capturada:", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("[PROCESO] Promesa rechazada sin manejar:", reason?.message ?? reason);
});

// Cierre limpio al reiniciar (SIGTERM de nodemon, SIGINT de Ctrl+C)
// Cierra el socket de WhatsApp antes de salir para evitar conflictos 440
// cuando la nueva instancia arranque con las mismas credenciales.
async function shutdown(signal) {
  console.log(`[PROCESO] ${signal} recibido — cerrando WhatsApp antes de salir…`);
  await cerrarConexion();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

app.listen(config.puerto, () => {
  console.log(`🌿 AfroMercado API corriendo en http://localhost:${config.puerto}`);
  console.log(`   Entorno: ${config.entorno}`);
});
