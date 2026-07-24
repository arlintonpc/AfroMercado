// Pruebas unitarias para el controlador de configuración (config.controller.js)
// Ejecutar con: node tests/config.test.js

const ConfigController = require('../src/controllers/config.controller');

let pasadas = 0;
let fallidas = 0;

function esperar(descripcion, real, esperado) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (ok) {
    pasadas++;
    console.log(`  ✓ ${descripcion}`);
  } else {
    fallidas++;
    console.log(`  ✗ ${descripcion}`);
    console.log(`      esperado: ${JSON.stringify(esperado)}`);
    console.log(`      recibido: ${JSON.stringify(real)}`);
  }
}

async function runConfigTests() {
  console.log("\nPruebas: ConfigController (GET /api/config y PUT /api/config/:clave)\n");

  // 1. Validar error cuando falta el campo valor en PUT /config/:clave
  const reqFail = { params: { clave: "flag_modulo_express" }, body: {} };
  const resFail = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };

  await ConfigController.actualizarClavePut(reqFail, resFail, () => {});
  esperar("PUT /config/:clave sin valor responde 400", resFail.statusCode, 400);
  esperar("Respuesta de error indica valor requerido", resFail.body.error, "El campo valor es requerido");

  console.log(`\nResultado: ${pasadas} pasadas, ${fallidas} fallidas\n`);
  process.exit(fallidas > 0 ? 1 : 0);
}

runConfigTests();
