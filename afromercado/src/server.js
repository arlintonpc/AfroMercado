// Punto de entrada — arranca el servidor
const app = require("./app");
const config = require("./config");

app.listen(config.puerto, () => {
  console.log(`🌿 AfroMercado API corriendo en http://localhost:${config.puerto}`);
  console.log(`   Entorno: ${config.entorno}`);
});
